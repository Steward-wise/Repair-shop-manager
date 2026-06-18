'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'
import { type Quote, QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS, type QuoteStatus } from '@/types'

const TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Sent', value: 'sent' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Declined', value: 'declined' },
  { label: 'Booked', value: 'booked' },
  { label: 'Closed', value: 'closed' },
]

export default function QuotesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get('status') ?? 'all'

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/quotes${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`)
    const data = await res.json()
    setQuotes(data.quotes ?? [])
    setSelected(new Set())
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleAll() {
    setSelected(prev => prev.size === quotes.length ? new Set() : new Set(quotes.map(q => q.id)))
  }

  async function bulkAction(action: 'send' | 'decline' | 'close' | 'delete') {
    if (!selected.size) return
    if (action === 'delete' && !confirm(`Permanently delete ${selected.size} quote${selected.size !== 1 ? 's' : ''}? This cannot be undone.`)) return
    setBulkLoading(true)
    const res = await fetch('/api/quotes/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected], action }),
    })
    const data = await res.json()
    setBulkLoading(false)
    if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
    if (action === 'send') toast.success(`Sent ${data.sent} quote${data.sent !== 1 ? 's' : ''}`)
    else if (action === 'delete') toast.success(`Deleted ${data.deleted} quote${data.deleted !== 1 ? 's' : ''}`)
    else toast.success(`Updated ${data.updated} quote${data.updated !== 1 ? 's' : ''}`)
    load()
  }

  async function deleteQuote(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Permanently delete this quote? This cannot be undone.')) return
    const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Quote deleted')
      setQuotes(prev => prev.filter(q => q.id !== id))
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? `Delete failed (HTTP ${res.status})`)
    }
  }

  const pendingCount = quotes.filter(q => q.status === 'pending').length

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46' } }} />
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-fg">Quotes</h1>
            {pendingCount > 0 && (
              <span className="bg-yellow-900/40 text-yellow-300 border border-yellow-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
          {TABS.map(tab => (
            <Link key={tab.value} href={`/quotes?status=${tab.value}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${statusFilter === tab.value ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg'}`}>
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 p-3 bg-surface-2 border border-border rounded-xl flex-wrap">
            <span className="text-sm text-muted">{selected.size} selected</span>
            <div className="flex gap-2 ml-auto flex-wrap">
              <button onClick={() => bulkAction('send')} disabled={bulkLoading} className="btn-primary text-sm py-1.5 px-3">
                {bulkLoading ? 'Working…' : 'Send Quotes'}
              </button>
              <button onClick={() => bulkAction('decline')} disabled={bulkLoading} className="btn-secondary text-sm py-1.5 px-3 text-red-400 border-red-800">
                Decline
              </button>
              <button onClick={() => bulkAction('close')} disabled={bulkLoading} className="btn-secondary text-sm py-1.5 px-3">
                Close
              </button>
              <button onClick={() => bulkAction('delete')} disabled={bulkLoading} className="btn-secondary text-sm py-1.5 px-3 text-red-400 border-red-800 hover:bg-red-950">
                Delete
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : quotes.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-muted text-sm">No quotes found</p>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="w-10 p-3">
                    <input type="checkbox" checked={selected.size === quotes.length && quotes.length > 0}
                      onChange={toggleAll} className="w-4 h-4 rounded border-border accent-primary" />
                  </th>
                  <th className="text-left p-3 text-muted font-medium">Customer</th>
                  <th className="text-left p-3 text-muted font-medium hidden sm:table-cell">Device</th>
                  <th className="text-left p-3 text-muted font-medium hidden md:table-cell">Problem</th>
                  <th className="text-left p-3 text-muted font-medium">Price</th>
                  <th className="text-left p-3 text-muted font-medium">Status</th>
                  <th className="text-left p-3 text-muted font-medium hidden lg:table-cell">Date</th>
                  <th className="w-10 p-3" />
                </tr>
              </thead>
              <tbody>
                {quotes.map(q => (
                  <tr key={q.id} className="group border-b border-border last:border-0 hover:bg-surface-2 cursor-pointer"
                    onClick={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') router.push(`/quotes/${q.id}`) }}>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleSelect(q.id)}
                        className="w-4 h-4 rounded border-border accent-primary" />
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-fg">{q.first_name} {q.last_name}</div>
                      <div className="text-xs text-muted">{q.email}</div>
                    </td>
                    <td className="p-3 text-muted hidden sm:table-cell">
                      {[q.device_type, q.device_make_model].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="p-3 text-muted hidden md:table-cell max-w-xs">
                      <span className="line-clamp-1">{q.problem_description}</span>
                    </td>
                    <td className="p-3 font-medium text-fg whitespace-nowrap">
                      {q.final_price != null ? `£${q.final_price.toFixed(2)}` : q.suggested_price != null ? <span className="text-muted">~£{q.suggested_price.toFixed(2)}</span> : <span className="text-muted">—</span>}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${QUOTE_STATUS_COLORS[q.status as QuoteStatus]}`}>
                        {QUOTE_STATUS_LABELS[q.status as QuoteStatus]}
                      </span>
                    </td>
                    <td className="p-3 text-muted text-xs hidden lg:table-cell whitespace-nowrap">
                      {new Date(q.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={e => deleteQuote(q.id, e)}
                        title="Delete quote"
                        className="text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
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
    </>
  )
}
