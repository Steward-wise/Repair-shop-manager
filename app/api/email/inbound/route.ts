import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

function parseFrom(from: string): { name: string | null; email: string } {
  const match = from.match(/^(.+?)\s*<(.+?)>$/)
  if (match) return { name: match[1].trim() || null, email: match[2].trim().toLowerCase() }
  return { name: null, email: from.trim().toLowerCase() }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, '\n')
    .trim()
}

function extractLatestReply(text: string): string {
  const patterns = [
    /\nOn .+wrote:/i,
    /\n-{3,}\s*Original Message/i,
    /\n_{3,}/,
    /\nFrom:\s+.+\nSent:/i,
  ]
  for (const p of patterns) {
    const idx = text.search(p)
    if (idx > 0) return text.slice(0, idx).trim()
  }
  return text.trim()
}

// Resend sends headers as array [{name, value}] or as flat object — handle both
function getHeader(headers: unknown, name: string): string {
  if (Array.isArray(headers)) {
    const h = headers.find((x: { name: string; value: string }) =>
      x.name?.toLowerCase() === name.toLowerCase()
    )
    return h?.value ?? ''
  }
  if (headers && typeof headers === 'object') {
    const h = headers as Record<string, string>
    return h[name] ?? h[name.toLowerCase()] ?? h[name.toUpperCase()] ?? ''
  }
  return ''
}

export async function POST(request: NextRequest) {
  // Verify Resend webhook signature when configured
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  const rawBody = await request.text()
  let raw: unknown

  if (webhookSecret) {
    const svixId = request.headers.get('svix-id')
    const svixTimestamp = request.headers.get('svix-timestamp')
    const svixSignature = request.headers.get('svix-signature')
    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: 'Missing webhook signature' }, { status: 401 })
    }
    try {
      // Svix signature verification: HMAC-SHA256 over "<id>.<timestamp>.<body>"
      const signingPayload = `${svixId}.${svixTimestamp}.${rawBody}`
      const secretBytes = Buffer.from(webhookSecret.replace(/^whsec_/, ''), 'base64')
      const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
      const expectedSig = Buffer.from(await crypto.subtle.sign('HMAC', key, Buffer.from(signingPayload))).toString('base64')
      const signatures = svixSignature.split(' ')
      const valid = signatures.some(s => s.replace(/^v1,/, '') === expectedSig)
      if (!valid) return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
    } catch {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
    }
  }

  try {
    raw = JSON.parse(rawBody)

    // Resend wraps inbound in { type: 'email.received', data: { ... } }
    // Fall back to raw body if it's a direct post (for testing)
    const payload = raw.type === 'email.received' ? raw.data : raw

    const fromRaw: string = payload.from ?? ''
    const subject: string = payload.subject ?? ''
    const rawText: string = payload.text ?? ''
    const rawHtml: string = payload.html ?? ''
    const headers = payload.headers ?? {}

    const messageId = getHeader(headers, 'Message-ID').replace(/[<>]/g, '').trim() || null
    const inReplyTo = getHeader(headers, 'In-Reply-To').replace(/[<>]/g, '').trim() || null

    const { name: fromName, email: fromEmail } = parseFrom(fromRaw)
    const textContent = rawText
      ? extractLatestReply(rawText)
      : stripHtml(rawHtml)

    if (!fromEmail || !textContent) {
      return NextResponse.json({ error: 'Missing from or body' }, { status: 400 })
    }

    const supabase = createAdminClient()
    let ticketId: string | null = null

    // 1. Thread by In-Reply-To matching a message we sent
    if (inReplyTo) {
      const { data: prevMsg } = await supabase
        .from('ticket_messages')
        .select('ticket_id')
        .eq('email_message_id', inReplyTo)
        .maybeSingle()
      if (prevMsg) ticketId = prevMsg.ticket_id
    }

    // 2. Match ticket ref in subject e.g. [C00001] or [INC0001]
    if (!ticketId) {
      const refMatch = subject.match(/\[(C\d{5}|INC\d{4})\]/i)
      if (refMatch) {
        const ref = refMatch[1].toUpperCase()
        const isIncident = ref.startsWith('INC')
        const num = parseInt(ref.replace(/\D/g, ''), 10)
        const { data: found } = await supabase
          .from('support_tickets')
          .select('id')
          .eq('ticket_type', isIncident ? 'incident' : 'service_desk')
          .eq('ticket_number', num)
          .maybeSingle()
        if (found) ticketId = found.id
      }
    }

    // 3. Create a new ticket from the email
    if (!ticketId) {
      const { data: last } = await supabase
        .from('support_tickets')
        .select('ticket_number')
        .eq('ticket_type', 'service_desk')
        .order('ticket_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      const nextNum = (last?.ticket_number ?? 0) + 1
      const cleanSubject = subject.replace(/^(re|fwd?):\s*/i, '').trim() || 'Support request via email'

      const { data: newTicket, error: createErr } = await supabase
        .from('support_tickets')
        .insert({
          ticket_type: 'service_desk',
          ticket_number: nextNum,
          title: cleanSubject,
          description: textContent,
          status: 'open',
          contact_email: fromEmail,
          contact_name: fromName,
          source: 'email',
        })
        .select('id')
        .single()

      if (createErr || !newTicket) {
        console.error('Failed to create ticket from email:', createErr)
        return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
      }

      ticketId = newTicket.id

      await supabase.from('ticket_timeline').insert({
        ticket_id: ticketId,
        event_type: 'ticket_opened',
        description: `Ticket opened via email from ${fromEmail}`,
      })

      await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        direction: 'inbound',
        from_name: fromName,
        from_email: fromEmail,
        body: textContent,
        sent: false,
        email_message_id: messageId,
      })

      return NextResponse.json({ ok: true, ticket_id: ticketId, created: true })
    }

    // 4. Add reply to existing ticket
    await supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      direction: 'inbound',
      from_name: fromName,
      from_email: fromEmail,
      body: textContent,
      sent: false,
      email_message_id: messageId,
      email_in_reply_to: inReplyTo,
    })

    await supabase.from('ticket_timeline').insert({
      ticket_id: ticketId,
      event_type: 'reply_received',
      description: `Reply received from ${fromEmail}`,
    })

    // Re-open if resolved/closed
    const { data: currentTicket } = await supabase
      .from('support_tickets')
      .select('status')
      .eq('id', ticketId)
      .single()

    if (currentTicket?.status === 'resolved' || currentTicket?.status === 'closed') {
      await supabase
        .from('support_tickets')
        .update({ status: 'open', updated_at: new Date().toISOString() })
        .eq('id', ticketId)
    } else {
      await supabase
        .from('support_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', ticketId)
    }

    return NextResponse.json({ ok: true, ticket_id: ticketId, created: false })
  } catch (err) {
    console.error('Inbound email webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
