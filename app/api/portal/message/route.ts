import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { sendCustomerMessageNotification } from '@/lib/resend'
import { formatTicketNumber } from '@/lib/utils'

export async function POST(request: NextRequest) {
  // Verify portal session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdminClient()

  try {
    const { job_id, message } = await request.json()
    if (!job_id || !message?.trim()) {
      return NextResponse.json({ error: 'job_id and message are required' }, { status: 400 })
    }

    // Verify this job belongs to this customer
    const { data: customer } = await admin
      .from('customers')
      .select('id, name')
      .eq('email', user.email)
      .single()

    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 403 })

    const { data: job } = await admin
      .from('jobs')
      .select('id, ticket_number, device_make, device_model, customer_id')
      .eq('id', job_id)
      .eq('customer_id', customer.id)
      .single()

    if (!job) return NextResponse.json({ error: 'Job not found or not authorised' }, { status: 403 })

    // Save to job_notes with source='customer'
    const { data: note, error: noteError } = await admin
      .from('job_notes')
      .insert({
        job_id,
        content: message.trim(),
        note_type: 'note',
        source: 'customer',
        staff_name: customer.name,
      })
      .select()
      .single()

    if (noteError) return NextResponse.json({ error: noteError.message }, { status: 500 })

    // Notify staff by email (fire-and-forget)
    const staffEmail = process.env.REORDER_ALERT_EMAIL ?? process.env.RESEND_FROM_EMAIL
    if (staffEmail) {
      sendCustomerMessageNotification({
        staffEmail,
        customerName: customer.name,
        ticketNumber: formatTicketNumber(job.ticket_number),
        deviceInfo: `${job.device_make} ${job.device_model}`,
        message: message.trim(),
        jobId: job_id,
      }).catch(() => null)
    }

    return NextResponse.json({ note }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
