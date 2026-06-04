import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

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

  const { error } = await supabase.from('jobs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
