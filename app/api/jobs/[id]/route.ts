import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendIntakeConfirmation } from '@/lib/resend'
import { formatTicketNumber } from '@/lib/utils'
import { logAudit } from '@/lib/audit'
import { getApiUserRole } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('jobs')
    .select('*, customer:customers(id,name,phone,email), photos:job_photos(*), signature:signatures(*), parts:job_parts(*)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  return NextResponse.json({ job: data })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  try {
    const body = await request.json()
    const { add_part, ...jobFields } = body

    // Handle adding a part
    if (add_part) {
      const { inventory_id, part_name, quantity, unit_price } = add_part

      // Insert job_part record
      await supabase.from('job_parts').insert({
        job_id: id,
        inventory_id: inventory_id || null,
        part_name,
        quantity: quantity || 1,
        unit_price: unit_price || null,
      })

      // Decrement inventory quantity
      if (inventory_id) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('id', inventory_id)
          .single()

        if (inv) {
          await supabase
            .from('inventory')
            .update({ quantity: Math.max(0, inv.quantity - (quantity || 1)) })
            .eq('id', inventory_id)
        }
      }

      const { data: parts } = await supabase.from('job_parts').select('*').eq('job_id', id)

      // Fire reorder check in background — don't await so response is not delayed
      if (inventory_id) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('quantity,reorder_threshold')
          .eq('id', inventory_id)
          .single()
        if (inv && inv.quantity <= inv.reorder_threshold) {
          fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/inventory/reorder-check`, { method: 'POST' }).catch(() => null)
        }
      }

      return NextResponse.json({ parts })
    }

    // Update job fields
    const allowedFields: Record<string, unknown> = {}
    const allowed = [
      'internal_notes', 'notes', 'final_price', 'technician_name', 'quoted_price',
      'backup_completed', 'payment_status', 'deposit_amount', 'deposit_paid', 'payment_method',
      'checklist', 'warranty_days', 'warranty_expires_at', 'status', 'intake_signature_url',
    ]
    for (const key of allowed) {
      if (key in jobFields) allowedFields[key] = jobFields[key]
    }

    // When status is being set to 'collected', compute warranty_expires_at
    if (allowedFields.status === 'collected') {
      let warrantyDays: number = typeof allowedFields.warranty_days === 'number' ? allowedFields.warranty_days : 0
      if (warrantyDays === 0) {
        // Fetch current warranty_days from job
        const { data: existingJob } = await supabase
          .from('jobs')
          .select('warranty_days')
          .eq('id', id)
          .single()
        warrantyDays = existingJob?.warranty_days ?? 90
      }
      allowedFields.warranty_expires_at = new Date(Date.now() + warrantyDays * 86400000).toISOString()
      allowedFields.collected_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('jobs')
      .update(allowedFields)
      .eq('id', id)
      .select('*, customer:customers(id,name,phone,email), photos:job_photos(*), signature:signatures(*), parts:job_parts(*)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Send intake confirmation email when intake signature is saved after-the-fact
    if (allowedFields.intake_signature_url && data) {
      const customer = data.customer as { id: string; name: string; email: string | null } | null
      if (customer?.email) {
        sendIntakeConfirmation({
          to: customer.email,
          customerId: customer.id,
          customerName: customer.name,
          ticketNumber: formatTicketNumber(data.ticket_number),
          deviceInfo: `${data.device_make} ${data.device_model}`,
          reportedFault: data.reported_fault,
          intakeMethod: data.intake_method ?? 'drop_off',
          intakeDate: data.intake_date ?? null,
          quotedPrice: data.quoted_price ?? null,
          intakeSignatureUrl: allowedFields.intake_signature_url as string,
        }).catch(() => null)
      }
    }

    // Audit log for significant changes
    const { email: actorEmail } = await getApiUserRole()
    if (allowedFields.status && data) {
      logAudit({ action: 'job.status_changed', entity: 'job', entityId: id, userEmail: actorEmail, description: `Job #${data.ticket_number} status → ${allowedFields.status}`, newValue: { status: allowedFields.status } }).catch(() => null)
    }
    if (allowedFields.payment_status === 'paid' && data) {
      logAudit({ action: 'job.payment_marked', entity: 'job', entityId: id, userEmail: actorEmail, description: `Job #${data.ticket_number} marked as paid — £${data.final_price ?? 0}`, newValue: { payment_status: 'paid', final_price: data.final_price } }).catch(() => null)
    }
    if (allowedFields.final_price != null && data) {
      logAudit({ action: 'job.price_updated', entity: 'job', entityId: id, userEmail: actorEmail, description: `Job #${data.ticket_number} price set to £${allowedFields.final_price}`, newValue: { final_price: allowedFields.final_price } }).catch(() => null)
    }

    // Auto-log status change to job_notes timeline
    if (allowedFields.status && data) {
      const { JOB_STATUS_LABELS } = await import('@/types')
      await supabase.from('job_notes').insert({
        job_id: id,
        content: `Status changed to ${JOB_STATUS_LABELS[allowedFields.status as keyof typeof JOB_STATUS_LABELS] ?? allowedFields.status}`,
        note_type: 'status_change',
        meta: { status: allowedFields.status },
      })
    }

    // Auto-log payment to job_notes timeline
    if (allowedFields.payment_status === 'paid' && data) {
      await supabase.from('job_notes').insert({
        job_id: id,
        content: `Payment received${data.final_price ? ` — £${Number(data.final_price).toFixed(2)}` : ''}${data.payment_method ? ` via ${data.payment_method}` : ''}`,
        note_type: 'payment',
        meta: { payment_status: 'paid', final_price: data.final_price, payment_method: data.payment_method },
      })
    }

    // Fire push notification in background when status changes
    if (allowedFields.status && data) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      fetch(`${appUrl}/api/push/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: id,
          title: 'Repair Update',
          body: `Your repair status has changed to ${allowedFields.status}`,
          url: `/track/${data.ticket_number}`,
        }),
      }).catch(() => null)
    }

    // Fire QuickBooks invoice in background when job is marked as paid
    if (allowedFields.payment_status === 'paid' && process.env.QUICKBOOKS_CLIENT_ID) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      fetch(`${appUrl}/api/quickbooks/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id }),
      }).catch(() => null) // fire-and-forget
    }

    return NextResponse.json({ job: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { email: actorEmail, role } = await getApiUserRole()

  // Only managers can delete jobs
  if (role !== 'manager') return NextResponse.json({ error: 'Manager access required to delete jobs' }, { status: 403 })

  // Capture job details before deletion for the audit log
  const { data: job } = await supabase.from('jobs').select('ticket_number,device_make,device_model,status').eq('id', id).single()

  const { error } = await supabase.from('jobs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    action: 'job.deleted',
    entity: 'job',
    entityId: id,
    userEmail: actorEmail,
    description: `Job #${job?.ticket_number ?? id} deleted (${job?.device_make} ${job?.device_model}, was ${job?.status})`,
    oldValue: job ?? undefined,
  })

  return NextResponse.json({ deleted: true })
}
