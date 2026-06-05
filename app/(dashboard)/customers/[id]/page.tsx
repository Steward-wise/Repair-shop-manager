import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import JobStatusBadge from '@/components/job-status-badge'
import GdprDeleteButton from '@/components/gdpr-delete-button'
import { formatTicketNumber, formatDateTime, formatCurrency } from '@/lib/utils'
import type { Job, Customer } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('customers').select('name').eq('id', id).single()
  return { title: data?.name ?? 'Customer' }
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: customer }, { data: jobs }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).single(),
    supabase
      .from('jobs')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!customer) notFound()

  const c = customer as Customer
  const totalSpend = (jobs as Job[])?.reduce((acc, j) => acc + (j.final_price ?? 0), 0) ?? 0

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <Link href="/customers" className="text-muted hover:text-fg transition-colors mt-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-fg">{c.name}</h1>
          <p className="text-muted text-sm mt-0.5">
            {c.phone ?? ''}{c.phone && c.email ? ' · ' : ''}{c.email ?? ''}
          </p>
        </div>
        <Link href="/jobs/new" className="btn-primary text-sm flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"/><path d="M12 5v14"/>
          </svg>
          New Job
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-fg">{jobs?.length ?? 0}</p>
          <p className="text-xs text-muted mt-1">Total repairs</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-fg">{formatCurrency(totalSpend)}</p>
          <p className="text-xs text-muted mt-1">Total spend</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-fg">
            {jobs?.filter((j) => (j as Job).status !== 'collected').length ?? 0}
          </p>
          <p className="text-xs text-muted mt-1">Active jobs</p>
        </div>
      </div>

      {/* Customer details */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-fg">Contact Details</h2>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          {c.phone && (
            <div>
              <dt className="text-muted text-xs mb-1">Phone</dt>
              <dd><a href={`tel:${c.phone}`} className="text-primary hover:underline font-medium">{c.phone}</a></dd>
            </div>
          )}
          {c.email && (
            <div>
              <dt className="text-muted text-xs mb-1">Email</dt>
              <dd><a href={`mailto:${c.email}`} className="text-primary hover:underline">{c.email}</a></dd>
            </div>
          )}
          {c.notes && (
            <div className="sm:col-span-2">
              <dt className="text-muted text-xs mb-1">Notes</dt>
              <dd className="text-fg">{c.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* GDPR */}
      <GdprDeleteButton customerId={id} customerName={c.name} />

      {/* Job history */}
      <div className="card">
        <h2 className="font-semibold text-fg mb-4">Repair History</h2>
        {!jobs?.length ? (
          <p className="text-muted text-sm">No repairs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted font-medium pb-3 pr-4">Ticket</th>
                  <th className="text-left text-muted font-medium pb-3 pr-4">Device</th>
                  <th className="text-left text-muted font-medium pb-3 pr-4">Fault</th>
                  <th className="text-left text-muted font-medium pb-3 pr-4">Status</th>
                  <th className="text-right text-muted font-medium pb-3">Value</th>
                  <th className="text-right text-muted font-medium pb-3 pl-4 hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(jobs as Job[]).map((job) => (
                  <tr key={job.id} className="hover:bg-surface-2 transition-colors">
                    <td className="py-3 pr-4">
                      <Link href={`/jobs/${job.id}`} className="font-mono text-primary hover:underline text-xs font-medium">
                        {formatTicketNumber(job.ticket_number)}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-muted">{job.device_make} {job.device_model}</td>
                    <td className="py-3 pr-4 text-fg max-w-[160px] truncate">{job.reported_fault}</td>
                    <td className="py-3 pr-4"><JobStatusBadge status={job.status} /></td>
                    <td className="py-3 text-right text-muted">{formatCurrency(job.final_price ?? job.quoted_price)}</td>
                    <td className="py-3 pl-4 text-right text-muted text-xs hidden sm:table-cell whitespace-nowrap">{formatDateTime(job.created_at)}</td>
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
