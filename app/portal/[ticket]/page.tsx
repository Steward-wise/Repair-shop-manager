'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import JobStatusBadge from '@/components/job-status-badge'
import { formatTicketNumber, formatDateTime, formatCurrency, formatRelative } from '@/lib/utils'
import { DEVICE_TYPE_LABELS, JOB_STATUS_LABELS, type Job, type JobStatus } from '@/types'

const STATUS_FLOW: JobStatus[] = ['intake', 'diagnosed', 'in_progress', 'waiting_parts', 'ready', 'collected']

export default function PortalTicketPage() {
  const { ticket } = useParams<{ ticket: string }>()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const shopPhone = process.env.NEXT_PUBLIC_SHOP_PHONE ?? ''

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/portal/login'); return }

      const ticketNum = parseInt(ticket, 10)
      if (isNaN(ticketNum)) { setNotFound(true); setLoading(false); return }

      const res = await fetch(`/api/portal/jobs?email=${encodeURIComponent(user.email ?? '')}&ticket=${ticketNum}`)
      const data = await res.json()
      if (data.job) setJob(data.job)
      else setNotFound(true)
      setLoading(false)
    }
    load()
  }, [ticket, router])

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

        {/* Progress */}
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
                </div>
              )
            })}
          </div>
        </div>

        {/* Fault */}
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
          </div>
        )}

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
            Questions? <a href={`tel:${shopPhone}`} className="text-primary">{shopPhone}</a>
          </p>
        )}
      </div>
    </div>
  )
}
