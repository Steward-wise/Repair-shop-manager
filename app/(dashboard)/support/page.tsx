'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  type SupportTicket,
  type TicketStatus,
  type TicketType,
  formatTicketRef,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from '@/types'

const STATUSES: TicketStatus[] = ['open', 'in_progress', 'pending_client', 'resolved', 'closed']

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('open')
  const [typeFilter, setTypeFilter] = useState<TicketType | 'all'>('all')
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (q) params.set('q', q)
    const res = await fetch(`/api/support?${params}`)
    const json = await res.json()
    setTickets(json.tickets ?? [])
    setLoading(false)
  }, [statusFilter, typeFilter, q])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-fg">Support Queue</h1>
        <Link href="/support/new" className="btn-primary flex items-center gap-2 text-sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"/><path d="M12 5v14"/>
          </svg>
          New Ticket
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search tickets…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-fg placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-red-600"
          />
        </div>

        {/* Type */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TicketType | 'all')}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-fg focus:outline-none focus:ring-1 focus:ring-red-600"
        >
          <option value="all">All Types</option>
          <option value="service_desk">Service Desk</option>
          <option value="incident">Incident</option>
        </select>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${statusFilter === 'all' ? 'border-red-600 text-fg' : 'border-transparent text-zinc-400 hover:text-fg'}`}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${statusFilter === s ? 'border-red-600 text-fg' : 'border-transparent text-zinc-400 hover:text-fg'}`}
          >
            {TICKET_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <p className="text-sm">No tickets</p>
          <Link href="/support/new" className="btn-primary text-sm">Create first ticket</Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Ref</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide hidden md:table-cell">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide hidden sm:table-cell">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide hidden lg:table-cell">Opened</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    <Link href={`/support/${t.id}`} className="hover:text-fg transition-colors">
                      {formatTicketRef(t.ticket_type, t.ticket_number)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/support/${t.id}`} className="text-fg font-medium hover:text-red-400 transition-colors line-clamp-1">
                      {t.title}
                    </Link>
                    {t.contact_name && <p className="text-xs text-zinc-500 mt-0.5">{t.contact_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">
                    {t.client ? (
                      <Link href={`/clients/${t.client_id}`} className="hover:text-fg transition-colors">
                        {t.client.company_name}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {t.priority ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[t.priority]}`}>
                        {PRIORITY_LABELS[t.priority]}
                      </span>
                    ) : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TICKET_STATUS_COLORS[t.status]}`}>
                      {TICKET_STATUS_LABELS[t.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden lg:table-cell">
                    {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
