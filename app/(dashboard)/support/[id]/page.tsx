'use client'

import { useEffect, useState, useCallback, use, useRef } from 'react'
import Link from 'next/link'
import {
  type SupportTicket, type TicketMessage, type TicketTimelineEvent,
  type ITQuote, type TicketStatus, type TicketPriority, type MessageType,
  type Technician, type TicketAttachment,
  formatTicketRef, TICKET_STATUS_LABELS, TICKET_STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS, IT_QUOTE_STATUS_LABELS,
} from '@/types'

type ActivityItem =
  | { kind: 'message'; ts: string; msg: TicketMessage }
  | { kind: 'event'; ts: string; evt: TicketTimelineEvent }

function mergeActivity(msgs: TicketMessage[], evts: TicketTimelineEvent[]): ActivityItem[] {
  return [
    ...msgs.map(m => ({ kind: 'message' as const, ts: m.created_at, msg: m })),
    ...evts.map(e => ({ kind: 'event' as const, ts: e.created_at, evt: e })),
  ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// SLA countdown
function SlaCountdown({ dueAt, status }: { dueAt: string; status: TicketStatus }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])
  if (status === 'resolved' || status === 'closed') return null
  const due = new Date(dueAt).getTime()
  const diff = due - now
  const isBreached = diff < 0
  const abs = Math.abs(diff)
  const hrs = Math.floor(abs / 3600000)
  const mins = Math.floor((abs % 3600000) / 60000)
  const label = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
      isBreached ? 'bg-red-900/60 text-red-300 border-red-600' :
      hrs < 2 ? 'bg-orange-900/40 text-orange-300 border-orange-600' :
      'bg-zinc-800 text-zinc-400 border-zinc-600'
    }`}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      {isBreached ? `SLA breached ${label} ago` : `SLA ${label}`}
    </span>
  )
}

function EventIcon({ type }: { type: string }) {
  if (type === 'ticket_opened' || type === 'created') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
  )
  if (type === 'status_changed') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
  )
  if (type === 'assigned') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  )
  if (type === 'priority_changed') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
  )
  if (type === 'quote_created') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
  )
  if (type === 'repair_logged') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
  )
  if (type === 'call_logged') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6.29 6.29l.92-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
  )
  if (type === 'callout_booked') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
  )
  return <div className="w-2 h-2 rounded-full bg-current" />
}

const EVENT_COLORS: Record<string, string> = {
  created: 'text-blue-400 bg-blue-900/30',
  ticket_opened: 'text-blue-400 bg-blue-900/30',
  status_changed: 'text-blue-400 bg-blue-900/30',
  priority_changed: 'text-orange-400 bg-orange-900/30',
  assigned: 'text-green-400 bg-green-900/30',
  quote_created: 'text-purple-400 bg-purple-900/30',
  repair_logged: 'text-yellow-400 bg-yellow-900/30',
  call_logged: 'text-cyan-400 bg-cyan-900/30',
  callout_booked: 'text-indigo-400 bg-indigo-900/30',
  reply_sent: 'text-zinc-400 bg-zinc-800',
  reply_received: 'text-zinc-400 bg-zinc-800',
  note_added: 'text-yellow-400 bg-yellow-900/30',
}

const MSG_TYPE_CONFIG: Record<MessageType, { label: string; icon: string; borderClass: string; headerClass: string }> = {
  message:    { label: 'Message',     icon: '💬', borderClass: '', headerClass: '' },
  note:       { label: 'Note',        icon: '🔒', borderClass: 'border-yellow-700/30', headerClass: 'text-yellow-400' },
  repair_log: { label: 'Repair Log',  icon: '🔧', borderClass: 'border-orange-700/30', headerClass: 'text-orange-400' },
  call_log:   { label: 'Call Log',    icon: '📞', borderClass: 'border-cyan-700/30',   headerClass: 'text-cyan-400' },
  callout:    { label: 'Callout',     icon: '📅', borderClass: 'border-indigo-700/30', headerClass: 'text-indigo-400' },
}

function AttachmentRow({ a }: { a: TicketAttachment }) {
  const isImage = a.mime_type?.startsWith('image/')
  return (
    <a
      href={a.file_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 transition-colors text-xs text-zinc-300 group"
    >
      <span className="text-base">{isImage ? '🖼️' : '📎'}</span>
      <span className="flex-1 truncate">{a.file_name}</span>
      {a.file_size && <span className="text-zinc-500 flex-shrink-0">{fmtBytes(a.file_size)}</span>}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600 group-hover:text-zinc-400 flex-shrink-0">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>
      </svg>
    </a>
  )
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const feedRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [timeline, setTimeline] = useState<TicketTimelineEvent[]>([])
  const [quotes, setQuotes] = useState<ITQuote[]>([])
  const [attachments, setAttachments] = useState<TicketAttachment[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)

  const [mode, setMode] = useState<'reply' | 'note'>('reply')
  const [msgType, setMsgType] = useState<MessageType>('message')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  // Inline edit state
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', description: '', contact_name: '', contact_email: '', contact_phone: '' })

  const load = useCallback(async () => {
    try {
      const [tRes, mRes, tlRes, qRes, aRes] = await Promise.all([
        fetch(`/api/support/${id}`),
        fetch(`/api/support/${id}/messages`),
        fetch(`/api/support/${id}/timeline`),
        fetch(`/api/it-quotes?ticket_id=${id}`),
        fetch(`/api/support/${id}/attachments`),
      ])
      const [tj, mj, tlj, qj, aj] = await Promise.all([tRes.json(), mRes.json(), tlRes.json(), qRes.json(), aRes.json()])
      setTicket(tj.ticket ?? null)
      setMessages(mj.messages ?? [])
      setTimeline(tlj.events ?? [])
      setQuotes(qj.quotes ?? [])
      setAttachments(aj.attachments ?? [])
      if (tj.ticket) setEditForm({
        title: tj.ticket.title ?? '',
        description: tj.ticket.description ?? '',
        contact_name: tj.ticket.contact_name ?? '',
        contact_email: tj.ticket.contact_email ?? '',
        contact_phone: tj.ticket.contact_phone ?? '',
      })
    } catch (err) {
      console.error('Failed to load ticket:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Load technicians once
  useEffect(() => {
    fetch('/api/technicians').then(r => r.json()).then(j => setTechnicians(j.technicians ?? []))
  }, [])

  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, timeline])

  // When mode changes, reset msgType appropriately
  useEffect(() => {
    if (mode === 'note') setMsgType('note')
    else setMsgType('message')
  }, [mode])

  async function send() {
    if (!body.trim() && pendingFiles.length === 0) return
    setSending(true)
    const direction = mode === 'note' ? 'internal' : 'outbound'

    // If there's text, post the message first
    let createdMsgId: string | null = null
    if (body.trim()) {
      const res = await fetch(`/api/support/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, direction, message_type: msgType }),
      })
      const json = await res.json()
      createdMsgId = json.message?.id ?? null
    }

    // Upload any pending files
    for (const file of pendingFiles) {
      const fd = new FormData()
      fd.append('file', file)
      if (createdMsgId) fd.append('message_id', createdMsgId)
      await fetch(`/api/support/${id}/attachments`, { method: 'POST', body: fd })
    }

    setBody('')
    setPendingFiles([])
    await load()
    setSending(false)
  }

  async function uploadFiles(files: FileList) {
    setUploading(true)
    const newFiles = Array.from(files)
    setPendingFiles(prev => [...prev, ...newFiles])
    setUploading(false)
  }

  async function updateField(field: string, value: string | null) {
    setSaving(true)
    const res = await fetch(`/api/support/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value || null }),
    })
    const json = await res.json()
    if (json.ticket) setTicket(json.ticket)
    setSaving(false)
  }

  async function saveEdit() {
    setSaving(true)
    const res = await fetch(`/api/support/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const json = await res.json()
    if (json.ticket) { setTicket(json.ticket); setEditing(false) }
    setSaving(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">Loading…</div>
  if (!ticket) return <div className="flex items-center justify-center h-64 text-red-400 text-sm">Ticket not found</div>

  const ref = formatTicketRef(ticket.ticket_type, ticket.ticket_number)
  const activity = mergeActivity(messages, timeline)

  // Group attachments by message_id
  const attachByMsg: Record<string, TicketAttachment[]> = {}
  for (const a of attachments) {
    const key = a.message_id ?? '__standalone'
    if (!attachByMsg[key]) attachByMsg[key] = []
    attachByMsg[key].push(a)
  }

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 7rem)' }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 flex-wrap flex-shrink-0">
        <Link href="/support" className="text-zinc-400 hover:text-fg transition-colors mt-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-mono text-sm text-zinc-500">{ref}</span>
            {ticket.source === 'email' && (
              <span className="text-xs text-zinc-500 border border-zinc-700 rounded-full px-2 py-0.5">via email</span>
            )}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TICKET_STATUS_COLORS[ticket.status]}`}>
              {TICKET_STATUS_LABELS[ticket.status]}
            </span>
            {ticket.priority && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[ticket.priority]}`}>
                {PRIORITY_LABELS[ticket.priority]}
              </span>
            )}
            {ticket.sla_due_at && <SlaCountdown dueAt={ticket.sla_due_at} status={ticket.status} />}
          </div>
          <h1 className="text-lg font-bold text-fg leading-snug">{ticket.title}</h1>
          {ticket.client && (
            <Link href={`/clients/${ticket.client_id}`} className="text-sm text-zinc-400 hover:text-fg transition-colors">
              {ticket.client.company_name}
            </Link>
          )}
        </div>
      </div>

      {/* ── Two-column body ────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 min-h-0">

        {/* ── Activity feed + composer ─────────────────────────── */}
        <div className="flex flex-col min-h-0 gap-3">
          <div ref={feedRef} className="flex-1 overflow-y-auto space-y-2 pr-1 pb-1">
            {activity.length === 0 && (
              <p className="text-sm text-zinc-500 py-12 text-center">No activity yet — send the first reply below.</p>
            )}

            {activity.map((item) => {
              if (item.kind === 'event') {
                const color = EVENT_COLORS[item.evt.event_type] ?? 'text-zinc-500 bg-zinc-800'
                return (
                  <div key={item.evt.id} className="flex items-center gap-2.5 py-0.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                      <EventIcon type={item.evt.event_type} />
                    </div>
                    <p className="text-xs text-zinc-500 flex-1 leading-snug">
                      {item.evt.description}
                      {item.evt.actor && <span className="text-zinc-600"> · {item.evt.actor}</span>}
                    </p>
                    <span className="text-xs text-zinc-700 flex-shrink-0">{fmtTime(item.evt.created_at)}</span>
                  </div>
                )
              }

              const msg = item.msg
              const mt = msg.message_type ?? 'message'
              const typeConfig = MSG_TYPE_CONFIG[mt] || MSG_TYPE_CONFIG.message
              const msgAttachments = attachByMsg[msg.id] ?? []

              // Internal / tagged notes
              if (msg.direction === 'internal' || mt !== 'message') {
                const bgClass = mt === 'repair_log' ? 'bg-orange-900/10 border-orange-700/30' :
                  mt === 'call_log' ? 'bg-cyan-900/10 border-cyan-700/30' :
                  mt === 'callout' ? 'bg-indigo-900/10 border-indigo-700/30' :
                  'bg-yellow-900/15 border-yellow-700/30'
                return (
                  <div key={msg.id} className={`rounded-xl p-4 border ${bgClass}`}>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-base">{typeConfig.icon}</span>
                      <span className={`text-xs font-semibold ${typeConfig.headerClass || 'text-yellow-400'}`}>{typeConfig.label}</span>
                      {msg.from_name && <span className="text-xs text-zinc-400">· {msg.from_name}</span>}
                      <span className="text-xs text-zinc-600 ml-auto">{fmtTime(msg.created_at)}</span>
                    </div>
                    <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                    {msgAttachments.map(a => <AttachmentRow key={a.id} a={a} />)}
                  </div>
                )
              }

              // Inbound / Outbound messages
              const isInbound = msg.direction === 'inbound'
              const initial = ((msg.from_name ?? (isInbound ? ticket.contact_name ?? 'C' : 'S'))[0] ?? '?').toUpperCase()

              return (
                <div key={msg.id} className={`flex gap-3 ${isInbound ? '' : 'flex-row-reverse'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isInbound ? 'bg-zinc-700 text-zinc-200' : 'bg-red-900/60 text-red-200'}`}>
                    {initial}
                  </div>
                  <div className={`min-w-0 max-w-[82%] ${isInbound ? '' : 'flex flex-col items-end'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isInbound ? '' : 'flex-row-reverse'}`}>
                      <span className="text-xs font-semibold text-fg">
                        {msg.from_name ?? (isInbound ? (ticket.contact_name ?? 'Client') : 'Support')}
                      </span>
                      {!isInbound && msg.sent && (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          Sent
                        </span>
                      )}
                      <span className="text-xs text-zinc-600">{fmtTime(msg.created_at)}</span>
                    </div>
                    <div className={`rounded-xl px-4 py-3 text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed break-words ${
                      isInbound ? 'bg-zinc-800 rounded-tl-none' : 'bg-zinc-900 border border-zinc-700/70 rounded-tr-none'
                    }`}>
                      {msg.body}
                      {msgAttachments.map(a => <AttachmentRow key={a.id} a={a} />)}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Standalone attachments (not linked to a message) */}
            {(attachByMsg['__standalone'] ?? []).length > 0 && (
              <div className="rounded-xl p-3 border border-zinc-700/40 bg-zinc-800/20 space-y-1">
                <p className="text-xs text-zinc-500 font-medium">Attachments</p>
                {attachByMsg['__standalone'].map(a => <AttachmentRow key={a.id} a={a} />)}
              </div>
            )}
          </div>

          {/* Reply composer */}
          <div className="flex-shrink-0 border-t border-zinc-800 pt-3 space-y-2.5">
            {/* Mode toggle */}
            <div className="flex gap-1 p-1 bg-zinc-800/60 rounded-lg">
              <button
                onClick={() => setMode('reply')}
                className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors ${mode === 'reply' ? 'bg-red-600 text-white shadow-sm' : 'text-zinc-400 hover:text-fg'}`}
              >
                {ticket.contact_name ? `Reply to ${ticket.contact_name}` : 'Reply to Client'}
              </button>
              <button
                onClick={() => setMode('note')}
                className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors ${mode === 'note' ? 'bg-yellow-700 text-white shadow-sm' : 'text-zinc-400 hover:text-fg'}`}
              >
                🔒 Internal Note
              </button>
            </div>

            {/* Log type buttons (only in note mode) */}
            {mode === 'note' && (
              <div className="flex gap-1.5 flex-wrap">
                {(['note', 'repair_log', 'call_log', 'callout'] as MessageType[]).map(t => {
                  const c = MSG_TYPE_CONFIG[t]
                  return (
                    <button
                      key={t}
                      onClick={() => setMsgType(t)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        msgType === t
                          ? t === 'repair_log' ? 'bg-orange-900/60 border-orange-600 text-orange-300' :
                            t === 'call_log' ? 'bg-cyan-900/60 border-cyan-600 text-cyan-300' :
                            t === 'callout' ? 'bg-indigo-900/60 border-indigo-600 text-indigo-300' :
                            'bg-yellow-900/60 border-yellow-600 text-yellow-300'
                          : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500'
                      }`}
                    >
                      {c.icon} {c.label}
                    </button>
                  )
                })}
              </div>
            )}

            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={
                mode === 'note'
                  ? msgType === 'repair_log' ? 'Log repair work done…'
                  : msgType === 'call_log' ? 'Log call details…'
                  : msgType === 'callout' ? 'Log callout booking details…'
                  : 'Add an internal note…'
                  : ticket.contact_email
                  ? `Replying to ${ticket.contact_email}…`
                  : 'Type your reply…'
              }
              rows={3}
              className={`w-full input-field resize-none text-sm ${
                mode === 'note'
                  ? msgType === 'repair_log' ? 'border-orange-700/40 focus:ring-orange-600' :
                    msgType === 'call_log' ? 'border-cyan-700/40 focus:ring-cyan-600' :
                    msgType === 'callout' ? 'border-indigo-700/40 focus:ring-indigo-600' :
                    'border-yellow-700/40 focus:ring-yellow-600'
                  : ''
              }`}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }}
            />

            {/* Pending file list */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 rounded-lg text-xs text-zinc-300">
                    <span>📎</span>
                    <span className="max-w-[120px] truncate">{f.name}</span>
                    <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} className="text-zinc-500 hover:text-red-400 ml-1">✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                  Attach
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => e.target.files && uploadFiles(e.target.files)}
                />
                <span className="text-xs text-zinc-600">
                  {mode === 'reply' && ticket.contact_email
                    ? `Will email ${ticket.contact_email}`
                    : mode === 'reply' && !ticket.contact_email
                    ? 'No email on file'
                    : 'Ctrl+Enter to send'}
                </span>
              </div>
              <button
                onClick={send}
                disabled={sending || (!body.trim() && pendingFiles.length === 0)}
                className={`text-sm px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-40 ${
                  mode === 'note'
                    ? msgType === 'repair_log' ? 'bg-orange-700 hover:bg-orange-600 text-white' :
                      msgType === 'call_log' ? 'bg-cyan-700 hover:bg-cyan-600 text-white' :
                      msgType === 'callout' ? 'bg-indigo-700 hover:bg-indigo-600 text-white' :
                      'bg-yellow-700 hover:bg-yellow-600 text-white'
                    : 'btn-primary'
                }`}
              >
                {sending ? 'Sending…' : mode === 'note' ? `Log ${MSG_TYPE_CONFIG[msgType].label}` : 'Send Reply'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right sidebar ────────────────────────────────────── */}
        <div className="overflow-y-auto space-y-4">
          {/* Ticket properties */}
          <div className="card space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-fg">Properties</h3>
              {saving && <span className="text-xs text-zinc-500">Saving…</span>}
            </div>

            <div>
              <p className="text-xs text-zinc-500 mb-1">Status</p>
              <select value={ticket.status} onChange={e => updateField('status', e.target.value)} className="w-full input-field text-sm py-1.5">
                {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map(s => (
                  <option key={s} value={s}>{TICKET_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-xs text-zinc-500 mb-1">Priority</p>
              <select value={ticket.priority ?? ''} onChange={e => updateField('priority', e.target.value)} className="w-full input-field text-sm py-1.5">
                <option value="">No priority</option>
                {(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map(p => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-xs text-zinc-500 mb-1">Assigned Technician</p>
              <select
                value={ticket.technician_id ?? ''}
                onChange={e => updateField('technician_id', e.target.value)}
                className="w-full input-field text-sm py-1.5"
              >
                <option value="">Unassigned</option>
                {technicians.filter(t => t.active).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {ticket.technician_id && technicians.find(t => t.id === ticket.technician_id)?.email && (
                <p className="text-xs text-zinc-600 mt-1">📧 Will email on assignment</p>
              )}
            </div>

            {ticket.sla_due_at && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">SLA Due</p>
                <p className="text-xs text-zinc-400">
                  {new Date(ticket.sla_due_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}

            <div className="pt-1 border-t border-zinc-800 text-xs text-zinc-600 space-y-0.5">
              <p>Opened {new Date(ticket.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              <p>Updated {new Date(ticket.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>

          {/* Inline edit ticket details */}
          <div className="card space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-fg">Ticket Details</h3>
              <button
                onClick={() => setEditing(e => !e)}
                className="text-xs text-zinc-400 hover:text-fg transition-colors"
              >
                {editing ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {editing ? (
              <>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Title</label>
                  <input type="text" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="w-full input-field text-sm py-1.5" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Description</label>
                  <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full input-field text-sm py-1.5 resize-none" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Contact Name</label>
                  <input type="text" value={editForm.contact_name} onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))} className="w-full input-field text-sm py-1.5" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Contact Email</label>
                  <input type="email" value={editForm.contact_email} onChange={e => setEditForm(f => ({ ...f, contact_email: e.target.value }))} className="w-full input-field text-sm py-1.5" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Contact Phone</label>
                  <input type="tel" value={editForm.contact_phone} onChange={e => setEditForm(f => ({ ...f, contact_phone: e.target.value }))} className="w-full input-field text-sm py-1.5" />
                </div>
                <button onClick={saveEdit} disabled={saving} className="btn-primary text-xs py-1.5 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            ) : (
              <div className="space-y-1.5 text-xs text-zinc-400">
                {ticket.contact_name && <p><span className="text-zinc-600">Name </span>{ticket.contact_name}</p>}
                {ticket.contact_email && <p><span className="text-zinc-600">Email </span><a href={`mailto:${ticket.contact_email}`} className="text-red-400 hover:underline break-all">{ticket.contact_email}</a></p>}
                {ticket.contact_phone && <p><span className="text-zinc-600">Phone </span><a href={`tel:${ticket.contact_phone}`} className="text-red-400 hover:underline">{ticket.contact_phone}</a></p>}
                {ticket.description && <p className="whitespace-pre-wrap text-zinc-500 pt-1 border-t border-zinc-800">{ticket.description}</p>}
                {!ticket.contact_name && !ticket.contact_email && !ticket.contact_phone && !ticket.description && (
                  <p className="text-zinc-600">No details — click Edit to add</p>
                )}
              </div>
            )}
          </div>

          {/* Client */}
          {ticket.client && (
            <div className="card space-y-2 text-sm">
              <h3 className="font-semibold text-fg">Client</h3>
              <Link href={`/clients/${ticket.client_id}`} className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition-colors font-medium">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M9 8h1m-1 4h1m4-4h1m-1 4h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/></svg>
                {ticket.client.company_name}
              </Link>
              {ticket.client.sla_hours && (
                <p className="text-xs text-zinc-500">SLA: {ticket.client.sla_hours}h response</p>
              )}
            </div>
          )}

          {/* Linked IT Quotes */}
          {quotes.length > 0 && (
            <div className="card space-y-2 text-sm">
              <h3 className="font-semibold text-fg">IT Quotes</h3>
              {quotes.map(q => (
                <Link key={q.id} href={`/it-quotes/${q.id}`} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors group">
                  <div className="min-w-0">
                    <p className="text-fg text-xs font-medium truncate">{q.title}</p>
                    <p className="text-zinc-400 text-xs">£{q.total.toFixed(2)} inc. VAT</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ml-2 flex-shrink-0 ${
                    q.status === 'accepted' ? 'bg-green-900/40 text-green-300 border-green-700' :
                    q.status === 'sent' ? 'bg-blue-900/40 text-blue-300 border-blue-700' :
                    'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}>{IT_QUOTE_STATUS_LABELS[q.status]}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div className="card space-y-2">
            <h3 className="font-semibold text-fg text-sm">Quick Actions</h3>
            <Link href={`/it-quotes/new?ticket_id=${ticket.id}&title=${encodeURIComponent(ticket.title)}&client_id=${ticket.client_id ?? ''}`}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 hover:text-fg transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Create IT Quote
            </Link>
            <button
              onClick={() => { setMode('note'); setMsgType('callout') }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 hover:text-fg transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              Book Callout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
