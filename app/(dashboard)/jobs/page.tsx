import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import JobsTable from '@/components/jobs-table'
import JobKanban from '@/components/job-kanban'
import { JOB_STATUS_LABELS, type JobStatus } from '@/types'
import type { Job } from '@/types'

export const metadata = { title: 'Jobs' }

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string; scan?: string; view?: string }>
}

const STATUSES: JobStatus[] = ['intake', 'diagnosed', 'awaiting_approval', 'awaiting_repair', 'waiting_parts', 'in_progress', 'ready', 'collected']

export default async function JobsPage({ searchParams }: PageProps) {
  const { status, q, scan, view } = await searchParams
  const isBoard = view === 'board'
  const supabase = await createClient()

  // Board view loads all non-collected jobs (no status filter, higher limit)
  let query = supabase
    .from('jobs')
    .select('*, customer:customers(id,name,phone,email)')
    .order('created_at', { ascending: false })
    .limit(isBoard ? 500 : 100)

  if (!isBoard) {
    if (status && STATUSES.includes(status as JobStatus)) {
      query = query.eq('status', status)
    }

    if (scan) {
      const ticketNum = parseInt(scan, 10)
      if (!isNaN(ticketNum)) query = query.eq('ticket_number', ticketNum)
    } else if (q) {
      const { data: matchedCustomers } = await supabase
        .from('customers')
        .select('id')
        .ilike('name', `%${q}%`)

      const customerIds = (matchedCustomers ?? []).map((c: { id: string }) => c.id)

      if (customerIds.length > 0) {
        query = query.or(
          `device_make.ilike.%${q}%,device_model.ilike.%${q}%,reported_fault.ilike.%${q}%,imei.ilike.%${q}%,customer_id.in.(${customerIds.join(',')})`
        )
      } else {
        query = query.or(`device_make.ilike.%${q}%,device_model.ilike.%${q}%,reported_fault.ilike.%${q}%,imei.ilike.%${q}%`)
      }
    }
  }

  const { data: jobs } = await query

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-fg">Jobs</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-1 p-1 bg-zinc-800/60 rounded-lg">
            <Link
              href="/jobs"
              className={`p-1.5 rounded transition-colors ${!isBoard ? 'bg-zinc-700 text-fg' : 'text-zinc-500 hover:text-fg'}`}
              title="List view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </Link>
            <Link
              href="/jobs?view=board"
              className={`p-1.5 rounded transition-colors ${isBoard ? 'bg-zinc-700 text-fg' : 'text-zinc-500 hover:text-fg'}`}
              title="Board view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/>
              </svg>
            </Link>
          </div>
          <Link href="/jobs/new" className="btn-primary flex items-center gap-2 text-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            New Ticket
          </Link>
        </div>
      </div>

      {isBoard ? (
        <JobKanban initialJobs={(jobs as unknown as Job[]) ?? []} />
      ) : (
        <>
          {/* Search & filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <form className="flex-1">
              <input
                name="q"
                defaultValue={q}
                type="search"
                placeholder="Search by device, fault, IMEI…"
                className="input"
              />
            </form>
          </div>

          {scan && (
            <div className="flex items-center gap-2 text-sm text-muted bg-surface-2 rounded-lg px-4 py-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                <line x1="7" y1="12" x2="7" y2="12"/><line x1="12" y1="7" x2="12" y2="17"/><line x1="17" y1="12" x2="17" y2="12"/>
              </svg>
              Scanned ticket: <span className="font-mono font-bold text-fg">{scan}</span>
              <Link href="/jobs" className="ml-auto text-primary hover:underline text-xs">Clear</Link>
            </div>
          )}

          {/* Status tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
            <Link href="/jobs" className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${!status ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg'}`}>
              All
            </Link>
            {STATUSES.map((s) => (
              <Link key={s} href={`/jobs?status=${s}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${status === s ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg'}`}>
                {JOB_STATUS_LABELS[s]}
              </Link>
            ))}
          </div>

          <JobsTable jobs={(jobs as unknown as Job[]) ?? []} />
        </>
      )}
    </div>
  )
}
