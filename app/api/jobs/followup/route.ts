import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendStatusEmail } from '@/lib/resend'
import { formatTicketNumber } from '@/lib/utils'

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dry_run') === 'true'

  // Read configurable reminder days from app_settings (default 3)
  const { data: settingRow } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'ready_reminder_days')
    .single()
  const reminderDays = parseInt(settingRow?.value ?? '3', 10) || 3

  const cutoff = new Date(Date.now() - reminderDays * 24 * 60 * 60 * 1000).toISOString()

  // Jobs that are 'ready', no followup sent, and older than cutoff
  // NOTE: Ready-for-collection is a TRANSACTIONAL notification under UK PECR —
  // it serves the contract of repair, so no marketing_consent check is required.
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, ticket_number, device_make, device_model, customer:customers(id, name, email)')
    .eq('status', 'ready')
    .is('followup_sent_at', null)
    .lt('updated_at', cutoff)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const eligibleJobs = (jobs ?? []).filter(
    (j: { customer: { email: string | null } | null }) => j.customer?.email
  )

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      reminder_days: reminderDays,
      would_send: eligibleJobs.length,
      jobs: eligibleJobs.map((j: { ticket_number: number; device_make: string; device_model: string; customer: { name: string; email: string | null } | null }) => ({
        ticket: j.ticket_number,
        customer: j.customer?.name,
        email: j.customer?.email,
      })),
    })
  }

  if (eligibleJobs.length === 0) return NextResponse.json({ sent: 0, reminder_days: reminderDays })

  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
  let sent = 0

  for (const job of eligibleJobs as Array<{
    id: string
    ticket_number: number
    device_make: string
    device_model: string
    customer: { id: string; name: string; email: string | null } | null
  }>) {
    if (!job.customer?.email) continue

    try {
      const ok = await sendStatusEmail(
        job.customer.email,
        job.customer.id,
        job.customer.name,
        formatTicketNumber(job.ticket_number),
        `Your ${job.device_make} ${job.device_model} has been repaired and is ready to collect from ${shopName}. Please pop in at your earliest convenience.`,
        `${job.device_make} ${job.device_model}`,
      )

      if (ok) {
        await supabase
          .from('jobs')
          .update({ followup_sent_at: new Date().toISOString() })
          .eq('id', job.id)

        await supabase.from('job_notes').insert({
          job_id: job.id,
          content: `Ready-to-collect reminder sent to ${job.customer.email}`,
          note_type: 'note',
          source: 'system',
        })

        sent++
      }
    } catch {
      // continue sending to others even if one fails
    }
  }

  return NextResponse.json({ sent, reminder_days: reminderDays })
}
