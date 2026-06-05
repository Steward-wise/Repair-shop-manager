'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import JobStatusBadge from '@/components/job-status-badge'
import { formatTicketNumber, formatDateTime, formatCurrency, formatRelative } from '@/lib/utils'
import { DEVICE_TYPE_LABELS, JOB_STATUS_LABELS, type Job, type JobStatus } from '@/types'

const STATUS_FLOW: JobStatus[] = ['intake', 'diagnosed', 'awaiting_approval', 'awaiting_repair', 'waiting_parts', 'in_progress', 'ready', 'collected']

interface PortalNote {
  id: string
  content: string
  note_type: string
  source: string
  staff_name: string | null
  created_at: string
}

interface PortalJob extends Job {
  portal_notes: PortalNote[]
  repair_photos: { id: string; url: string; caption: string | null; created_at: string }[]
}

export default function PortalTicketPage() {
  const { ticket } = useParams<{ ticket: string }>()
  const router = useRouter()
  const [job, setJob] = useState<PortalJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [notes, setNotes] = useState<PortalNote[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const shopPhone = process.env.NEXT_PUBLIC_SHOP_PHONE ?? ''
  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/portal/login'); return }

      const ticketNum = parseInt(ticket, 10)
      if (isNaN(ticketNum)) { setNotFound(true); setLoading(false); return }

      const res = await fetch(`/api/portal/jobs?email=${encodeURIComponent(user.email ?? '')}&ticket=${ticketNum}`)
      const data = await res.json()
      if (data.job) {
        setJob(data.job)
        setNotes(data.job.portal_notes ?? [])
      } else setNotFound(true)
      setLoading(false)
    }
    load()
  }, [ticket, router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [notes])

  async function sendMessage() {
    if (!message.trim() || !job) return
    setSending(true)
    try {
      const res = await fetch('/api/portal/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job.id, message: message.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send')
      setNotes(prev => [...prev, data.note])
      setMessage('')
    } catch {
      // silently fail — could show toast if needed
    } finally {
      setSending(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-muted mb-4">Repair not found or not associated with your account.</p>
        <Link href="/portal" className="text-primary hover:underline">← Back to your repairs</Link>
      </div>
    </div>
  )

  if (!job) return null

  const currentIndex = STATUS_FLOW.indexOf(job.status)

  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="bg-surface border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/portal" className="text-muted hover:text-fg transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </Link>
          <span className="font-bold text-fg">Repair Details</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted mb-1">Ticket</p>
              <p className="text-2xl font-mono font-bold text-fg">{formatTicketNumber(job.ticket_number)}</p>
              <p className="text-sm text-muted mt-1">{job.device_make} {job.device_model}</p>
              <p className="text-xs text-muted">{DEVICE_TYPE_LABELS[job.device_type]}</p>
            </div>
            <JobStatusBadge status={job.status} />
          </div>
        </div>

        {/* Progress tracker */}
        <div className="card">
          <h2 className="text-sm font-semibold text-fg mb-4">Progress</h2>
          <div className="space-y-2">
            {STATUS_FLOW.map((s, i) => {
              const isPast = i < currentIndex
              const isCurrent = i === currentIndex
              return (
                <div key={s} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    isPast ? 'bg-primary text-white' :
                    isCurrent ? 'bg-primary text-white ring-4 ring-primary/20' :
                    'bg-surface-2 text-muted'
                  }`}>{isPast ? '✓' : i + 1}</div>
                  <span className={`text-sm ${isCurrent ? 'text-fg font-semibold' : isPast ? 'text-muted' : 'text-muted opacity-50'}`}>
                    {JOB_STATUS_LABELS[s]}
                  </span>
                  {isCurrent && <span className="ml-auto text-xs text-primary animate-pulse">● Now</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Reported fault */}
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-fg">Reported Issue</h2>
          <p className="text-sm text-muted">{job.reported_fault}</p>
          {job.notes && <p className="text-xs text-muted border-t border-border pt-2">{job.notes}</p>}
        </div>

        {/* Price */}
        {(job.quoted_price || job.final_price) && (
          <div className="card space-y-2">
            <h2 className="text-sm font-semibold text-fg">Price</h2>
            {job.quoted_price && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Quoted</span>
                <span className="text-fg">{formatCurrency(job.quoted_price)}</span>
              </div>
            )}
            {job.final_price && (
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-muted">Final</span>
                <span className="text-primary">{formatCurrency(job.final_price)}</span>
              </div>
            )}
            {job.payment_status === 'paid' && (
              <p className="text-xs text-green-400 font-medium">✓ Paid</p>
            )}
          </div>
        )}

        {/* Progress photos from technician */}
        {job.repair_photos && job.repair_photos.length > 0 && (
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-fg">Repair Updates</h2>
            <div className="space-y-3">
              {job.repair_photos.map((photo) => (
                <div key={photo.id} className="space-y-1.5">
                  <div className="relative rounded-lg overflow-hidden bg-surface-2 h-48">
                    <Image src={photo.url} alt="Repair progress" fill className="object-cover" />
                  </div>
                  {photo.caption && <p className="text-xs text-muted italic">{photo.caption}</p>}
                  <p className="text-xs text-muted">{formatRelative(photo.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-fg">Messages</h2>

          {notes.length === 0 ? (
            <p className="text-xs text-muted text-center py-4">No messages yet. Send us a message below!</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {notes.map((note) => {
                const isCustomer = note.source === 'customer'
                return (
                  <div key={note.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      isCustomer
                        ? 'bg-primary text-white rounded-br-sm'
                        : 'bg-surface-2 text-fg rounded-bl-sm'
                    }`}>
                      {!isCustomer && (
                        <p className="text-xs font-semibold mb-1 opacity-70">{shopName}</p>
                      )}
                      <p className="text-sm leading-snug">{note.content}</p>
                      <p className={`text-xs mt-1 ${isCustomer ? 'text-white/60' : 'text-muted'}`}>
                        {formatRelative(note.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Message input */}
          <div className="flex gap-2 border-t border-border pt-3">
            <input
              type="text"
              className="input flex-1 text-sm"
              placeholder="Type a message…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={!message.trim() || sending}
              className="btn-primary text-sm px-4 shrink-0"
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>

        {/* Dates */}
        <div className="card space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Booked in</span>
            <span className="text-fg">{formatDateTime(job.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Last updated</span>
            <span className="text-fg">{formatRelative(job.updated_at)}</span>
          </div>
          {job.collected_at && (
            <div className="flex justify-between">
              <span className="text-muted">Collected</span>
              <span className="text-fg">{formatDateTime(job.collected_at)}</span>
            </div>
          )}
        </div>

        {shopPhone && (
          <p className="text-center text-sm text-muted">
            Prefer to call? <a href={`tel:${shopPhone}`} className="text-primary">{shopPhone}</a>
          </p>
        )}

        <p className="text-center text-xs text-muted pb-4">
          <a href="/privacy" className="hover:text-fg underline">Privacy Notice</a>
          {' · '}Your data is processed under UK GDPR.
        </p>
      </div>
    </div>
  )
}
