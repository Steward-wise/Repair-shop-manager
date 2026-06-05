import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = `${process.env.RESEND_FROM_NAME ?? 'Repair Shop'} <${process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com'}>`
const SHOP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
const SHOP_PHONE = process.env.NEXT_PUBLIC_SHOP_PHONE ?? ''

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

function unsubscribeUrl(customerId: string) {
  return `${appUrl()}/api/unsubscribe?cid=${customerId}`
}

function listUnsubscribeHeaders(customerId: string) {
  const url = unsubscribeUrl(customerId)
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com'
  return {
    'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>, <${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

function emailShell(title: string, bodyHtml: string, unsubUrl?: string) {
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com'
  const unsubFooter = unsubUrl
    ? `<p style="margin:8px 0 0;color:#52525b;font-size:12px;">Don&apos;t want these emails? <a href="${unsubUrl}" style="color:#71717a;">Unsubscribe</a></p>`
    : ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:system-ui,sans-serif;color:#fafafa;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;">
  <tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr><td style="background:#18181b;border-radius:12px 12px 0 0;padding:32px 40px;border-bottom:2px solid #dc2626;">
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fafafa;"><span style="color:#dc2626;">&#9679;</span> ${SHOP_NAME}</h1>
      <p style="margin:8px 0 0;color:#a1a1aa;font-size:14px;">${title}</p>
    </td></tr>
    <tr><td style="background:#18181b;padding:32px 40px;">${bodyHtml}</td></tr>
    <tr><td style="background:#27272a;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
      <p style="margin:0;color:#71717a;font-size:13px;">&copy; ${new Date().getFullYear()} ${SHOP_NAME}</p>
      <p style="margin:6px 0 0;color:#52525b;font-size:11px;">To keep our emails out of spam, add <strong>${fromEmail}</strong> to your contacts.</p>
      ${unsubFooter}
    </td></tr>
  </table></td></tr>
</table></body></html>`
}

export async function sendTechnicianAssignment(
  to: string,
  techName: string,
  ticketRef: string,
  ticketTitle: string,
  ticketUrl: string,
  priority: string | null,
  contactName: string | null,
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !to) return false
  const priorityLabel = priority ? `P${priority.replace('p', '')}` : 'None'
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#a1a1aa;">Hi ${techName},</p>
    <p style="margin:0 0 24px;font-size:16px;color:#fafafa;line-height:1.6;">A support ticket has been assigned to you.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#27272a;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td style="padding:8px 0;"><span style="color:#a1a1aa;font-size:14px;">Ticket</span><span style="float:right;color:#fafafa;font-family:monospace;font-weight:600;">${ticketRef}</span></td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Title</span><span style="float:right;color:#fafafa;">${ticketTitle}</span></td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Priority</span><span style="float:right;color:#fafafa;">${priorityLabel}</span></td></tr>
      ${contactName ? `<tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Contact</span><span style="float:right;color:#fafafa;">${contactName}</span></td></tr>` : ''}
    </table>
    <a href="${ticketUrl}" style="display:inline-block;background:#dc2626;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">View Ticket →</a>`

  try {
    const { error } = await resend.emails.send({
      from: FROM, to,
      subject: `Ticket assigned to you — ${ticketRef}: ${ticketTitle}`,
      html: emailShell('Ticket Assigned', body),
    })
    if (error) { console.error('Tech assignment email error:', error); return false }
    return true
  } catch { return false }
}

export async function sendReorderAlert(
  items: { part_name: string; sku: string | null; quantity: number; reorder_threshold: number; supplier: string | null }[]
): Promise<boolean> {
  const to = process.env.REORDER_ALERT_EMAIL
  if (!process.env.RESEND_API_KEY || !to) {
    console.warn('Resend or REORDER_ALERT_EMAIL not set — skipping reorder alert')
    return false
  }

  const rows = items.map((i) => `
    <tr>
      <td style="padding:10px 12px;color:#fafafa;border-bottom:1px solid #3f3f46;">${i.part_name}</td>
      <td style="padding:10px 12px;color:#a1a1aa;border-bottom:1px solid #3f3f46;font-family:monospace;">${i.sku ?? '—'}</td>
      <td style="padding:10px 12px;color:#f87171;border-bottom:1px solid #3f3f46;text-align:center;font-weight:700;">${i.quantity}</td>
      <td style="padding:10px 12px;color:#a1a1aa;border-bottom:1px solid #3f3f46;text-align:center;">${i.reorder_threshold}</td>
      <td style="padding:10px 12px;color:#a1a1aa;border-bottom:1px solid #3f3f46;">${i.supplier ?? '—'}</td>
    </tr>`).join('')

  const body = `
    <p style="margin:0 0 20px;color:#fafafa;font-size:16px;">${items.length} part${items.length > 1 ? 's are' : ' is'} running low and need reordering.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#27272a;border-radius:8px;overflow:hidden;">
      <thead><tr style="background:#3f3f46;">
        <th style="padding:10px 12px;text-align:left;color:#a1a1aa;font-size:13px;">Part</th>
        <th style="padding:10px 12px;text-align:left;color:#a1a1aa;font-size:13px;">SKU</th>
        <th style="padding:10px 12px;text-align:center;color:#a1a1aa;font-size:13px;">In Stock</th>
        <th style="padding:10px 12px;text-align:center;color:#a1a1aa;font-size:13px;">Threshold</th>
        <th style="padding:10px 12px;text-align:left;color:#a1a1aa;font-size:13px;">Supplier</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`

  try {
    const { error } = await resend.emails.send({
      from: FROM, to,
      subject: `${SHOP_NAME} — Low Stock Alert: ${items.length} part${items.length > 1 ? 's' : ''} need reordering`,
      html: emailShell('Low Stock Alert', body),
    })
    if (error) { console.error('Resend reorder error:', error); return false }
    return true
  } catch (err) {
    console.error('Reorder alert send failed:', err)
    return false
  }
}

export async function sendPurchaseOrder(
  poRef: string,
  supplier: string,
  supplierEmail: string,
  items: { part_name: string; sku: string | null; quantity_to_order: number; cost_price: number | null }[]
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('Resend not set — skipping PO email')
    return false
  }

  const rows = items.map((i) => `
    <tr>
      <td style="padding:10px 12px;color:#fafafa;border-bottom:1px solid #3f3f46;">${i.part_name}</td>
      <td style="padding:10px 12px;color:#a1a1aa;border-bottom:1px solid #3f3f46;font-family:monospace;">${i.sku ?? '—'}</td>
      <td style="padding:10px 12px;color:#fafafa;border-bottom:1px solid #3f3f46;text-align:center;font-weight:700;">${i.quantity_to_order}</td>
      <td style="padding:10px 12px;color:#a1a1aa;border-bottom:1px solid #3f3f46;text-align:right;">${i.cost_price != null ? `£${i.cost_price.toFixed(2)}` : '—'}</td>
    </tr>`).join('')

  const body = `
    <p style="margin:0 0 4px;color:#a1a1aa;font-size:13px;">Purchase Order</p>
    <p style="margin:0 0 20px;color:#fafafa;font-size:22px;font-weight:700;font-family:monospace;">${poRef}</p>
    <p style="margin:0 0 20px;color:#fafafa;">Please supply the following items to <strong>${SHOP_NAME}</strong>:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#27272a;border-radius:8px;overflow:hidden;">
      <thead><tr style="background:#3f3f46;">
        <th style="padding:10px 12px;text-align:left;color:#a1a1aa;font-size:13px;">Part</th>
        <th style="padding:10px 12px;text-align:left;color:#a1a1aa;font-size:13px;">SKU</th>
        <th style="padding:10px 12px;text-align:center;color:#a1a1aa;font-size:13px;">Qty</th>
        <th style="padding:10px 12px;text-align:right;color:#a1a1aa;font-size:13px;">Unit Cost</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${SHOP_PHONE ? `<p style="margin:20px 0 0;color:#a1a1aa;font-size:14px;">Questions? Call <a href="tel:${SHOP_PHONE}" style="color:#dc2626;">${SHOP_PHONE}</a></p>` : ''}`

  try {
    const { error } = await resend.emails.send({
      from: FROM, to: supplierEmail,
      subject: `Purchase Order ${poRef} from ${SHOP_NAME}`,
      html: emailShell(`Purchase Order from ${SHOP_NAME}`, body),
    })
    if (error) { console.error('Resend PO error:', error); return false }
    return true
  } catch (err) {
    console.error('PO send failed:', err)
    return false
  }
}

export async function sendStatusEmail(
  to: string,
  customerId: string,
  customerName: string,
  ticketNumber: string,
  statusMessage: string,
  deviceLabel: string
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('Resend API key not set — skipping email')
    return false
  }

  const unsubUrl = unsubscribeUrl(customerId)

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;color:#a1a1aa;">Hi ${customerName},</p>
    <p style="margin:0 0 24px;font-size:18px;color:#fafafa;line-height:1.6;">${statusMessage}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#27272a;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr>
        <td style="padding:8px 0;">
          <span style="color:#a1a1aa;font-size:14px;">Ticket</span>
          <span style="float:right;color:#fafafa;font-weight:600;font-family:monospace;">${ticketNumber}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-top:1px solid #3f3f46;">
          <span style="color:#a1a1aa;font-size:14px;">Device</span>
          <span style="float:right;color:#fafafa;">${deviceLabel}</span>
        </td>
      </tr>
    </table>
    ${SHOP_PHONE ? `<p style="margin:0;color:#a1a1aa;font-size:14px;">Questions? Call us on <a href="tel:${SHOP_PHONE}" style="color:#dc2626;">${SHOP_PHONE}</a></p>` : ''}`

  const textBody = [
    `Hi ${customerName},`,
    '',
    statusMessage,
    '',
    `Ticket: ${ticketNumber}`,
    `Device: ${deviceLabel}`,
    SHOP_PHONE ? `Questions? Call us on ${SHOP_PHONE}` : '',
    '',
    `To keep our emails out of spam, add ${process.env.RESEND_FROM_EMAIL ?? ''} to your contacts.`,
    unsubUrl ? `Unsubscribe: ${unsubUrl}` : '',
  ].filter(l => l !== undefined).join('\n').trim()

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `Your repair update — ${ticketNumber}`,
      html: emailShell('Repair Update', bodyHtml, unsubUrl),
      text: textBody,
      headers: listUnsubscribeHeaders(customerId),
    })
    if (error) { console.error('Resend error:', error); return false }
    return true
  } catch (err) {
    console.error('Email send failed:', err)
    return false
  }
}

export async function sendQuoteToCustomer(
  to: string,
  customerName: string,
  deviceInfo: string,
  problemDescription: string,
  price: number,
  priceNotes: string | null,
  acceptUrl: string,
  declineUrl: string
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const priceStr = `£${price.toFixed(2)}`
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#a1a1aa;">Hi ${customerName},</p>
    <p style="margin:0 0 24px;font-size:16px;color:#fafafa;line-height:1.6;">Thank you for your enquiry. Here is our repair estimate:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#27272a;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td style="padding:8px 0;"><span style="color:#a1a1aa;font-size:14px;">Device</span><span style="float:right;color:#fafafa;">${deviceInfo}</span></td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Estimated Cost</span><span style="float:right;color:#fafafa;font-weight:700;font-size:18px;">${priceStr}</span></td></tr>
      ${priceNotes ? `<tr><td style="padding:6px 0 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:12px;">${priceNotes}</span></td></tr>` : ''}
    </table>
    <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;">To accept this quote and book your appointment, click below:</p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr>
      <td style="padding-right:12px;"><a href="${acceptUrl}" style="display:inline-block;background:#dc2626;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Accept &amp; Book Appointment</a></td>
      <td><a href="${declineUrl}" style="display:inline-block;background:#27272a;color:#a1a1aa;padding:12px 20px;border-radius:8px;text-decoration:none;font-size:14px;border:1px solid #3f3f46;">No thanks</a></td>
    </tr></table>
    ${SHOP_PHONE ? `<p style="margin:0;color:#a1a1aa;font-size:14px;">Questions? Call <a href="tel:${SHOP_PHONE}" style="color:#dc2626;">${SHOP_PHONE}</a></p>` : ''}`
  const text = [
    `Hi ${customerName},`,
    '',
    `Thank you for your enquiry. Here is our repair estimate for your ${deviceInfo}:`,
    '',
    `Estimated Cost: £${price.toFixed(2)}`,
    priceNotes ? `Notes: ${priceNotes}` : '',
    '',
    `Accept & book your appointment: ${acceptUrl}`,
    `No thanks: ${declineUrl}`,
    '',
    SHOP_PHONE ? `Questions? Call ${SHOP_PHONE}` : '',
    `To keep our emails out of spam, add ${process.env.RESEND_FROM_EMAIL ?? ''} to your contacts.`,
  ].filter(Boolean).join('\n').trim()

  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject: `Your repair quote from ${SHOP_NAME}`, html: emailShell('Your Repair Quote', body), text })
    if (error) { console.error('Quote email error:', error); return false }
    return true
  } catch { return false }
}

