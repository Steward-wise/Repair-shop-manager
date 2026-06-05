import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import JobStatusBadge from '@/components/job-status-badge'
import { formatTicketNumber, formatDateTime, formatCurrency } from '@/lib/utils'
import type { Job } from '@/types'
import { JOB_STATUS_LABELS } from '@/types'

export const metadata = { title: 'Technician Workload' }

// Open statuses only
const OPEN_STATUSES = ['intake', 'diagnosed', 'awaiting_approval', 'awaiting_repair', 'waiting_parts', 'in_progress', 'ready']

export default async function TechniciansPage() {
  const supabase = createAdminClient()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*, customer:customers(id,name,phone)')
    .in('status', OPEN_STATUSES)
    .order('created_at', { ascending: false })
    .limit(500)

  const allJobs = (jobs as unknown as Job[]) ?? []

  // Group by technician_name
  const groups: Record<string, Job[]> = {}
  for (const job of allJobs) {
    const key = job.technician_name?.trim() || 'Unassigned'
    if (!groups[key]) groups[key] = []
    groups[key].push(job)
  }

  // Sort: Unassigned last, rest alphabetically
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'Unassigned') return 1
    if (b === 'Unassigned') return -1
    return a.localeCompare(b)
  })

  const totalOpen = allJobs.length

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-fg">Technician Workload</h1>
          <p className="text-muted text-sm mt-0.5">{totalOpen} open job{totalOpen !== 1 ? 's' : ''} across {sortedKeys.length} technician{sortedKeys.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/reports" className="btn-secondary text-sm">Reports →</Link>
          <Link href="/jobs/new" className="btn-primary text-sm">New Ticket</Link>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {sortedKeys.map((tech) => {
          const techJobs = groups[tech]
          const urgent = techJobs.filter(j => j.status === 'waiting_parts' || j.status === 'ready').length
          return (
            <a key={tech} href={`#tech-${tech.replace(/\s+/g, '-')}`}
              className="card hover:border-primary/50 transition-colors cursor-pointer">
              <p className="text-sm font-semibold text-fg truncate">{tech}</p>
              <p className="text-2xl font-bold text-fg mt-1">{techJobs.length}</p>
              <p className="text-xs text-muted">open job{techJobs.length !== 1 ? 's' : ''}</p>
              {urgent > 0 && (
                <p className="text-xs text-orange-400 mt-1">⚠ {urgent} need attention</p>
              )}
            </a>
          )
        })}
      </div>

      {/* Per-technician tables */}
      {sortedKeys.map((tech) => {
        const techJobs = groups[tech]
        const byStatus: Record<string, number> = {}
        for (const j of techJobs) byStatus[j.status] = (byStatus[j.status] ?? 0) + 1
        const totalValue = techJobs.reduce((sum, j) => sum + (j.final_price ?? j.quoted_price ?? 0), 0)

        return (
          <div key={tech} id={`tech-${tech.replace(/\s+/g, '-')}`} className="card space-y-4">
            {/* Tech header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-bold text-fg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                    {tech === 'Unassigned' ? '?' : tech.charAt(0).toUpperCase()}
                  </div>
                  {tech}
                </h2>
                <div className="flex gap-2 flex-wrap mt-1">
                  {Object.entries(byStatus).map(([s, count]) => (
                    <span key={s} className="text-xs text-muted bg-surface-2 px-2 py-0.5 rounded-full">
                      {JOB_STATUS_LABELS[s as keyof typeof JOB_STATUS_LABELS] ?? s}: {count}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted">Pipeline value</p>
                <p className="text-lg font-bold text-fg">{formatCurrency(totalValue)}</p>
              </div>
            </div>

            {/* Jobs table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-muted font-medium py-2 pr-4">Ticket</th>
                    <th className="text-left text-muted font-medium py-2 pr-4">Customer</th>
                    <th className="text-left text-muted font-medium py-2 pr-4 hidden md:table-cell">Device</th>
                    <th className="text-left text-muted font-medium py-2 pr-4 hidden lg:table-cell">Fault</th>
                    <th className="text-left text-muted font-medium py-2 pr-4">Status</th>
                    <th className="text-right text-muted font-medium py-2 pr-4 hidden sm:table-cell">Value</th>
                    <th className="text-right text-muted font-medium py-2">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {techJobs.map((job) => {
                    const ageMs = Date.now() - new Date(job.created_at).getTime()
                    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
                    const isStale = ageDays >= 7
                    return (
                      <tr key={job.id} className={`hover:bg-surface-2/50 transition-colors ${isStale ? 'opacity-75' : ''}`}>
                        <td className="py-2.5 pr-4">
                          <Link href={`/jobs/${job.id}`} className="font-mono text-primary hover:underline font-medium text-xs">
                            {formatTicketNumber(job.ticket_number)}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-4 text-fg">
                          {job.customer?.name ?? <span className="text-muted">Walk-in</span>}
                        </td>
                        <td className="py-2.5 pr-4 text-muted hidden md:table-cell">
                          {job.device_make} {job.device_model}
                        </td>
                        <td className="py-2.5 pr-4 text-muted hidden lg:table-cell max-w-[180px] truncate">
                          {job.reported_fault}
                        </td>
                        <td className="py-2.5 pr-4">
                          <JobStatusBadge status={job.status} />
                        </td>
                        <td className="py-2.5 pr-4 text-right text-muted hidden sm:table-cell">
                          {formatCurrency(job.final_price ?? job.quoted_price)}
                        </td>
                        <td className="py-2.5 text-right text-muted text-xs whitespace-nowrap">
                          {isStale
                            ? <span className="text-orange-400">{ageDays}d ago</span>
                            : formatDateTime(job.created_at)
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {totalOpen === 0 && (
        <div className="card text-center py-16">
          <p className="text-muted text-lg">🎉 No open jobs — all clear!</p>
        </div>
      )}
    </div>
  )
}
