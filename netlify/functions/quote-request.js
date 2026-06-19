const { createClient } = require('@supabase/supabase-js')

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) }
  }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { first_name, last_name, email, phone, device_type, device_make_model, problem_description, marketing_consent } = body

  if (!first_name || !last_name || !email || !problem_description) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing required fields' }) }
  }

  // Support both naming conventions for the Supabase env vars
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars')
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Server configuration error' }) }
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Auto-match quote rules
  const { data: rules } = await supabase.from('quote_rules').select('*').eq('is_active', true).order('sort_order')
  let suggested_price = null, matched_rule_id = null

  if (rules?.length) {
    const text = `${device_type ?? ''} ${device_make_model ?? ''} ${problem_description}`.toLowerCase()
    let bestScore = 0
    for (const rule of rules) {
      let score = 0
      if (rule.device_type && device_type && device_type.toLowerCase().includes(rule.device_type.toLowerCase())) score += 10
      if (rule.keywords) {
        for (const kw of rule.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)) {
          if (text.includes(kw)) score += 5
        }
      }
      if (score > bestScore) {
        bestScore = score
        suggested_price = rule.max_price != null ? Math.round((rule.min_price + rule.max_price) / 2) : rule.min_price ?? null
        matched_rule_id = rule.id
      }
    }
  }

  // Insert quote
  const { data: quote, error } = await supabase.from('quotes').insert({
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || null,
    device_type: device_type?.trim() || null,
    device_make_model: device_make_model?.trim() || null,
    problem_description: problem_description.trim(),
    marketing_consent: marketing_consent === true || marketing_consent === 'true',
    suggested_price,
    matched_rule_id,
    status: 'new',
  }).select().single()

  if (error) {
    console.error('Supabase insert error:', error)
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Failed to save quote request' }) }
  }

  // Email config — fallbacks hardcoded so missing env vars never silently break delivery
  const resendKey = process.env.RESEND_API_KEY
  const alertTo   = process.env.OWNER_EMAIL || 'repairs@404fixed.co.uk'
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'repairs@404fixed.co.uk'
  const fromName  = process.env.NEXT_PUBLIC_APP_NAME || '404 Fixed'
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || 'https://app.404fixed.co.uk'

  if (!resendKey) console.error('[quote-request] RESEND_API_KEY is not set — emails skipped')

  if (resendKey && alertTo) {
    const name   = `${first_name} ${last_name}`
    const device = [device_make_model, device_type].filter(Boolean).join(' — ') || 'Not specified'
    const quoteUrl = `${appUrl}/quotes/${quote.id}`

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:40px 20px;background:#09090b;font-family:system-ui,sans-serif;color:#fafafa;">
<table width="600" style="max-width:600px;margin:0 auto;background:#18181b;border-radius:12px;overflow:hidden;">
  <tr><td style="padding:28px 32px;border-bottom:2px solid #dc2626;">
    <h1 style="margin:0;font-size:20px;font-weight:700;color:#fafafa;"><span style="color:#dc2626;">●</span> ${fromName}</h1>
    <p style="margin:6px 0 0;color:#a1a1aa;font-size:13px;">New Quote Request</p>
  </td></tr>
  <tr><td style="padding:28px 32px;">
    <table width="100%" style="background:#27272a;border-radius:8px;padding:16px;margin-bottom:20px;">
      <tr><td style="padding:7px 0;"><span style="color:#a1a1aa;font-size:13px;">Customer</span><span style="float:right;color:#fafafa;font-weight:600;">${name}</span></td></tr>
      <tr><td style="padding:7px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:13px;">Email</span><span style="float:right;color:#dc2626;">${email}</span></td></tr>
      ${phone ? `<tr><td style="padding:7px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:13px;">Phone</span><span style="float:right;color:#fafafa;">${phone}</span></td></tr>` : ''}
      <tr><td style="padding:7px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:13px;">Device</span><span style="float:right;color:#fafafa;">${device}</span></td></tr>
      ${suggested_price != null ? `<tr><td style="padding:7px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:13px;">Auto-quoted</span><span style="float:right;color:#22c55e;font-weight:600;">£${suggested_price}</span></td></tr>` : ''}
    </table>
    <div style="background:#111;border-left:3px solid #dc2626;border-radius:4px;padding:14px;margin-bottom:24px;">
      <p style="margin:0 0 6px;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Problem</p>
      <p style="margin:0;color:#fafafa;font-size:14px;line-height:1.6;">${problem_description}</p>
    </div>
    <a href="${quoteUrl}" style="display:inline-block;background:#dc2626;color:white;padding:11px 26px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View &amp; Respond to Quote →</a>
  </td></tr>
  <tr><td style="padding:16px 32px;background:#27272a;text-align:center;">
    <p style="margin:0;color:#71717a;font-size:12px;">© ${new Date().getFullYear()} ${fromName}</p>
  </td></tr>
</table></body></html>`

    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: alertTo,
          subject: `New Quote Request — ${name} (${device})`,
          html,
          text: `New quote from ${name}\nEmail: ${email}${phone ? `\nPhone: ${phone}` : ''}\nDevice: ${device}\nProblem: ${problem_description}${suggested_price != null ? `\nAuto-quoted: £${suggested_price}` : ''}\n\nView in dashboard: ${quoteUrl}`,
        }),
      })
      if (!resendRes.ok) {
        const errBody = await resendRes.text()
        console.error('[quote-request] Resend API error:', resendRes.status, errBody)
      } else {
        console.log('[quote-request] Notification email sent to', alertTo)
      }
    } catch (emailErr) {
      console.error('[quote-request] Email send exception:', emailErr)
      // Never fail the customer-facing response due to an email error
    }
  }

  // Auto-send quote to customer when instant price was matched
  if (resendKey && suggested_price != null && quote.quote_token) {
    const bookUrl    = `${appUrl}/book/${quote.quote_token}`
    const declineUrl = `${appUrl}/api/quotes/decline?token=${quote.quote_token}`
    const name       = `${first_name} ${last_name}`
    const device     = [device_make_model, device_type].filter(Boolean).join(' — ') || 'Your device'

    const customerHtml = `<!DOCTYPE html><html><body style="margin:0;padding:40px 20px;background:#09090b;font-family:system-ui,sans-serif;color:#fafafa;">
<table width="600" style="max-width:600px;margin:0 auto;background:#18181b;border-radius:12px;overflow:hidden;">
  <tr><td style="padding:28px 32px;border-bottom:2px solid #dc2626;">
    <h1 style="margin:0;font-size:20px;font-weight:700;color:#fafafa;"><span style="color:#dc2626;">●</span> ${fromName}</h1>
    <p style="margin:6px 0 0;color:#a1a1aa;font-size:13px;">Your instant quote is ready</p>
  </td></tr>
  <tr><td style="padding:28px 32px;">
    <p style="color:#fafafa;font-size:15px;margin:0 0 20px;">Hi ${first_name},</p>
    <p style="color:#a1a1aa;font-size:14px;margin:0 0 20px;">Great news — we can give you an instant price for your repair:</p>
    <table width="100%" style="background:#27272a;border-radius:8px;padding:16px;margin-bottom:20px;">
      <tr><td style="padding:7px 0;"><span style="color:#a1a1aa;font-size:13px;">Device</span><span style="float:right;color:#fafafa;">${device}</span></td></tr>
      <tr><td style="padding:7px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:13px;">Repair</span><span style="float:right;color:#fafafa;">${problem_description}</span></td></tr>
      <tr><td style="padding:7px 0;border-top:1px solid #3f3f46;"><span style="color:#a1a1aa;font-size:13px;">Price</span><span style="float:right;color:#22c55e;font-weight:700;font-size:18px;">£${suggested_price}</span></td></tr>
    </table>
    <p style="color:#a1a1aa;font-size:13px;margin:0 0 24px;">To get booked in, simply choose a date and time that works for you:</p>
    <a href="${bookUrl}" style="display:inline-block;background:#dc2626;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:16px;">Book My Appointment →</a>
    <p style="margin:20px 0 0;font-size:12px;color:#52525b;">Not interested? <a href="${declineUrl}" style="color:#71717a;">Decline this quote</a></p>
  </td></tr>
  <tr><td style="padding:16px 32px;background:#27272a;text-align:center;">
    <p style="margin:0;color:#71717a;font-size:12px;">© ${new Date().getFullYear()} ${fromName}</p>
  </td></tr>
</table></body></html>`

    try {
      const customerRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: email,
          subject: `Your instant repair quote — £${suggested_price}`,
          html: customerHtml,
          text: `Hi ${first_name},\n\nYour instant repair quote:\n${device}\n${problem_description}\nPrice: £${suggested_price}\n\nBook your appointment: ${bookUrl}\n\nNot interested? ${declineUrl}`,
        }),
      })
      if (!customerRes.ok) {
        const errBody = await customerRes.text()
        console.error('[quote-request] Customer quote email error:', customerRes.status, errBody)
      } else {
        console.log('[quote-request] Instant quote email sent to customer:', email)
        // Mark quote as sent so the dashboard reflects it
        await supabase.from('quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', quote.id)
      }
    } catch (e) {
      console.error('[quote-request] Customer quote email exception:', e)
    }
  }

  return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true, id: quote.id, instant: suggested_price != null }) }
}