export async function sendAppointmentConfirmation(
  to: string, customerName: string, deviceInfo: string, dateStr: string, timeStr: string,
  rescheduleToken?: string
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const rescheduleUrl = rescheduleToken ? `${appUrl()}/reschedule/${rescheduleToken}` : null
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#a1a1aa;">Hi ${customerName},</p>
    <p style="margin:0 0 24px;font-size:16px;color:#fafafa;line-height:1.6;">Your appointment is confirmed. Please bring your device at the time below.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#27272a;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td style="padding:8px 0;"><span style="color:#a1a1aa;font-size:14px;">Device</span><span style="float:right;color:#fafafa;">${deviceInfo}</span></td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Date</span><span style="float:right;color:#fafafa;font-weight:600;">${dateStr}</span></td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Time</span><span style="float:right;color:#fafafa;font-weight:600;">${timeStr}</span></td></tr>
    </table>
    ${rescheduleUrl ? `<p style="margin:0 0 16px;color:#a1a1aa;font-size:13px;">Need to change your appointment? You can reschedule up to 24 hours before your appointment time: <a href="${rescheduleUrl}" style="color:#dc2626;">Reschedule appointment</a></p>` : ''}
    ${SHOP_PHONE ? `<p style="margin:0;color:#a1a1aa;font-size:14px;">Questions? Call <a href="tel:${SHOP_PHONE}" style="color:#dc2626;">${SHOP_PHONE}</a></p>` : ''}`
  const text = [
    `Hi ${customerName},`,
    '',
    'Your appointment is confirmed. Please bring your device at the time below.',
    '',
    `Device: ${deviceInfo}`,
    `Date: ${dateStr}`,
    `Time: ${timeStr}`,
    '',
    rescheduleUrl ? `Need to reschedule? (must be more than 24h before your appointment): ${rescheduleUrl}` : '',
    SHOP_PHONE ? `Questions? Call ${SHOP_PHONE}` : '',
    `To keep our emails out of spam, add ${process.env.RESEND_FROM_EMAIL ?? ''} to your contacts.`,
  ].filter(Boolean).join('\n').trim()

  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject: `Your appointment is confirmed — ${SHOP_NAME}`, html: emailShell('Appointment Confirmed', body), text })
    if (error) { console.error('Appt confirm error:', error); return false }
    return true
  } catch { return false }
}


export async function sendNewQuoteAlert(quote: {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string | null
  device_type?: string | null
  device_make_model?: string | null
  problem_description: string
  suggested_price?: number | null
}): Promise<boolean> {
  const to = process.env.REORDER_ALERT_EMAIL ?? process.env.RESEND_FROM_EMAIL
  if (!process.env.RESEND_API_KEY || !to) return false

  const quoteUrl = `${appUrl()}/quotes/${quote.id}`
  const name = `${quote.first_name} ${quote.last_name}`
  const device = [quote.device_make_model, quote.device_type].filter(Boolean).join(' — ') || 'Not specified'

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#fafafa;font-weight:600;">New quote request received</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#27272a;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td style="padding:8px 0;"><span style="color:#a1a1aa;font-size:14px;">Customer</span><span style="float:right;color:#fafafa;font-weight:600;">${name}</span></td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Email</span><span style="float:right;color:#dc2626;">${quote.email}</span></td></tr>
      ${quote.phone ? `<tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Phone</span><span style="float:right;color:#fafafa;">${quote.phone}</span></td></tr>` : ''}
      <tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Device</span><span style="float:right;color:#fafafa;">${device}</span></td></tr>
      ${quote.suggested_price != null ? `<tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Suggested Price</span><span style="float:right;color:#22c55e;font-weight:600;">£${quote.suggested_price}</span></td></tr>` : ''}
    </table>
    <div style="background:#1a1a1a;border-left:3px solid #dc2626;border-radius:4px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#a1a1aa;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Problem Description</p>
      <p style="margin:0;color:#fafafa;font-size:14px;line-height:1.6;">${quote.problem_description}</p>
    </div>
    <a href="${quoteUrl}" style="display:inline-block;background:#dc2626;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">View & Respond to Quote →</a>`

  const text = [
    `New quote request from ${name}`,
    `Email: ${quote.email}`,
    quote.phone ? `Phone: ${quote.phone}` : '',
    `Device: ${device}`,
    `Problem: ${quote.problem_description}`,
    quote.suggested_price != null ? `Suggested price: £${quote.suggested_price}` : '',
    '',
    `View in dashboard: ${quoteUrl}`,
  ].filter(Boolean).join('\n')

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `New Quote Request — ${name} (${device})`,
      html: emailShell('New Quote Request', body),
      text,
    })
    if (error) { console.error('Quote alert error:', error); return false }
    return true
  } catch { return false }
}

