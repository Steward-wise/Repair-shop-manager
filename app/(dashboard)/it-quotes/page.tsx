'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { ITQuote, ITQuoteStatus } from '@/types'
import { IT_QUOTE_STATUS_LABELS } from '@/types'

const STATUS_COLORS: Record<ITQuoteStatus, string> = {
  draft: 'bg-zinc-800 text-zinc-400 border-zinc-600',
  sent: 'bg-blue-900/40 text-blue-300 border-blue-700',
  accepted: 'bg-green-900/40 text-green-300 border-green-700',
}

export default function ITQuotesPage() {
  const [quotes, setQuotes] = useState<ITQuote[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/it-quotes')
    const json = await res.json()
    setQuotes(json.quotes ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-fg">IT Quotes</h1>
        <Link href="/it-quotes/new" className="btn-primary flex items-center gap-2 text-sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"/><path d="M12 5v14"/>
          </svg>
          New Quote
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">Loading…</div>
      ) : quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <p className="text-sm">No IT quotes yet</p>
          <Link href="/it-quotes/new" className="btn-primary text-sm">Create First Quote</Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide hidden md:table-cell">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide hidden lg:table-cell">Valid Until</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide hidden lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map(q => (
                <tr key={q.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/it-quotes/${q.id}`} className="text-fg font-medium hover:text-red-400 transition-colors">
                      {q.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">
                    {q.client ? (
                      <Link href={`/clients/${q.client_id}`} className="hover:text-fg transition-colors">{q.client.company_name}</Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-fg">£{q.total.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[q.status]}`}>
                      {IT_QUOTE_STATUS_LABELS[q.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden lg:table-cell">
                    {q.valid_until ? new Date(q.valid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden lg:table-cell">
                    {new Date(q.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
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
