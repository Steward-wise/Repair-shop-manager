import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StatsCard from '@/components/stats-card'
import JobStatusBadge from '@/components/job-status-badge'
import { formatTicketNumber, formatRelative, formatCurrency } from '@/lib/utils'
import { formatTicketRef, TICKET_STATUS_LABELS, TICKET_STATUS_COLORS, PRIORITY_COLORS, PRIORITY_LABELS } from '@/types'
import type { Job, SupportTicket } from '@/types'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const [
    { count: openCount },
    { count: readyCount },
    { count: jobsTodayCount },
    { count: lowStockCount },
    { count: unpaidCount },
    { data: recentJobs },
    { data: ratingsData },
    { count: apptTodayCount },
    { count: openTickets },
    { count: p1p2Count },
    { data: recentTickets },
  ] = await Promise.all([
    supabase.from('jobs').select('*', { count: 'exact', head: true }).not('status', 'in', '(collected)'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'ready'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    supabase.from('inventory').select('*', { count: 'exact', head: true }).filter('quantity', 'lte', 'reorder_threshold'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'collected').neq('payment_status', 'paid'),
    supabase.from('jobs').select('*, customer:customers(id,name,phone,email)').order('created_at', { ascending: false }).limit(8),
    supabase.from('job_ratings').select('rating').not('submitted_at', 'is', null).limit(1000),
    // Service desk stats via admin client (these tables require service role)
    admin.from('appointments').select('*', { count: 'exact', head: true }).eq('appointment_date', todayStr).eq('status', 'scheduled'),
    admin.from('support_tickets').select('*', { count: 'exact', head: true }).not('status', 'in', '(resolved,closed)'),
    admin.from('support_tickets').select('*', { count: 'exact', head: true }).in('priority', ['p1', 'p2']).not('status', 'in', '(resolved,closed)'),
    admin.from('support_tickets').select('id, ticket_number, ticket_type, title, status, priority, client_id, contact_name, created_at').not('status', 'in', '(resolved,closed)').order('created_at', { ascending: false }).limit(6),
  ])

  const ratings = (ratingsData ?? []) as { rating: number }[]
  const avgRating = ratings.length > 0
    ? Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) * 10) / 10
    : null

  // Ticket status counts for the service desk pipeline
  const { data: ticketStatusCounts } = await admin
    .from('support_tickets')
    .select('status')
    .not('status', 'in', '(closed)')

  const statusCounts: Record<string, number> = {}
  for (const t of ticketStatusCounts ?? []) {
    statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1
  }

  // Job status counts for the repair pipeline
  const { data: jobStatusData } = await supabase.from('jobs').select('status')
  const jobStatusCounts: Record<string, number> = {}
  for (const j of jobStatusData ?? []) {
    jobStatusCounts[j.status] = (jobStatusCounts[j.status] ?? 0) + 1
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">Dashboard</h1>
          <p className="text-muted text-sm mt-0.5">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/jobs/new" className="btn-secondary flex items-center gap-2 text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            New Repair
          </Link>
          <Link href="/support/new" className="btn-primary flex items-center gap-2 text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            New Ticket
          </Link>
        </div>
      </div>

      {/* Stats row — appointments first */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard
          label="Today's Appointments"
          value={apptTodayCount ?? 0}
          accent="blue"
          sub="Scheduled today"
          href="/appointments"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
            </svg>
          }
        />
        <StatsCard
          label="Open Jobs"
          value={openCount ?? 0}
          accent="red"
          href="/jobs"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          }
        />
        <StatsCard
          label="Open Tickets"
          value={openTickets ?? 0}
          accent="red"
          sub="IT service desk"
          href="/support"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 5.25h.008v.008H12v-.008z"/>
            </svg>
          }
        />
        <StatsCard
          label="P1/P2 Incidents"
          value={p1p2Count ?? 0}
          accent={p1p2Count ? 'red' : 'green'}
          sub={p1p2Count ? 'Needs attention' : 'All clear'}
          href="/support?type=incident"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          }
        />
        <StatsCard
          label="Ready to Collect"
          value={readyCount ?? 0}
          accent="green"
          sub="Awaiting customer"
          href="/jobs?status=ready"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
          }
        />
        <StatsCard
          label="Avg Rating"
          value={avgRating != null ? `${avgRating} ★` : '—'}
          accent="yellow"
          sub={ratings.length > 0 ? `${ratings.length} review${ratings.length !== 1 ? 's' : ''}` : 'No reviews yet'}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          }
        />
      </div>

      {/* Two-column layout for pipelines */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Repair Pipeline */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-fg">Repair Pipeline</h2>
            <Link href="/jobs" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {([
              { status: 'intake',        dot: 'bg-zinc-400',   label: 'Intake'    },
              { status: 'diagnosed',     dot: 'bg-blue-400',   label: 'Diagnosed' },
              { status: 'in_progress',   dot: 'bg-yellow-400', label: 'In Prog.'  },
              { status: 'waiting_parts', dot: 'bg-orange-400', label: 'Waiting'   },
              { status: 'ready',         dot: 'bg-green-400',  label: 'Ready'     },
              { status: 'collected',     dot: 'bg-zinc-600',   label: 'Collected' },
            ] as const).map(({ status, dot, label }) => (
              <Link key={status} href={`/jobs?status=${status}`} className="bg-surface-2 hover:bg-border rounded-lg p-2.5 text-center transition-colors">
                <p className="text-2xl font-bold text-fg mb-1.5">{jobStatusCounts[status] ?? 0}</p>
                <div className="flex items-center justify-center gap-1.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                  <span className="text-xs text-muted truncate">{label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Service Desk Pipeline */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-fg">Service Desk Pipeline</h2>
            <Link href="/support" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              { status: 'open',           dot: 'bg-blue-400',   label: 'Open'       },
              { status: 'in_progress',    dot: 'bg-yellow-400', label: 'In Prog.'   },
              { status: 'pending_client', dot: 'bg-orange-400', label: 'Pending'    },
              { status: 'resolved',       dot: 'bg-green-400',  label: 'Resolved'   },
            ] as const).map(({ status, dot, label }) => (
              <Link key={status} href={`/support?status=${status}`} className="bg-surface-2 hover:bg-border rounded-lg p-3 text-center transition-colors">
                <p className="text-2xl font-bold text-fg mb-1.5">{statusCounts[status] ?? 0}</p>
                <div className="flex items-center justify-center gap-1.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                  <span className="text-xs text-muted truncate">{label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent tickets */}
      {(recentTickets ?? []).length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-fg">Recent Support Tickets</h2>
            <Link href="/support" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted font-medium pb-3 pr-4">Ref</th>
                  <th className="text-left text-muted font-medium pb-3 pr-4">Title</th>
                  <th className="text-left text-muted font-medium pb-3 pr-4 hidden sm:table-cell">Contact</th>
                  <th className="text-left text-muted font-medium pb-3 pr-4">Priority</th>
                  <th className="text-left text-muted font-medium pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(recentTickets as unknown as SupportTicket[]).map((t) => (
                  <tr key={t.id} className="hover:bg-surface-2 transition-colors">
                    <td className="py-3 pr-4">
                      <Link href={`/support/${t.id}`} className="font-mono text-xs text-muted hover:text-fg">
                        {formatTicketRef(t.ticket_type, t.ticket_number)}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <Link href={`/support/${t.id}`} className="text-fg hover:text-primary transition-colors line-clamp-1">{t.title}</Link>
                    </td>
                    <td className="py-3 pr-4 text-muted hidden sm:table-cell">{t.contact_name ?? '—'}</td>
                    <td className="py-3 pr-4">
                      {t.priority ? (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[t.priority]}`}>
                          {PRIORITY_LABELS[t.priority]}
                        </span>
                      ) : <span className="text-zinc-600 text-xs">—</span>}
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium border ${TICKET_STATUS_COLORS[t.status]}`}>
                        {TICKET_STATUS_LABELS[t.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Jobs */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-fg">Recent Repair Jobs</h2>
          <Link href="/jobs" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        {!recentJobs?.length ? (
          <div className="text-center py-8 text-muted">
            <p>No jobs yet. <Link href="/jobs/new" className="text-primary hover:underline">Create your first ticket.</Link></p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted font-medium pb-3 pr-4">Ticket</th>
                  <th className="text-left text-muted font-medium pb-3 pr-4">Customer</th>
                  <th className="text-left text-muted font-medium pb-3 pr-4 hidden sm:table-cell">Device</th>
                  <th className="text-left text-muted font-medium pb-3 pr-4">Status</th>
                  <th className="text-left text-muted font-medium pb-3 hidden md:table-cell">Created</th>
                  <th className="text-right text-muted font-medium pb-3">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(recentJobs as unknown as Job[]).map((job) => (
                  <tr key={job.id} className="hover:bg-surface-2 transition-colors">
                    <td className="py-3 pr-4">
                      <Link href={`/jobs/${job.id}`} className="font-mono text-primary hover:underline font-medium">
                        {formatTicketNumber(job.ticket_number)}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-fg">{job.customer?.name ?? 'Walk-in'}</td>
                    <td className="py-3 pr-4 text-muted hidden sm:table-cell">{job.device_make} {job.device_model}</td>
                    <td className="py-3 pr-4"><JobStatusBadge status={job.status} /></td>
                    <td className="py-3 text-muted hidden md:table-cell">{formatRelative(job.created_at)}</td>
                    <td className="py-3 text-right text-muted">{formatCurrency(job.final_price ?? job.quoted_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