export async function sendIntakeConfirmation({
  to,
  customerId,
  customerName,
  ticketNumber,
  deviceInfo,
  reportedFault,
  intakeMethod,
  intakeDate,
  quotedPrice,
  intakeSignatureUrl,
}: {
  to: string
  customerId: string
  customerName: string
  ticketNumber: string
  deviceInfo: string
  reportedFault: string
  intakeMethod: 'drop_off' | 'collection'
  intakeDate: string | null
  quotedPrice: number | null
  intakeSignatureUrl: string | null
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false

  const methodLabel = intakeMethod === 'collection' ? 'Collected by us' : 'Dropped off in store'
  const dateLabel = intakeDate
    ? new Date(intakeDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const signatureHtml = intakeSignatureUrl
    ? `<tr><td style="padding:12px 0;border-top:1px solid #3f3f46;" colspan="2">
        <p style="margin:0 0 8px;color:#a1a1aa;font-size:13px;">Customer signature</p>
        <img src="${intakeSignatureUrl}" alt="Customer signature" style="max-height:60px;background:white;padding:4px;border-radius:4px;" />
      </td></tr>`
    : ''

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#a1a1aa;">Hi ${customerName},</p>
    <p style="margin:0 0 24px;font-size:16px;color:#fafafa;line-height:1.6;">
      Thank you for choosing <strong>${SHOP_NAME}</strong>. We have received your device and your repair ticket is now open.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#27272a;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td style="padding:8px 0;"><span style="color:#a1a1aa;font-size:14px;">Ticket</span><span style="float:right;color:#fafafa;font-family:monospace;font-weight:600;">${ticketNumber}</span></td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Device</span><span style="float:right;color:#fafafa;">${deviceInfo}</span></td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Reported fault</span><span style="float:right;color:#fafafa;text-align:right;max-width:60%;">${reportedFault}</span></td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Received via</span><span style="float:right;color:#fafafa;">${methodLabel}</span></td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Date</span><span style="float:right;color:#fafafa;">${dateLabel}</span></td></tr>
      ${quotedPrice != null ? `<tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Estimated cost</span><span style="float:right;color:#fafafa;font-weight:600;">£${quotedPrice.toFixed(2)}</span></td></tr>` : ''}
      ${signatureHtml}
    </table>
    <p style="margin:0 0 8px;color:#a1a1aa;font-size:14px;line-height:1.6;">
      We will be in touch as soon as your repair is complete. Please keep your ticket number safe as you may need it to collect your device.
    </p>
    ${SHOP_PHONE ? `<p style="margin:0;color:#a1a1aa;font-size:14px;">Questions? Call us on <a href="tel:${SHOP_PHONE}" style="color:#dc2626;">${SHOP_PHONE}</a></p>` : ''}`

  const text = [
    `Hi ${customerName},`,
    '',
    `Thank you for choosing ${SHOP_NAME}. We have received your device and your repair ticket is now open.`,
    '',
    `Ticket: ${ticketNumber}`,
    `Device: ${deviceInfo}`,
    `Reported fault: ${reportedFault}`,
    `Received via: ${methodLabel}`,
    `Date: ${dateLabel}`,
    quotedPrice != null ? `Estimated cost: £${quotedPrice.toFixed(2)}` : '',
    '',
    'We will be in touch as soon as your repair is complete.',
    SHOP_PHONE ? `Questions? Call us on ${SHOP_PHONE}` : '',
  ].filter(Boolean).join('\n').trim()

  const unsubUrl = unsubscribeUrl(customerId)

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `Device received — Ticket ${ticketNumber} · ${SHOP_NAME}`,
      html: emailShell('Device Received', body, unsubUrl),
      text,
      headers: listUnsubscribeHeaders(customerId),
    })
    if (error) { console.error('Intake confirmation email error:', error); return false }
    return true
  } catch { return false }
}

export async function sendJobQuoteApproval({
  to, customerName, deviceInfo, fault, price, paymentUrl, ticketNumber, shopName,
}: {
  to: string
  customerName: string
  deviceInfo: string
  fault: string
  price: number
  paymentUrl: string
  ticketNumber: number
  shopName: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false

  const priceStr = `£${price.toFixed(2)}`
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#a1a1aa;">Hi ${customerName},</p>
    <p style="margin:0 0 24px;font-size:16px;color:#fafafa;line-height:1.6;">
      We've completed our diagnosis of your <strong>${deviceInfo}</strong> and your repair quote is ready.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#27272a;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td style="padding:8px 0;"><span style="color:#a1a1aa;font-size:14px;">Device</span><span style="float:right;color:#fafafa;">${deviceInfo}</span></td></tr>
      ${fault ? `<tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Fault</span><span style="float:right;color:#fafafa;">${fault}</span></td></tr>` : ''}
      <tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Repair Cost</span><span style="float:right;color:#22c55e;font-weight:700;font-size:18px;">${priceStr}</span></td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:14px;">Ticket</span><span style="float:right;color:#fafafa;font-family:monospace;">#${String(ticketNumber).padStart(4,'0')}</span></td></tr>
    </table>
    <p style="margin:0 0 20px;color:#a1a1aa;font-size:14px;line-height:1.6;">
      To approve this repair and confirm your booking, please click the button below to pay securely online.
      Your device will be prioritised for repair once payment is received.
    </p>
    <a href="${paymentUrl}" style="display:inline-block;background:#22c55e;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;margin-bottom:20px;">
      ✓ Approve &amp; Pay ${priceStr} →
    </a>
    <p style="margin:16px 0 0;color:#52525b;font-size:12px;">
      This payment link expires in 24 hours. If you have any questions, please contact us.
      ${SHOP_PHONE ? `Call us on <a href="tel:${SHOP_PHONE}" style="color:#dc2626;">${SHOP_PHONE}</a>.` : ''}
    </p>`

  const text = [
    `Hi ${customerName},`,
    '',
    `Your repair quote for ${deviceInfo} is ready.`,
    '',
    `Fault: ${fault}`,
    `Repair cost: ${priceStr}`,
    `Ticket: #${String(ticketNumber).padStart(4,'0')}`,
    '',
    `Approve and pay here: ${paymentUrl}`,
    '',
    SHOP_PHONE ? `Questions? Call ${SHOP_PHONE}` : '',
  ].filter(s => s !== undefined).join('\n').trim()

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `Your repair quote is ready — ${priceStr} · ${shopName}`,
      html: emailShell(`Repair Quote — ${priceStr}`, body),
      text,
    })
    if (error) { console.error('Quote approval email error:', error); return false }
    return true
  } catch { return false }
}

