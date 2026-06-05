'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { JOB_STATUS_LABELS, DEVICE_TYPE_LABELS } from '@/types'
import type { JobStatus, DeviceType } from '@/types'

interface ReportData {
  days: number
  revenueByDay: { date: string; revenue: number }[]
  weeklyRevenue: { week: string; revenue: number }[]
  byStatus: Record<string, number>
  byDevice: Record<string, number>
  byTech: { name: string; count: number }[]
  totals: {
    totalRevenue: number; totalJobs: number; avgJobValue: number; paidJobs: number
    totalPartsCost: number; totalMargin: number; avgMargin: number; marginPct: number
  }
  lowStock: number
  busyHours: number[]
  busyDays: { name: string; count: number }[]
  monthOverMonth: { month: string; revenue: number }[]
  topFaults: { fault: string; count: number }[]
  avgRepairDays: number | null
  avgRepairByDevice: { device_type: string; avg_hours: number; job_count: number }[]
  marginByDevice: { device_type: string; revenue: number; parts_cost: number; margin: number; count: number }[]
  conversionRate: number | null
  quotesSent: number
  quotesConverted: number
  techStats: { technician: string; jobs_completed: number; revenue: number; total_minutes: number }[]
}

const STATUS_COLORS: Record<string, string> = {
  intake: '#3b82f6', diagnosed: '#a855f7', awaiting_approval: '#ec4899',
  awaiting_repair: '#06b6d4', waiting_parts: '#f97316', in_progress: '#eab308',
  ready: '#22c55e', collected: '#71717a',
}
const CHART_COLORS = ['#dc2626', '#3b82f6', '#22c55e', '#f97316', '#a855f7', '#eab308', '#ec4899', '#14b8a6']

const tooltipStyle = {
  contentStyle: { background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, color: '#f4f4f5', fontSize: 12 },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
}

