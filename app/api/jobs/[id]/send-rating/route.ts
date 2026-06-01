import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  // Fetch job with customer
  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, ticket_number, device_make, device_model, rating_token, customer:customers(id, name, email, marketing_consent)')
    .eq('id', id)
    .single()

  if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const customer = job.customer as { name: string; email: string | null } | null
  if (!customer?.email) return NextResponse.json({ error: 'Customer has no email' }, { status: 400 })

  let token: string = job.rating_token

  if (!token) {
    // Create a new rating record and store token on job
    token = crypto.randomUUID()

    const { error: insertErr } = await supabase.from('job_ratings').insert({
      job_id: id,
      rating: 1, // placeholder — overwritten on actual submission
      token,
    })

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    await supabase.from('jobs').update({ rating_token: token }).eq('id', id)
  }

  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const fromAddress = `${process.env.RESEND_FROM_NAME ?? shopName} <${process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com'}>`
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com'
  const rateUrl = `${appUrl}/rate/${token}`

  const customerRecord = job.customer as { id: string; name: string; email: string | null } | null
  const unsubUrl = `${appUrl}/api/unsubscribe?cid=${customerRecord?.id}`

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    await resend.emails.send({
      from: fromAddress,
      to: customer.email,
      subject: `How did we do? — ${shopName}`,
      headers: {
        'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>, <${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      text: [
        `Hi ${customer.name},`,
        '',
        `We recently repaired your ${job.device_make} ${job.device_model} (Ticket #${job.ticket_number}). We'd love to hear how we did!`,
        '',
        `Leave your review here: ${rateUrl}`,
        '',
        `Thank you for choosing ${shopName}.`,
        `To keep our emails out of spam, add ${fromEmail} to your contacts.`,
        `Don't want these emails? Unsubscribe: ${unsubUrl}`,
      ].join('\n'),
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #111;">How did we do?</h2>
          <p>Hi ${customer.name},</p>
          <p>We recently repaired your <strong>${job.device_make} ${job.device_model}</strong> (Ticket #${job.ticket_number}). We&apos;d love to hear how we did!</p>
          <p style="margin: 24px 0;">
            <a href="${rateUrl}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
              Rate your experience ★
            </a>
          </p>
          <p style="color:#888;font-size:13px;">Thank you for choosing ${shopName}.</p>
          <p style="color:#aaa;font-size:11px;margin-top:16px;">To keep our emails out of spam, add ${fromEmail} to your contacts.</p>
          <p style="color:#bbb;font-size:11px;margin-top:8px;">Don't want these emails? <a href="${unsubUrl}" style="color:#999;">Unsubscribe</a></p>
        </div>
      `,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ sent: true })
}
