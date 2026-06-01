'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { JOB_STATUS_LABELS, DEVICE_TYPE_LABELS } from '@/types'
import type { JobStatus, DeviceType } from '@/types'

interface ReportData {
  revenueByDay: { date: string; revenue: number }[]
  byStatus: Record<string, number>
  byDevice: Record<string, number>
  byTech: { name: string; count: number }[]
  totals: { totalRevenue: number; totalJobs: number; avgJobValue: number; paidJobs: number }
  lowStock: number
  busyHours: number[]
  busyDays: { name: string; count: number }[]
  monthOverMonth: { month: string; revenue: number }[]
  topFaults: { fault: string; count: number }[]
  avgRepairDays: number | null
  techStats: { technician: string; jobs_completed: number; revenue: number; total_minutes: number }[]
}

function Bar({ value, max, color = 'bg-primary' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reports')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
  }, [])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const maxRevenue = Math.max(...data.revenueByDay.map((d) => d.revenue), 1)
  const maxDevice = Math.max(...Object.values(data.byDevice), 1)
  const maxTech = Math.max(...data.byTech.map((t) => t.count), 1)
  const maxHour = Math.max(...data.busyHours, 1)
  const maxDay = Math.max(...data.busyDays.map((d) => d.count), 1)
  const maxMonth = Math.max(...data.monthOverMonth.map((m) => m.revenue), 1)
  const maxFault = Math.max(...data.topFaults.map((f) => f.count), 1)

  const statusColors: Record<string, string> = {
    intake: 'bg-blue-500', diagnosed: 'bg-purple-500', in_progress: 'bg-yellow-500',
    waiting_parts: 'bg-orange-500', ready: 'bg-green-500', collected: 'bg-zinc-500',
  }
  const totalStatusJobs = Object.values(data.byStatus).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-fg">Reports</h1>
        <p className="text-muted text-sm mt-0.5">Last 30 days</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Jobs', value: data.totals.totalJobs, sub: 'last 30 days' },
          { label: 'Revenue', value: formatCurrency(data.totals.totalRevenue), sub: `${data.totals.paidJobs} paid jobs` },
          { label: 'Avg Job Value', value: formatCurrency(data.totals.avgJobValue), sub: 'from paid jobs' },
          { label: 'Avg Repair Time', value: data.avgRepairDays != null ? `${data.avgRepairDays}d` : '—', sub: 'intake to collected' },
          { label: 'Low Stock Parts', value: data.lowStock, sub: 'need reordering', warn: data.lowStock > 0 },
        ].map((s) => (
          <div key={s.label} className="card">
            <p className="text-xs text-muted mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.warn ? 'text-warning' : 'text-fg'}`}>{s.value}</p>
            <p className="text-xs text-muted mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="card">
        <h2 className="font-semibold text-fg mb-4">Daily Revenue (Last 30 days)</h2>
        <div className="flex items-end gap-0.5 h-28">
          {data.revenueByDay.map((d) => {
            const pct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className="w-full bg-primary/70 hover:bg-primary rounded-sm transition-all cursor-pointer"
                  style={{ height: `${Math.max(pct, d.revenue > 0 ? 4 : 0)}%` }}
                  title={`${d.date}: ${formatCurrency(d.revenue)}`}
                />
                {d.revenue > 0 && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-surface border border-border rounded px-2 py-1 text-xs text-fg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {formatCurrency(d.revenue)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-xs text-muted mt-2">
          <span>{data.revenueByDay[0]?.date}</span>
          <span>{data.revenueByDay[data.revenueByDay.length - 1]?.date}</span>
        </div>
      </div>

      {/* Month-over-month */}
      {data.monthOverMonth.length > 1 && (
        <div className="card">
          <h2 className="font-semibold text-fg mb-4">Month-over-Month Revenue</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {data.monthOverMonth.map((m, i) => {
              const prev = data.monthOverMonth[i - 1]
              const change = prev && prev.revenue > 0 ? ((m.revenue - prev.revenue) / prev.revenue) * 100 : null
              return (
                <div key={m.month} className="text-center">
                  <p className="text-xs text-muted mb-1">{m.month}</p>
                  <p className="text-xl font-bold text-fg">{formatCurrency(m.revenue)}</p>
                  {change !== null && (
                    <p className={`text-xs mt-0.5 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                    </p>
                  )}
                  <div className="mt-2 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(m.revenue / maxMonth) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Jobs by status */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-fg">Jobs by Status</h2>
          {Object.entries(data.byStatus).map(([status, count]) => (
            <div key={status} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-fg">{JOB_STATUS_LABELS[status as JobStatus] ?? status}</span>
                <span className="text-muted">{count} ({totalStatusJobs > 0 ? Math.round(count / totalStatusJobs * 100) : 0}%)</span>
              </div>
              <Bar value={count} max={totalStatusJobs} color={statusColors[status] ?? 'bg-primary'} />
            </div>
          ))}
        </div>

        {/* Jobs by device */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-fg">Jobs by Device Type</h2>
          {Object.entries(data.byDevice)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <div key={type} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-fg">{DEVICE_TYPE_LABELS[type as DeviceType] ?? type}</span>
                  <span className="text-muted">{count}</span>
                </div>
                <Bar value={count} max={maxDevice} />
              </div>
            ))}
        </div>

        {/* Busiest days of week */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-fg">Busiest Days</h2>
          <div className="flex items-end gap-1 h-20">
            {data.busyDays.map((d) => {
              const pct = maxDay > 0 ? (d.count / maxDay) * 100 : 0
              return (
                <div key={d.name} className="flex-1 flex flex-col items-center gap-1 group">
                  <div
                    className="w-full bg-primary/60 hover:bg-primary rounded-sm transition-all cursor-default"
                    style={{ height: `${Math.max(pct, d.count > 0 ? 8 : 0)}%` }}
                    title={`${d.name}: ${d.count} jobs`}
                  />
                  <span className="text-xs text-muted">{d.name}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Busiest hours */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-fg">Busiest Hours</h2>
          <div className="flex items-end gap-px h-20">
            {data.busyHours.map((count, h) => {
              const pct = maxHour > 0 ? (count / maxHour) * 100 : 0
              const isWorkingHour = h >= 8 && h <= 19
              return (
                <div key={h} className="flex-1 flex flex-col items-center group">
                  <div
                    className={`w-full rounded-sm transition-all cursor-default ${isWorkingHour ? 'bg-primary/70 hover:bg-primary' : 'bg-surface-2'}`}
                    style={{ height: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                    title={`${h}:00 — ${count} jobs`}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>12am</span>
          </div>
        </div>

        {/* Top faults */}
        {data.topFaults.length > 0 && (
          <div className="card space-y-3">
            <h2 className="font-semibold text-fg">Most Common Faults</h2>
            {data.topFaults.map((f, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-fg truncate max-w-[240px]" title={f.fault}>{f.fault}</span>
                  <span className="text-muted flex-shrink-0 ml-2">{f.count}×</span>
                </div>
                <Bar value={f.count} max={maxFault} color="bg-violet-500" />
              </div>
            ))}
          </div>
        )}

        {/* Technician leaderboard */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-fg">Jobs by Technician</h2>
          {data.byTech.length === 0 ? (
            <p className="text-muted text-sm">No technician data yet.</p>
          ) : (
            <div className="space-y-3">
              {data.byTech.map((t, i) => (
                <div key={t.name} className="flex items-center gap-4">
                  <span className="text-xs text-muted w-4 text-right flex-shrink-0">{i + 1}</span>
                  <span className="text-sm text-fg w-40 truncate flex-shrink-0">{t.name}</span>
                  <div className="flex-1">
                    <Bar value={t.count} max={maxTech} />
                  </div>
                  <span className="text-sm font-medium text-fg w-8 text-right flex-shrink-0">{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Technician Performance */}
      {data.techStats && data.techStats.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-fg mb-4">Technician Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted font-medium pb-3 pr-4">#</th>
                  <th className="text-left text-muted font-medium pb-3 pr-4">Technician</th>
                  <th className="text-right text-muted font-medium pb-3 pr-4">Jobs Completed</th>
                  <th className="text-right text-muted font-medium pb-3 pr-4">Revenue</th>
                  <th className="text-right text-muted font-medium pb-3">Time Logged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.techStats.map((t, i) => {
                  const h = Math.floor(t.total_minutes / 60)
                  const m = t.total_minutes % 60
                  const timeLabel = h > 0 ? `${h}h ${m}m` : t.total_minutes > 0 ? `${m}m` : '—'
                  return (
                    <tr key={t.technician} className="hover:bg-surface-2 transition-colors">
                      <td className="py-3 pr-4 text-muted">{i + 1}</td>
                      <td className="py-3 pr-4 font-medium text-fg">{t.technician}</td>
                      <td className="py-3 pr-4 text-right text-fg">{t.jobs_completed}</td>
                      <td className="py-3 pr-4 text-right text-fg">{formatCurrency(t.revenue)}</td>
                      <td className="py-3 text-right text-muted">{timeLabel}</td>
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
