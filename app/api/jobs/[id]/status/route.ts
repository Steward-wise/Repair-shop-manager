import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendSMS, sendWhatsApp } from '@/lib/twilio'
import { sendStatusEmail, sendRepairReport } from '@/lib/resend'
import { STATUS_NOTIFICATION_MESSAGES, type JobStatus } from '@/types'
import { formatTicketNumber, generateTrackingLink } from '@/lib/utils'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  try {
    const body = await request.json()
    const { status, signature_url, collector_name } = body

    const validStatuses: JobStatus[] = ['intake', 'diagnosed', 'awaiting_approval', 'awaiting_repair', 'waiting_parts', 'in_progress', 'ready', 'collected']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { status }
    if (status === 'collected') {
      updates.collected_at = new Date().toISOString()
      // Compute warranty expiry
      const { data: existingJob } = await supabase
        .from('jobs')
        .select('warranty_days')
        .eq('id', id)
        .single()
      const warrantyDays = existingJob?.warranty_days ?? 90
      updates.warranty_expires_at = new Date(Date.now() + warrantyDays * 86400000).toISOString()
    }

    // Update job status
    const { data: job, error: updateError } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', id)
      .select('*, customer:customers(id,name,phone,email), photos:job_photos(*), signature:signatures(*), parts:job_parts(*)')
      .single()

    if (updateError || !job) {
      return NextResponse.json({ error: updateError?.message ?? 'Job not found' }, { status: 500 })
    }

    // Save signature if provided (collection step)
    if (signature_url && status === 'collected') {
      await supabase.from('signatures').upsert({
        job_id: id,
        signature_url,
        collected_by: collector_name ?? 'Customer',
        customer_name: collector_name ?? job.customer?.name ?? null,
      })
    }

    // ── Send repair report email on collection ──
    if (status === 'collected' && job.customer?.email && job.repair_summary) {
      sendRepairReport({
        to: job.customer.email,
        customerId: job.customer.id,
        customerName: job.customer.name,
        ticketNumber: formatTicketNumber(job.ticket_number),
        deviceInfo: `${job.device_make} ${job.device_model}`,
        reportedFault: job.reported_fault ?? '',
        repairSummary: job.repair_summary,
        finalPrice: job.final_price ?? null,
        warrantyDays: job.warranty_days ?? null,
        warrantyExpiresAt: (updates.warranty_expires_at as string) ?? null,
        technicianName: job.technician_name ?? null,
      }).then((sent) => {
        if (sent) {
          supabase.from('jobs')
            .update({ repair_report_sent_at: new Date().toISOString() })
            .eq('id', id)
            .then(() => null)
        }
      }).catch(() => null)
    }

    // Send status notifications (SMS/WhatsApp/email)
    let notified = false
    const message = STATUS_NOTIFICATION_MESSAGES[status as JobStatus]
    const customer = job.customer

    if (message && customer) {
      const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
      const ticketRef = formatTicketNumber(job.ticket_number)
      const deviceLabel = `${job.device_make} ${job.device_model}`
      const trackLink = generateTrackingLink(job.ticket_number)
      const fullMessage = status === 'ready'
        ? `${shopName}: ${message} (Ticket ${ticketRef}) Track: ${trackLink}`
        : `${shopName}: ${message} (Ticket ${ticketRef})`

      const logs: { job_id: string; type: string; recipient: string; message: string; status: string }[] = []

      if (customer.phone) {
        const [smsOk, waOk] = await Promise.all([
          sendSMS(customer.phone, fullMessage),
          sendWhatsApp(customer.phone, fullMessage),
        ])
        logs.push({ job_id: id, type: 'sms', recipient: customer.phone, message: fullMessage, status: smsOk ? 'sent' : 'failed' })
        if (process.env.TWILIO_WHATSAPP_NUMBER) {
          logs.push({ job_id: id, type: 'whatsapp', recipient: customer.phone, message: fullMessage, status: waOk ? 'sent' : 'failed' })
        }
        if (smsOk || waOk) notified = true
      }
      if (customer.email) {
        const emailOk = await sendStatusEmail(customer.email, customer.id, customer.name, ticketRef, message, deviceLabel)
        logs.push({ job_id: id, type: 'email', recipient: customer.email, message, status: emailOk ? 'sent' : 'failed' })
        if (emailOk) notified = true
      }
      if (logs.length) await supabase.from('notification_log').insert(logs)
    }

    // Fire push notification in background
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    fetch(`${appUrl}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: id, title: 'Repair Update', body: `Status changed to ${status}`, url: `/track/${job.ticket_number}` }),
    }).catch(() => null)

    return NextResponse.json({ job, notified })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
