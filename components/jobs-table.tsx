'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import JobStatusBadge from '@/components/job-status-badge'
import { formatTicketNumber, formatDateTime, formatCurrency } from '@/lib/utils'
import { JOB_STATUS_LABELS, type Job, type JobStatus } from '@/types'

const STATUSES: JobStatus[] = ['intake', 'diagnosed', 'awaiting_approval', 'awaiting_repair', 'waiting_parts', 'in_progress', 'ready', 'collected']

interface Props {
  jobs: Job[]
}

export default function JobsTable({ jobs }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<JobStatus>('diagnosed')
  const [applying, setApplying] = useState(false)

  function toggleAll() {
    if (selected.size === jobs.length) setSelected(new Set())
    else setSelected(new Set(jobs.map((j) => j.id)))
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function deleteJob(id: string) {
    if (!confirm('Delete this job? This cannot be undone.')) return
    const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete job'); return }
    toast.success('Job deleted')
    router.refresh()
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${selected.size} job${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) return
    setApplying(true)
    await Promise.all(Array.from(selected).map(id => fetch(`/api/jobs/${id}`, { method: 'DELETE' })))
    toast.success(`${selected.size} job${selected.size > 1 ? 's' : ''} deleted`)
    setSelected(new Set())
    router.refresh()
    setApplying(false)
  }

  async function applyBulk() {
    if (selected.size === 0) return
    setApplying(true)
    const res = await fetch('/api/jobs/bulk-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobIds: Array.from(selected), status: bulkStatus }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Bulk update failed')
    } else {
      toast.success(`${data.updated} job${data.updated > 1 ? 's' : ''} updated to ${JOB_STATUS_LABELS[bulkStatus]}`)
      setSelected(new Set())
      router.refresh()
    }
    setApplying(false)
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46' } }} />

      <div className="card overflow-hidden">
        {jobs.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-40">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            <p>No jobs found.</p>
            <Link href="/jobs/new" className="text-primary hover:underline mt-2 inline-block">
              Create your first ticket →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="py-3 px-3">
                    <input
                      type="checkbox"
                      checked={selected.size === jobs.length && jobs.length > 0}
                      onChange={toggleAll}
                      className="rounded border-border accent-primary cursor-pointer"
                    />
                  </th>
                  <th className="text-left text-muted font-medium py-3 px-4">Ticket</th>
                  <th className="text-left text-muted font-medium py-3 px-4">Customer</th>
                  <th className="text-left text-muted font-medium py-3 px-4 hidden md:table-cell">Device</th>
                  <th className="text-left text-muted font-medium py-3 px-4 hidden lg:table-cell">Fault</th>
                  <th className="text-left text-muted font-medium py-3 px-4">Status</th>
                  <th className="text-left text-muted font-medium py-3 px-4 hidden sm:table-cell">Technician</th>
                  <th className="text-right text-muted font-medium py-3 px-4 hidden md:table-cell">Price</th>
                  <th className="text-right text-muted font-medium py-3 px-4">Created</th>
                  <th className="py-3 px-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.map((job) => (
                  <tr key={job.id} className={`group hover:bg-surface-2/50 transition-colors ${selected.has(job.id) ? 'bg-primary-muted/20' : ''}`}>
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        checked={selected.has(job.id)}
                        onChange={() => toggle(job.id)}
                        className="rounded border-border accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <Link href={`/jobs/${job.id}`} className="font-mono text-primary hover:underline font-medium text-xs">
                        {formatTicketNumber(job.ticket_number)}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-fg">
                      {job.customer?.name ?? <span className="text-muted">Walk-in</span>}
                    </td>
                    <td className="py-3 px-4 text-muted hidden md:table-cell">
                      {job.device_make} {job.device_model}
                    </td>
                    <td className="py-3 px-4 text-muted hidden lg:table-cell max-w-[200px] truncate">
                      {job.reported_fault}
                    </td>
                    <td className="py-3 px-4">
                      <JobStatusBadge status={job.status} />
                    </td>
                    <td className="py-3 px-4 text-muted hidden sm:table-cell text-xs">
                      {job.technician_name ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-muted hidden md:table-cell">
                      {formatCurrency(job.final_price ?? job.quoted_price)}
                    </td>
                    <td className="py-3 px-4 text-right text-muted text-xs whitespace-nowrap">
                      {formatDateTime(job.created_at)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteJob(job.id) }}
                        title="Delete job"
                        className="text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface border border-border rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-fg">{selected.size} selected</span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as JobStatus)}
            className="input text-sm py-1.5 w-auto"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <button
            onClick={applyBulk}
            disabled={applying}
            className="btn-primary text-sm py-1.5"
          >
            {applying ? 'Updating…' : `Update ${selected.size} job${selected.size > 1 ? 's' : ''}`}
          </button>
          <button
            onClick={deleteSelected}
            disabled={applying}
            className="btn-secondary text-sm py-1.5 text-red-400 hover:text-red-300 border-red-900/50"
          >
            Delete {selected.size}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-muted hover:text-fg transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
      )}
    </>
  )
}
