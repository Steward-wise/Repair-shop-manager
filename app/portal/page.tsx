'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import JobStatusBadge from '@/components/job-status-badge'
import { formatTicketNumber, formatRelative, formatCurrency } from '@/lib/utils'
import type { Job } from '@/types'

export default function PortalPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')

  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
  const shopPhone = process.env.NEXT_PUBLIC_SHOP_PHONE ?? ''

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) { router.push('/portal/login'); return }

      setUserEmail(user.email ?? '')

      // Look up customer by email, then get their jobs
      const res = await fetch(`/api/portal/jobs?email=${encodeURIComponent(user.email ?? '')}`)
      const data = await res.json()
      setJobs(data.jobs ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/portal/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* Header */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
            </div>
            <span className="font-bold text-fg">{shopName}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted hidden sm:block">{userEmail}</span>
            <button onClick={signOut} className="text-xs text-muted hover:text-primary transition-colors">Sign out</button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-fg">Your Repairs</h1>

        {jobs.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-muted text-sm">No repairs found for this email address.</p>
            {shopPhone && (
              <p className="text-muted text-sm mt-2">
                Questions? Call <a href={`tel:${shopPhone}`} className="text-primary">{shopPhone}</a>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/portal/${formatTicketNumber(job.ticket_number).replace('#', '')}`}
                className="card block hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold text-primary">{formatTicketNumber(job.ticket_number)}</span>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <p className="text-sm text-fg">{job.device_make} {job.device_model}</p>
                    <p className="text-xs text-muted mt-0.5">{formatRelative(job.created_at)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-fg">{formatCurrency(job.final_price ?? job.quoted_price)}</p>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted ml-auto mt-1">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