export async function sendProgressUpdate({
  to, customerId, customerName, ticketNumber, deviceInfo, caption, message, photoUrl,
}: {
  to: string
  customerId: string
  customerName: string
  ticketNumber: string
  deviceInfo: string
  caption: string | null
  message: string | null
  photoUrl: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const unsubUrl = unsubscribeUrl(customerId)

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#a1a1aa;">Hi ${customerName},</p>
    <p style="margin:0 0 20px;font-size:16px;color:#fafafa;line-height:1.6;">
      We have an update on your repair. Here is a photo from our technician.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#27272a;border-radius:8px;padding:16px;margin-bottom:20px;">
      <tr><td style="padding:4px 0;"><span style="color:#a1a1aa;font-size:13px;">Ticket</span><span style="float:right;color:#fafafa;font-family:monospace;font-weight:600;">${ticketNumber}</span></td></tr>
      <tr><td style="padding:4px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:13px;">Device</span><span style="float:right;color:#fafafa;">${deviceInfo}</span></td></tr>
    </table>
    <img src="${photoUrl}" alt="Repair progress photo" style="width:100%;max-width:480px;border-radius:8px;display:block;margin-bottom:16px;" />
    ${caption ? `<p style="margin:0 0 12px;color:#a1a1aa;font-size:14px;font-style:italic;">${caption}</p>` : ''}
    ${message ? `<p style="margin:0 0 16px;color:#fafafa;font-size:15px;line-height:1.6;">${message}</p>` : ''}
    ${SHOP_PHONE ? `<p style="margin:0;color:#a1a1aa;font-size:14px;">Questions? Call us on <a href="tel:${SHOP_PHONE}" style="color:#dc2626;">${SHOP_PHONE}</a></p>` : ''}`

  try {
    const { error } = await resend.emails.send({
      from: FROM, to,
      subject: `Repair update — ${ticketNumber} · ${SHOP_NAME}`,
      html: emailShell('Repair Update', body, unsubUrl),
      headers: listUnsubscribeHeaders(customerId),
    })
    if (error) { console.error('Progress update email error:', error); return false }
    return true
  } catch { return false }
}

export async function sendCustomerMessageNotification({
  staffEmail, customerName, ticketNumber, deviceInfo, message, jobId,
}: {
  staffEmail: string
  customerName: string
  ticketNumber: string
  deviceInfo: string
  message: string
  jobId: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const jobUrl = `${appUrl()}/jobs/${jobId}`

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#fafafa;font-weight:600;">New message from customer</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#27272a;border-radius:8px;padding:16px;margin-bottom:20px;">
      <tr><td style="padding:4px 0;"><span style="color:#a1a1aa;font-size:13px;">Customer</span><span style="float:right;color:#fafafa;font-weight:600;">${customerName}</span></td></tr>
      <tr><td style="padding:4px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:13px;">Ticket</span><span style="float:right;color:#fafafa;font-family:monospace;">${ticketNumber}</span></td></tr>
      <tr><td style="padding:4px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:13px;">Device</span><span style="float:right;color:#fafafa;">${deviceInfo}</span></td></tr>
    </table>
    <div style="background:#1a1a1a;border-left:3px solid #dc2626;border-radius:4px;padding:14px;margin-bottom:20px;">
      <p style="margin:0;color:#fafafa;font-size:15px;line-height:1.6;">${message}</p>
    </div>
    <a href="${jobUrl}" style="display:inline-block;background:#dc2626;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View Job & Reply →</a>`

  try {
    const { error } = await resend.emails.send({
      from: FROM, to: staffEmail,
      subject: `Customer message — ${ticketNumber} (${customerName})`,
      html: emailShell('Customer Message', body),
    })
    if (error) { console.error('Customer message notify error:', error); return false }
    return true
  } catch { return false }
}
