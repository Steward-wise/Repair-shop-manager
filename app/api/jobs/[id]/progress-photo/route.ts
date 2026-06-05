import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendProgressUpdate } from '@/lib/resend'
import { formatTicketNumber } from '@/lib/utils'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  try {
    const { photo_url, caption, message } = await request.json()
    if (!photo_url) return NextResponse.json({ error: 'photo_url required' }, { status: 400 })

    // Load job + customer
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*, customer:customers(id,name,email)')
      .eq('id', id)
      .single()
    if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    // Save photo record
    const { data: photo } = await supabase
      .from('job_photos')
      .insert({ job_id: id, url: photo_url, photo_type: 'repair', caption: caption || null })
      .select()
      .single()

    // Log to notes timeline
    await supabase.from('job_notes').insert({
      job_id: id,
      content: `Progress photo sent to customer${caption ? `: "${caption}"` : ''}`,
      note_type: 'note',
      source: 'staff',
      meta: { photo_url, has_message: !!message },
    })

    // Email customer if they have an email
    const customer = job.customer as { id: string; name: string; email: string | null } | null
    let emailSent = false
    if (customer?.email) {
      emailSent = await sendProgressUpdate({
        to: customer.email,
        customerId: customer.id,
        customerName: customer.name,
        ticketNumber: formatTicketNumber(job.ticket_number),
        deviceInfo: `${job.device_make} ${job.device_model}`,
        caption: caption || null,
        message: message || null,
        photoUrl: photo_url,
      })
    }

    return NextResponse.json({ photo, email_sent: emailSent }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
