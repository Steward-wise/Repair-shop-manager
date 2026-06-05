'use client'

import { useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/utils'

interface AuditEntry {
  id: string
  action: string
  entity: string
  entity_id: string | null
  user_email: string | null
  description: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  'job.deleted': 'text-red-400',
  'customer.anonymised': 'text-red-400',
  'pos.sale_voided': 'text-red-400',
  'job.status_changed': 'text-blue-400',
  'job.payment_marked': 'text-green-400',
  'pos.sale_completed': 'text-green-400',
  'inventory.po_received': 'text-green-400',
  'user.role_changed': 'text-yellow-400',
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    fetch('/api/audit')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else setLogs(d.logs ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = logs.filter((l) => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (
      l.action.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q) ||
      (l.user_email ?? '').toLowerCase().includes(q) ||
      l.entity.toLowerCase().includes(q)
    )
  })

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="card border-red-800 text-center py-12">
      <p className="text-red-400">{error}</p>
      <p className="text-muted text-sm mt-2">Audit log access requires manager role.</p>
    </div>
  )

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">Audit Log</h1>
          <p className="text-muted text-sm mt-0.5">All significant actions — last {logs.length} entries</p>
        </div>
        <input
          type="search"
          className="input text-sm w-64"
          placeholder="Filter by action, user, description…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-muted">{filter ? 'No entries match your filter.' : 'No audit entries yet.'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="text-left text-muted font-medium py-3 px-4">When</th>
                  <th className="text-left text-muted font-medium py-3 px-4">Action</th>
                  <th className="text-left text-muted font-medium py-3 px-4">Description</th>
                  <th className="text-left text-muted font-medium py-3 px-4 hidden md:table-cell">User</th>
                  <th className="text-left text-muted font-medium py-3 px-4 hidden lg:table-cell">Entity</th>
                  <th className="py-3 px-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      className="hover:bg-surface-2/50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <td className="py-3 px-4 text-muted text-xs whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-mono text-xs font-medium ${ACTION_COLORS[log.action] ?? 'text-muted'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-fg max-w-[280px] truncate">{log.description}</td>
                      <td className="py-3 px-4 text-muted text-xs hidden md:table-cell">{log.user_email ?? '—'}</td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <span className="text-xs text-muted font-mono">{log.entity}</span>
                        {log.entity_id && (
                          <span className="text-xs text-muted/50 ml-1 font-mono">…{log.entity_id.slice(-6)}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-muted">
                        {(log.old_value || log.new_value) && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${expandedId === log.id ? 'rotate-180' : ''}`} strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6"/>
                          </svg>
                        )}
                      </td>
                    </tr>
                    {expandedId === log.id && (log.old_value || log.new_value) && (
                      <tr key={`${log.id}-detail`} className="bg-surface-2/30">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid sm:grid-cols-2 gap-4 text-xs font-mono">
                            {log.old_value && (
                              <div>
                                <p className="text-red-400 font-sans font-semibold mb-1 text-xs">Before</p>
                                <pre className="text-muted overflow-auto max-h-32 bg-surface p-2 rounded-lg">
                                  {JSON.stringify(log.old_value, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.new_value && (
                              <div>
                                <p className="text-green-400 font-sans font-semibold mb-1 text-xs">After</p>
                                <pre className="text-muted overflow-auto max-h-32 bg-surface p-2 rounded-lg">
                                  {JSON.stringify(log.new_value, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
