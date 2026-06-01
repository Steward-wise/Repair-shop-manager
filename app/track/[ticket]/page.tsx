'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatTicketNumber, formatRelative, formatCurrency } from '@/lib/utils'
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS, DEVICE_TYPE_LABELS } from '@/types'
import type { Job, JobStatus } from '@/types'

const STATUS_FLOW: JobStatus[] = ['intake', 'diagnosed', 'in_progress', 'waiting_parts', 'ready', 'collected']

function PushNotifyButton({ jobId }: { jobId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'subscribed' | 'unsupported'>('idle')

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setState('unsupported')
    }
  }, [])

  async function subscribe() {
    setState('loading')
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) { setState('unsupported'); return }

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState('idle'); return }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, subscription: sub.toJSON() }),
      })

      setState('subscribed')
    } catch {
      setState('idle')
    }
  }

  if (state === 'unsupported' || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return null
  if (state === 'subscribed') {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-700/40 rounded-xl text-sm text-green-300">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        You&apos;ll be notified when your repair status changes
      </div>
    )
  }

  return (
    <button
      onClick={subscribe}
      disabled={state === 'loading'}
      className="w-full flex items-center justify-center gap-2 p-3 bg-surface border border-border rounded-xl text-sm text-fg hover:bg-surface-2 transition-colors disabled:opacity-50"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {state === 'loading' ? 'Setting up…' : 'Get notified when your repair is ready'}
    </button>
  )
}

export default function TrackPage() {
  const { ticket } = useParams<{ ticket: string }>()
  const [job, setJob] = useState<Job | null>(null)
  const [notFound, setNotFound] = useState(false)

  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
  const shopPhone = process.env.NEXT_PUBLIC_SHOP_PHONE ?? ''

  useEffect(() => {
    const ticketNum = parseInt(ticket, 10)
    if (isNaN(ticketNum)) { setNotFound(true); return }

    fetch(`/api/track?ticket=${ticketNum}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.job) setJob(d.job)
        else setNotFound(true)
      })
      .catch(() => setNotFound(true))
  }, [ticket])

  if (notFound) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-fg mb-2">Ticket not found</h1>
          <p className="text-muted text-sm">We couldn&apos;t find ticket <span className="font-mono text-fg">#{ticket}</span>. Please check the number and try again.</p>
          {shopPhone && <p className="text-muted text-sm mt-4">Need help? Call us on <a href={`tel:${shopPhone}`} className="text-primary">{shopPhone}</a></p>}
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const currentIndex = STATUS_FLOW.indexOf(job.status)

  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* Header */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </div>
          <span className="font-bold text-fg">{shopName}</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Ticket header */}
        <div className="card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-muted mb-1">Repair ticket</p>
              <p className="text-2xl font-mono font-bold text-fg">{formatTicketNumber(job.ticket_number)}</p>
              <p className="text-sm text-muted mt-1">{job.device_make} {job.device_model}</p>
              <p className="text-xs text-muted">{DEVICE_TYPE_LABELS[job.device_type]}</p>
            </div>
            <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${JOB_STATUS_COLORS[job.status]}`}>
              {JOB_STATUS_LABELS[job.status]}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="card">
          <h2 className="text-sm font-semibold text-fg mb-4">Repair Progress</h2>
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
                  }`}>
                    {isPast ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm ${isCurrent ? 'text-fg font-semibold' : isPast ? 'text-muted' : 'text-muted opacity-50'}`}>
                    {JOB_STATUS_LABELS[s]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Status message */}
        {job.status === 'ready' && (
          <div className="p-4 bg-green-900/20 border border-green-700/40 rounded-xl">
            <p className="text-sm font-semibold text-green-300 mb-1">Your device is ready!</p>
            <p className="text-sm text-muted">Please bring your collection reference to the shop.</p>
            {shopPhone && <p className="text-sm text-muted mt-1">Call us on <a href={`tel:${shopPhone}`} className="text-primary">{shopPhone}</a></p>}
          </div>
        )}
        {job.status === 'waiting_parts' && (
          <div className="p-4 bg-orange-900/20 border border-orange-700/40 rounded-xl">
            <p className="text-sm font-semibold text-orange-300 mb-1">Waiting for parts</p>
            <p className="text-sm text-muted">We&apos;re waiting for parts to arrive. We&apos;ll notify you when repair begins.</p>
          </div>
        )}

        {/* Price */}
        {(job.quoted_price || job.final_price) && (
          <div className="card">
            <h2 className="text-sm font-semibold text-fg mb-3">Price</h2>
            <div className="space-y-2 text-sm">
              {job.quoted_price && (
                <div className="flex justify-between">
                  <span className="text-muted">Quoted</span>
                  <span className="text-fg">{formatCurrency(job.quoted_price)}</span>
                </div>
              )}
              {job.final_price && (
                <div className="flex justify-between font-semibold">
                  <span className="text-muted">Final price</span>
                  <span className="text-primary text-base">{formatCurrency(job.final_price)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Push notification subscribe */}
        {job.status !== 'collected' && (
          <PushNotifyButton jobId={job.id} />
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted space-y-1 pb-4">
          <p>Last updated {formatRelative(job.updated_at)}</p>
          {shopPhone && (
            <p>Questions? <a href={`tel:${shopPhone}`} className="text-primary">{shopPhone}</a></p>
          )}
        </div>
      </div>
    </div>
  )
}
