import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

function generateMessageId(): string {
  const domain = (() => {
    try { return new URL(process.env.NEXT_PUBLIC_APP_URL ?? '').hostname } catch { return 'support.local' }
  })()
  return `${crypto.randomUUID()}@${domain}`
}

function emailHtml(shopName: string, prefix: string, title: string, body: string): string {
  const escaped = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;">
  <tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr><td style="background:#18181b;border-radius:12px 12px 0 0;padding:24px 32px;border-bottom:2px solid #dc2626;">
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#fafafa;"><span style="color:#dc2626;">&#9679;</span> ${shopName}</h1>
      <p style="margin:6px 0 0;color:#a1a1aa;font-size:13px;">Ticket [${prefix}] — ${title}</p>
    </td></tr>
    <tr><td style="background:#18181b;padding:28px 32px;">
      <p style="margin:0;font-size:15px;line-height:1.7;color:#e4e4e7;">${escaped}</p>
    </td></tr>
    <tr><td style="background:#27272a;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
      <p style="margin:0;color:#71717a;font-size:12px;">${shopName} · Support Team</p>
      <p style="margin:4px 0 0;color:#52525b;font-size:11px;">Reply to this email to continue the conversation.</p>
    </td></tr>
  </table></td></tr>
</table></body></html>`
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data } = await supabase.from('ticket_messages').select('*').eq('ticket_id', id).order('created_at', { ascending: true })
  return NextResponse.json({ messages: data ?? [] })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await request.json()
  const { body: msgBody, direction = 'outbound', actor, message_type = 'message' } = body

  if (!msgBody) return NextResponse.json({ error: 'body required' }, { status: 400 })

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('title, ticket_number, ticket_type, contact_email, contact_name')
    .eq('id', id)
    .single()

  let sent = false
  let emailMessageId: string | null = null

  // Auto-send email for all outbound replies (no manual toggle needed)
  if (direction === 'outbound' && ticket?.contact_email && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Support'
    const supportEmail = process.env.SUPPORT_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? 'support@example.com'
    const fromName = process.env.RESEND_FROM_NAME ?? shopName
    const prefix = ticket.ticket_type === 'incident'
      ? `INC${String(ticket.ticket_number).padStart(4, '0')}`
      : `C${String(ticket.ticket_number).padStart(5, '0')}`

    // Generate a traceable Message-ID so we can thread replies
    const msgId = generateMessageId()

    // Find the most recent inbound message for In-Reply-To threading
    const { data: lastInbound } = await supabase
      .from('ticket_messages')
      .select('email_message_id')
      .eq('ticket_id', id)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const threadHeaders: Record<string, string> = {
      'Message-ID': `<${msgId}>`,
    }
    if (lastInbound?.email_message_id) {
      threadHeaders['In-Reply-To'] = `<${lastInbound.email_message_id}>`
      threadHeaders['References'] = `<${lastInbound.email_message_id}>`
    }

    const { error } = await resend.emails.send({
      from: `${fromName} <${supportEmail}>`,
      to: ticket.contact_email,
      reply_to: supportEmail,
      subject: `Re: [${prefix}] ${ticket.title}`,
      text: `${msgBody}\n\n---\nTicket ref: [${prefix}]\nReply to this email to continue the conversation.`,
      html: emailHtml(shopName, prefix, ticket.title, msgBody),
      headers: threadHeaders,
    })

    if (!error) {
      sent = true
      emailMessageId = msgId
    }
  }

  const { data: msg, error } = await supabase.from('ticket_messages').insert({
    ticket_id: id,
    direction,
    from_name: direction === 'outbound' ? (actor ?? process.env.NEXT_PUBLIC_APP_NAME ?? 'Support') : (ticket?.contact_name ?? null),
    from_email: direction === 'outbound' ? (process.env.SUPPORT_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? null) : (ticket?.contact_email ?? null),
    body: msgBody,
    sent,
    message_type,
    email_message_id: emailMessageId,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const typeLabel: Record<string, string> = {
    repair_log: 'Repair log',
    call_log: 'Call log',
    callout: 'Callout booked',
    note: 'Note',
    message: direction === 'internal' ? 'Note' : direction === 'outbound' ? 'Reply' : 'Message',
  }
  const label = direction === 'internal'
    ? `${typeLabel[message_type] ?? 'Note'} added${actor ? ` by ${actor}` : ''}`
    : direction === 'outbound'
    ? `${typeLabel[message_type] ?? 'Reply'} sent to client${sent ? ' via email' : ''}${actor ? ` by ${actor}` : ''}`
    : 'Reply received from client'

  const eventType = message_type === 'repair_log' ? 'repair_logged'
    : message_type === 'call_log' ? 'call_logged'
    : message_type === 'callout' ? 'callout_booked'
    : direction === 'internal' ? 'note_added'
    : direction === 'outbound' ? 'reply_sent' : 'reply_received'

  await supabase.from('ticket_timeline').insert({
    ticket_id: id,
    event_type: eventType,
    description: label,
    actor: actor ?? null,
  })
  await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', id)

  return NextResponse.json({ message: msg }, { status: 201 })
}
