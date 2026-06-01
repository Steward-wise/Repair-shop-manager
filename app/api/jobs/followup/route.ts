import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dry_run') === 'true'

  // Query jobs that are 'ready', no followup sent, and created >3 days ago
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, ticket_number, device_make, device_model, customer:customers(id, name, email, marketing_consent)')
    .eq('status', 'ready')
    .is('followup_sent_at', null)
    .lt('created_at', threeDaysAgo)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const eligibleJobs = (jobs ?? []).filter(
    (j: { customer: { email: string | null; marketing_consent: boolean } | null }) =>
      j.customer?.email && j.customer?.marketing_consent
  )

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      would_send: eligibleJobs.length,
      jobs: eligibleJobs.map((j: { ticket_number: number; device_make: string; device_model: string; customer: { name: string; email: string | null } | null }) => ({
        ticket: j.ticket_number,
        customer: j.customer?.name,
        email: j.customer?.email,
      })),
    })
  }

  if (eligibleJobs.length === 0) return NextResponse.json({ sent: 0 })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
  const fromAddress = `${process.env.RESEND_FROM_NAME ?? shopName} <${process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com'}>`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  let sent = 0

  for (const job of eligibleJobs as Array<{
    id: string
    ticket_number: number
    device_make: string
    device_model: string
    customer: { id: string; name: string; email: string | null; marketing_consent: boolean } | null
  }>) {
    if (!job.customer?.email) continue

    const unsubUrl = `${appUrl}/api/unsubscribe?cid=${job.customer.id}`
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com'

    try {
      await resend.emails.send({
        from: fromAddress,
        to: job.customer.email,
        subject: `Your repair is ready to collect - Ticket #${job.ticket_number}`,
        headers: {
          'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>, <${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #111;">Your device is ready to collect!</h2>
            <p>Hi ${job.customer.name},</p>
            <p>Just a reminder that your <strong>${job.device_make} ${job.device_model}</strong> (Ticket #${job.ticket_number}) has been repaired and is waiting for you to collect.</p>
            <p>Please pop in soon so we can get it back to you.</p>
            <p>
              <a href="${appUrl}/track/${job.ticket_number}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
                Track your repair
              </a>
            </p>
            <p style="color:#888;font-size:13px;">Thank you for choosing ${shopName}.</p>
            <p style="color:#bbb;font-size:11px;margin-top:24px;">Don't want these emails? <a href="${unsubUrl}" style="color:#999;">Unsubscribe</a></p>
          </div>
        `,
      })

      await supabase
        .from('jobs')
        .update({ followup_sent_at: new Date().toISOString() })
        .eq('id', job.id)

      sent++
    } catch {
      // continue sending to others even if one fails
    }
  }

  return NextResponse.json({ sent })
}
