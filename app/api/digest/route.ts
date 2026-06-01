import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export async function POST() {
  const supabase = createAdminClient()
  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
  const toEmail = process.env.DIGEST_EMAIL ?? process.env.RESEND_FROM_EMAIL
  const fromAddress = `${process.env.RESEND_FROM_NAME ?? shopName} <${process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com'}>`

  if (!toEmail) return NextResponse.json({ error: 'No digest email configured' }, { status: 500 })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const [
    { data: inProgressJobs },
    { data: readyJobs },
    { data: collectedToday },
    { data: yesterdayPaid },
    { data: lowStock },
  ] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, ticket_number, device_make, device_model, created_at, customer:customers(name)')
      .in('status', ['intake', 'diagnosed', 'in_progress', 'waiting_parts']),
    supabase
      .from('jobs')
      .select('id, ticket_number, device_make, device_model, created_at, customer:customers(name)')
      .eq('status', 'ready'),
    supabase
      .from('jobs')
      .select('id, ticket_number, final_price')
      .eq('status', 'collected')
      .gte('collected_at', today.toISOString()),
    supabase
      .from('jobs')
      .select('final_price')
      .eq('payment_status', 'paid')
      .gte('updated_at', yesterday.toISOString())
      .lt('updated_at', today.toISOString()),
    supabase
      .from('inventory')
      .select('part_name, quantity, reorder_threshold')
      .filter('quantity', 'lte', 'reorder_threshold'),
  ])

  const yesterdayRevenue = (yesterdayPaid ?? []).reduce(
    (sum: number, j: { final_price: number | null }) => sum + (j.final_price ?? 0), 0
  )

  function jobRow(j: { ticket_number: number; device_make: string; device_model: string; created_at?: string; customer?: { name: string } | null }) {
    const daysWaiting = j.created_at
      ? Math.floor((Date.now() - new Date(j.created_at).getTime()) / 86400000)
      : null
    return `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">#${j.ticket_number}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${(j.customer as { name: string } | null)?.name ?? 'Walk-in'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${j.device_make} ${j.device_model}</td>
        ${daysWaiting !== null ? `<td style="padding:6px 8px;border-bottom:1px solid #eee;">${daysWaiting}d</td>` : ''}
      </tr>`
  }

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
      <h1 style="font-size:20px;margin-bottom:4px;">${shopName} — Daily Digest</h1>
      <p style="color:#888;font-size:13px;margin-top:0;">${dateLabel}</p>

      <h2 style="font-size:15px;margin-top:24px;padding-bottom:6px;border-bottom:2px solid #111;">In Progress (${(inProgressJobs ?? []).length} jobs)</h2>
      ${(inProgressJobs ?? []).length > 0 ? `
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f5f5f5;">
            <th style="text-align:left;padding:6px 8px;">Ticket</th>
            <th style="text-align:left;padding:6px 8px;">Customer</th>
            <th style="text-align:left;padding:6px 8px;">Device</th>
            <th style="text-align:left;padding:6px 8px;">Age</th>
          </tr></thead>
          <tbody>${(inProgressJobs ?? []).map(jobRow).join('')}</tbody>
        </table>` : '<p style="color:#888;font-size:13px;">None</p>'}

      <h2 style="font-size:15px;margin-top:24px;padding-bottom:6px;border-bottom:2px solid #111;">Ready to Collect (${(readyJobs ?? []).length} jobs)</h2>
      ${(readyJobs ?? []).length > 0 ? `
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f5f5f5;">
            <th style="text-align:left;padding:6px 8px;">Ticket</th>
            <th style="text-align:left;padding:6px 8px;">Customer</th>
            <th style="text-align:left;padding:6px 8px;">Device</th>
            <th style="text-align:left;padding:6px 8px;">Waiting</th>
          </tr></thead>
          <tbody>${(readyJobs ?? []).map(jobRow).join('')}</tbody>
        </table>` : '<p style="color:#888;font-size:13px;">None</p>'}

      <h2 style="font-size:15px;margin-top:24px;padding-bottom:6px;border-bottom:2px solid #111;">Collected Today (${(collectedToday ?? []).length} jobs)</h2>
      ${(collectedToday ?? []).length > 0 ? `
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f5f5f5;">
            <th style="text-align:left;padding:6px 8px;">Ticket</th>
            <th style="text-align:right;padding:6px 8px;">Amount</th>
          </tr></thead>
          <tbody>${(collectedToday ?? []).map((j: { ticket_number: number; final_price: number | null }) => `
            <tr>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">#${j.ticket_number}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${j.final_price != null ? '£' + j.final_price.toFixed(2) : '—'}</td>
            </tr>`).join('')}</tbody>
        </table>` : '<p style="color:#888;font-size:13px;">None</p>'}

      <h2 style="font-size:15px;margin-top:24px;padding-bottom:6px;border-bottom:2px solid #111;">Yesterday&apos;s Revenue</h2>
      <p style="font-size:24px;font-weight:bold;color:#111;">£${yesterdayRevenue.toFixed(2)}</p>

      ${(lowStock ?? []).length > 0 ? `
        <h2 style="font-size:15px;margin-top:24px;padding-bottom:6px;border-bottom:2px solid #e22;">Low Stock Alert (${(lowStock ?? []).length} items)</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#fff3f3;">
            <th style="text-align:left;padding:6px 8px;">Part</th>
            <th style="text-align:right;padding:6px 8px;">Qty</th>
            <th style="text-align:right;padding:6px 8px;">Threshold</th>
          </tr></thead>
          <tbody>${(lowStock ?? []).map((i: { part_name: string; quantity: number; reorder_threshold: number }) => `
            <tr>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">${i.part_name}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;color:#c00;">${i.quantity}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${i.reorder_threshold}</td>
            </tr>`).join('')}</tbody>
        </table>` : ''}

      <p style="color:#aaa;font-size:11px;margin-top:32px;border-top:1px solid #eee;padding-top:12px;">
        Sent by ${shopName} daily digest system
      </p>
    </div>
  `

  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    await resend.emails.send({
      from: fromAddress,
      to: toEmail,
      subject: `Daily Digest — ${dateLabel} — ${shopName}`,
      html,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ sent: true })
}