function StatCard({ label, value, sub, warn, highlight }: { label: string; value: string | number; sub: string; warn?: boolean; highlight?: boolean }) {
  return (
    <div className="card">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-2xl font-bold ${warn ? 'text-orange-400' : highlight ? 'text-green-400' : 'text-fg'}`}>{value}</p>
      <p className="text-xs text-muted mt-1">{sub}</p>
    </div>
  )
}

const RANGE_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
]

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports?days=${days}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
  }, [days])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const statusPieData = Object.entries(data.byStatus).map(([status, count]) => ({
    name: JOB_STATUS_LABELS[status as JobStatus] ?? status,
    value: count,
    color: STATUS_COLORS[status] ?? '#71717a',
  }))

  const deviceData = Object.entries(data.byDevice)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ name: DEVICE_TYPE_LABELS[type as DeviceType] ?? type, count }))

  const hourData = data.busyHours.map((count, h) => ({
    hour: h % 6 === 0 ? `${h === 0 ? '12am' : h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`}` : '',
    count,
    isWorking: h >= 8 && h <= 19,
  }))

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header + range selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">Reports</h1>
          <p className="text-muted text-sm mt-0.5">Last {days} days</p>
        </div>
        <div className="flex gap-1 p-1 bg-surface-2 rounded-lg">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${days === opt.value ? 'bg-surface text-fg shadow' : 'text-muted hover:text-fg'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SUMMARY STATS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Jobs" value={data.totals.totalJobs} sub={`last ${days} days`} />
        <StatCard label="Revenue" value={formatCurrency(data.totals.totalRevenue)} sub={`${data.totals.paidJobs} paid jobs`} />
        <StatCard label="Avg Job Value" value={formatCurrency(data.totals.avgJobValue)} sub="from paid jobs" />
        <StatCard label="Avg Repair Time" value={data.avgRepairDays != null ? `${data.avgRepairDays}d` : '—'} sub="intake to collected" />
      </div>

      {/* ── MARGIN STATS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Parts Cost" value={formatCurrency(data.totals.totalPartsCost)} sub="total parts on paid jobs" warn={data.totals.totalPartsCost > data.totals.totalRevenue * 0.5} />
        <StatCard label="Gross Margin" value={formatCurrency(data.totals.totalMargin)} sub="revenue minus parts" highlight={data.totals.marginPct >= 60} />
        <StatCard label="Margin %" value={data.totals.marginPct > 0 ? `${data.totals.marginPct}%` : '—'} sub="of total revenue" highlight={data.totals.marginPct >= 60} warn={data.totals.marginPct > 0 && data.totals.marginPct < 40} />
        <StatCard label="Low Stock Parts" value={data.lowStock} sub="need reordering" warn={data.lowStock > 0} />
      </div>

      {/* ── CONVERSION ── */}
      {data.quotesSent > 0 && (
        <div className="card">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="font-semibold text-fg">Quote Conversion</h2>
              <p className="text-xs text-muted mt-0.5">{data.quotesConverted} of {data.quotesSent} quotes converted to paid jobs</p>
            </div>
            <div className="text-right">
              <p className={`text-4xl font-bold ${(data.conversionRate ?? 0) >= 70 ? 'text-green-400' : (data.conversionRate ?? 0) >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                {data.conversionRate ?? 0}%
              </p>
              <p className="text-xs text-muted">conversion rate</p>
            </div>
          </div>
          <div className="mt-3 h-3 bg-surface-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${(data.conversionRate ?? 0) >= 70 ? 'bg-green-500' : (data.conversionRate ?? 0) >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${data.conversionRate ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {/* ── REVENUE AREA CHART ── */}
      <div className="card">
        <h2 className="font-semibold text-fg mb-4">Daily Revenue — Last {days} Days</h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data.revenueByDay} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} interval={Math.floor(days / 8)} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => `£${v}`} width={52} />
            <Tooltip {...tooltipStyle} formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Revenue']} labelFormatter={(l) => `Date: ${l}`} />
            <Area type="monotone" dataKey="revenue" stroke="#dc2626" strokeWidth={2} fill="url(#revenueGrad)" dot={false} activeDot={{ r: 4, fill: '#dc2626' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── WEEKLY + MONTHLY ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {data.weeklyRevenue.length > 1 && (
          <div className="card">
            <h2 className="font-semibold text-fg mb-4">Weekly Revenue</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.weeklyRevenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="week" tick={{ fill: '#71717a', fontSize: 10 }} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => `£${v}`} width={52} />
                <Tooltip {...tooltipStyle} formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Revenue']} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {data.weeklyRevenue.map((entry, i) => {
                    const prev = data.weeklyRevenue[i - 1]
                    return <Cell key={entry.week} fill={!prev || entry.revenue >= prev.revenue ? '#22c55e' : '#ef4444'} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {data.monthOverMonth.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-fg mb-4">Month-over-Month Revenue</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.monthOverMonth} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => `£${v}`} width={52} />
                <Tooltip {...tooltipStyle} formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Revenue']} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {data.monthOverMonth.map((entry, i) => {
                    const prev = data.monthOverMonth[i - 1]
                    return <Cell key={entry.month} fill={!prev || entry.revenue >= prev.revenue ? '#22c55e' : '#ef4444'} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── STATUS DONUT + DEVICE TYPE ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-fg mb-4">Jobs by Status</h2>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
                  {statusPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(v, name) => [Number(v ?? 0), String(name ?? '')]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              {statusPieData.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-zinc-400 truncate">{s.name}</span>
                  <span className="text-fg font-medium ml-auto">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-fg mb-4">Jobs by Device Type</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={deviceData} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} width={80} />
              <Tooltip {...tooltipStyle} formatter={(v) => [Number(v ?? 0), 'Jobs']} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {deviceData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── MARGIN BY DEVICE ── */}
      {data.marginByDevice.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-fg mb-4">Margin by Device Type</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted font-medium pb-3 pr-4">Device Type</th>
                  <th className="text-right text-muted font-medium pb-3 pr-4">Jobs</th>
                  <th className="text-right text-muted font-medium pb-3 pr-4">Revenue</th>
                  <th className="text-right text-muted font-medium pb-3 pr-4">Parts Cost</th>
                  <th className="text-right text-muted font-medium pb-3 pr-4">Gross Margin</th>
                  <th className="text-right text-muted font-medium pb-3">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.marginByDevice.map((row) => {
                  const pct = row.revenue > 0 ? Math.round((row.margin / row.revenue) * 100) : 0
                  return (
                    <tr key={row.device_type} className="hover:bg-surface-2/50">
                      <td className="py-3 pr-4 font-medium text-fg">{DEVICE_TYPE_LABELS[row.device_type as DeviceType] ?? row.device_type}</td>
                      <td className="py-3 pr-4 text-right text-muted">{row.count}</td>
                      <td className="py-3 pr-4 text-right text-fg">{formatCurrency(row.revenue)}</td>
                      <td className="py-3 pr-4 text-right text-muted">{formatCurrency(row.parts_cost)}</td>
                      <td className="py-3 pr-4 text-right text-fg font-medium">{formatCurrency(row.margin)}</td>
                      <td className={`py-3 text-right font-bold ${pct >= 60 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>{pct}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── REPAIR TIME BY DEVICE ── */}
      {data.avgRepairByDevice.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-fg mb-4">Average Repair Time by Device</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.avgRepairByDevice.map(d => ({ ...d, name: DEVICE_TYPE_LABELS[d.device_type as DeviceType] ?? d.device_type }))} layout="vertical" margin={{ top: 4, right: 60, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => `${v}h`} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} width={90} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${Number(v ?? 0)}h avg`, 'Repair time']} />
              <Bar dataKey="avg_hours" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                {data.avgRepairByDevice.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── TOP FAULTS + BUSY HOURS ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {data.topFaults.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-fg mb-4">Most Common Faults</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.topFaults.slice(0, 6)} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} />
                <YAxis type="category" dataKey="fault" tick={{ fill: '#71717a', fontSize: 10 }} width={110} />
                <Tooltip {...tooltipStyle} formatter={(v) => [Number(v ?? 0), 'Jobs']} />
                <Bar dataKey="count" fill="#a855f7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="card">
          <h2 className="font-semibold text-fg mb-4">Busiest Days of Week</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data.busyDays} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v) => [Number(v ?? 0), 'Jobs']} />
              <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── TECHNICIAN PERFORMANCE ── */}
      {data.techStats && data.techStats.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-fg">Technician Performance</h2>
            <a href="/technicians" className="text-xs text-primary hover:underline">Workload view →</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-muted font-medium pb-3 pr-4">#</th>
                  <th className="text-left text-muted font-medium pb-3 pr-4">Technician</th>
                  <th className="text-right text-muted font-medium pb-3 pr-4">Jobs Done</th>
                  <th className="text-right text-muted font-medium pb-3 pr-4">Revenue</th>
                  <th className="text-right text-muted font-medium pb-3 pr-4">Time Logged</th>
                  <th className="text-right text-muted font-medium pb-3">Revenue/hr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {data.techStats.map((t, i) => {
                  const h = Math.floor(t.total_minutes / 60)
                  const m = t.total_minutes % 60
                  const timeLabel = h > 0 ? `${h}h ${m}m` : t.total_minutes > 0 ? `${m}m` : '—'
                  const revenuePerHr = t.total_minutes > 0 ? (t.revenue / (t.total_minutes / 60)) : null
                  return (
                    <tr key={t.technician} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 pr-4 text-muted">{i + 1}</td>
                      <td className="py-3 pr-4 font-medium text-fg">{t.technician}</td>
                      <td className="py-3 pr-4 text-right text-fg">{t.jobs_completed}</td>
                      <td className="py-3 pr-4 text-right text-fg">{formatCurrency(t.revenue)}</td>
                      <td className="py-3 pr-4 text-right text-muted">{timeLabel}</td>
                      <td className="py-3 text-right text-muted">{revenuePerHr != null ? formatCurrency(revenuePerHr) : '—'}</td>
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
