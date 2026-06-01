'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PhoneCheck } from '@/types'
import { GRADE_COLORS } from '@/lib/phone-tests'

const STATUS_COLORS: Record<string, string> = {
  clean: 'text-green-400',
  locked: 'text-red-400',
  supervised: 'text-yellow-400',
  blacklisted: 'text-red-400',
  unknown: 'text-zinc-500',
}
const STATUS_ICONS: Record<string, string> = {
  clean: '✓', locked: '✕', supervised: '⚠', blacklisted: '✕', unknown: '?',
}

function SecurityDot({ status }: { status: string }) {
  return (
    <span className={`font-bold ${STATUS_COLORS[status] ?? 'text-zinc-500'}`} title={status}>
      {STATUS_ICONS[status] ?? '?'}
    </span>
  )
}

function maskImei(imei: string | null) {
  if (!imei) return '—'
  return imei.slice(0, 6) + '·'.repeat(imei.length - 10) + imei.slice(-4)
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function passCount(tests: PhoneCheck['tests']) {
  const done = tests.filter(t => t.selected && t.result && t.result !== 'skip')
  const pass = done.filter(t => t.result === 'pass').length
  return { pass, fail: done.length - pass, total: done.length }
}

export default function PhoneCheckListPage() {
  const router = useRouter()
  const [checks, setChecks] = useState<PhoneCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'completed'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('status', filter)
    const res = await fetch(`/api/phone-check?${params}`)
    const json = await res.json()
    setChecks(json.checks ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function deleteCheck(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/phone-check/${id}`, { method: 'DELETE' })
      setChecks(prev => prev.filter(c => c.id !== id))
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  async function newCheck(purpose: 'repair' | 'valuation') {
    setCreating(true)
    const res = await fetch('/api/phone-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose }),
    })
    const json = await res.json()
    if (json.check?.id) router.push(`/phone-check/${json.check.id}`)
    else setCreating(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-fg">Phone Check</h1>
          <p className="text-muted text-sm mt-0.5">Device diagnostics, IMEI checks & grading</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => newCheck('repair')} disabled={creating} className="btn-primary text-sm flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            {creating ? 'Starting…' : 'New Repair Check'}
          </button>
          <button onClick={() => newCheck('valuation')} disabled={creating} className="btn-secondary text-sm flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            Valuation Check
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-zinc-800/60 rounded-lg w-fit">
        {(['all', 'in_progress', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors capitalize ${filter === f ? 'bg-primary text-white shadow-sm' : 'text-zinc-400 hover:text-fg'}`}>
            {f === 'in_progress' ? 'In Progress' : f === 'all' ? 'All' : 'Completed'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">Loading…</div>
      ) : checks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-4">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><path d="M12 18h.01"/>
          </svg>
          <p className="text-sm">No phone checks yet</p>
          <button onClick={() => newCheck('repair')} className="btn-primary text-sm">Start First Check</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Device</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide hidden md:table-cell">IMEI</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Security</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide hidden sm:table-cell">Tests</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Grade</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide hidden lg:table-cell">Purpose</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide hidden lg:table-cell">Date</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {checks.map(c => {
                  const counts = passCount(c.tests ?? [])
                  return (
                    <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer" onClick={() => router.push(`/phone-check/${c.id}`)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{c.platform === 'ios' ? '🍎' : c.platform === 'android' ? '🤖' : '📱'}</span>
                          <div>
                            <p className="text-fg font-medium truncate max-w-[160px]">
                              {c.device_name ?? c.model ?? 'Unknown Device'}
                            </p>
                            {c.os_version && <p className="text-xs text-zinc-500">{c.os_version}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400 hidden md:table-cell">
                        {maskImei(c.imei)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-xs">
                          <span title="Blacklist"><SecurityDot status={c.blacklist_status} /></span>
                          <span title="FRP"><SecurityDot status={c.frp_status} /></span>
                          <span title={c.platform === 'ios' ? 'iCloud' : 'MDM'}><SecurityDot status={c.platform === 'ios' ? c.icloud_status : c.mdm_status} /></span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {counts.total > 0 ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-green-400">{counts.pass}✓</span>
                            {counts.fail > 0 && <span className="text-red-400">{counts.fail}✕</span>}
                            <span className="text-zinc-600">/{counts.total}</span>
                          </div>
                        ) : <span className="text-zinc-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.grade ? (
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${GRADE_COLORS[c.grade] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                            {c.grade}
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            c.status === 'completed' ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-yellow-900/30 text-yellow-300 border-yellow-800'
                          }`}>
                            {c.status === 'completed' ? 'Done' : 'In Progress'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-zinc-500 capitalize">{c.purpose}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 hidden lg:table-cell whitespace-nowrap">
                        {fmtDate(c.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          {confirmDeleteId === c.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => deleteCheck(c.id)}
                                disabled={deletingId === c.id}
                                className="px-2 py-0.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition-colors disabled:opacity-50"
                              >
                                {deletingId === c.id ? '…' : 'Delete'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-0.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(c.id)}
                              className="p-1 text-zinc-600 hover:text-red-400 transition-colors rounded"
                              title="Delete check"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                            </button>
                          )}
                          <Link href={`/phone-check/${c.id}`} className="text-zinc-500 hover:text-fg transition-colors p-1">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
