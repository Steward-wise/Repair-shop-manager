import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: quote, error } = await supabase
    .from('it_quotes')
    .select('*, client:support_clients(id, company_name, contact_name, contact_email)')
    .eq('id', id)
    .single()

  if (error || !quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const recipientEmail = quote.client?.contact_email ?? null
  if (!recipientEmail) return NextResponse.json({ error: 'No client email on record' }, { status: 400 })

  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com'
  const fromName = process.env.RESEND_FROM_NAME ?? shopName
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const quoteUrl = `${appUrl}/it-quote/${quote.quote_token}`

  const vatRate = quote.vat_rate ?? 20
  const itemRows = (quote.items as { description: string; quantity: number; unit_price: number }[])
    .map(
      (i) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #3f3f46;color:#d4d4d8;">${i.description}</td><td style="padding:8px 12px;border-bottom:1px solid #3f3f46;text-align:center;color:#d4d4d8;">${i.quantity}</td><td style="padding:8px 12px;border-bottom:1px solid #3f3f46;text-align:right;color:#d4d4d8;">£${(i.unit_price).toFixed(2)}</td><td style="padding:8px 12px;border-bottom:1px solid #3f3f46;text-align:right;color:#d4d4d8;">£${(i.quantity * i.unit_price).toFixed(2)}</td></tr>`
    )
    .join('')

  const itemRowsText = (quote.items as { description: string; quantity: number; unit_price: number }[])
    .map((i) => `  ${i.description} x${i.quantity} — £${(i.quantity * i.unit_price).toFixed(2)}`)
    .join('\n')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:system-ui,sans-serif;color:#fafafa;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;">
  <tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr><td style="background:#18181b;border-radius:12px 12px 0 0;padding:32px 40px;border-bottom:2px solid #dc2626;">
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fafafa;"><span style="color:#dc2626;">&#9679;</span> ${shopName}</h1>
      <p style="margin:8px 0 0;color:#a1a1aa;font-size:14px;">IT Quote — ${quote.title}</p>
    </td></tr>
    <tr><td style="background:#18181b;padding:32px 40px;">
      <p style="color:#d4d4d8;font-size:15px;margin:0 0 20px;">Hi ${quote.client?.contact_name ?? 'there'},</p>
      <p style="color:#d4d4d8;font-size:15px;margin:0 0 24px;">Please find your quote below. You can review and accept it online using the button at the bottom of this email.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <thead><tr style="background:#27272a;">
          <th style="padding:10px 12px;text-align:left;color:#a1a1aa;font-size:12px;font-weight:600;text-transform:uppercase;">Description</th>
          <th style="padding:10px 12px;text-align:center;color:#a1a1aa;font-size:12px;font-weight:600;text-transform:uppercase;">Qty</th>
          <th style="padding:10px 12px;text-align:right;color:#a1a1aa;font-size:12px;font-weight:600;text-transform:uppercase;">Unit</th>
          <th style="padding:10px 12px;text-align:right;color:#a1a1aa;font-size:12px;font-weight:600;text-transform:uppercase;">Total</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#a1a1aa;font-size:13px;">Subtotal</td><td style="padding:8px 12px;text-align:right;color:#d4d4d8;">£${(quote.subtotal).toFixed(2)}</td></tr>
          <tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#a1a1aa;font-size:13px;">VAT (${vatRate}%)</td><td style="padding:8px 12px;text-align:right;color:#d4d4d8;">£${(quote.total - quote.subtotal).toFixed(2)}</td></tr>
          <tr style="background:#27272a;"><td colspan="3" style="padding:10px 12px;text-align:right;color:#fafafa;font-weight:700;font-size:15px;">Total</td><td style="padding:10px 12px;text-align:right;color:#fafafa;font-weight:700;font-size:15px;">£${(quote.total).toFixed(2)}</td></tr>
        </tfoot>
      </table>
      ${quote.valid_until ? `<p style="color:#a1a1aa;font-size:13px;margin:0 0 24px;">This quote is valid until <strong style="color:#d4d4d8;">${new Date(quote.valid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.</p>` : ''}
      ${quote.notes ? `<p style="color:#a1a1aa;font-size:14px;background:#27272a;padding:16px;border-radius:8px;margin:0 0 24px;">${quote.notes.replace(/\n/g, '<br>')}</p>` : ''}
      <p style="text-align:center;margin:0;">
        <a href="${quoteUrl}" style="display:inline-block;background:#dc2626;color:#fff;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">View & Accept Quote</a>
      </p>
    </td></tr>
    <tr><td style="background:#27272a;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
      <p style="margin:0;color:#71717a;font-size:13px;">&copy; ${new Date().getFullYear()} ${shopName}</p>
      <p style="margin:6px 0 0;color:#52525b;font-size:11px;">To keep our emails out of spam, add <strong>${fromEmail}</strong> to your contacts.</p>
    </td></tr>
  </table></td></tr>
</table></body></html>`

  const text = `IT Quote — ${quote.title}\n\n` +
    `Hi ${quote.client?.contact_name ?? 'there'},\n\n` +
    `Please find your quote below.\n\n` +
    `${itemRowsText}\n\n` +
    `Subtotal: £${(quote.subtotal).toFixed(2)}\n` +
    `VAT (${vatRate}%): £${(quote.total - quote.subtotal).toFixed(2)}\n` +
    `Total: £${(quote.total).toFixed(2)}\n\n` +
    (quote.valid_until ? `Valid until: ${new Date(quote.valid_until).toLocaleDateString('en-GB')}\n\n` : '') +
    (quote.notes ? `Notes: ${quote.notes}\n\n` : '') +
    `View and accept your quote at: ${quoteUrl}\n\n` +
    `— ${shopName}`

  if (!process.env.RESEND_API_KEY) {
    // Mark sent even without email in dev
    await supabase.from('it_quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id)
    return NextResponse.json({ ok: true, sent: false, reason: 'No RESEND_API_KEY' })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: emailError } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: recipientEmail,
    subject: `Your IT Quote — ${quote.title}`,
    html,
    text,
  })

  if (emailError) return NextResponse.json({ error: emailError.message }, { status: 500 })

  await supabase.from('it_quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id)
  return NextResponse.json({ ok: true, sent: true })
}
