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

const STATUS_COLORS: Record<string, string> = {
  intake: '#3b82f6', diagnosed: '#a855f7', in_progress: '#eab308',
  waiting_parts: '#f97316', ready: '#22c55e', collected: '#71717a',
}
const CHART_COLORS = ['#dc2626', '#3b82f6', '#22c55e', '#f97316', '#a855f7', '#eab308', '#ec4899', '#14b8a6']

const tooltipStyle = {
  contentStyle: { background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, color: '#f4f4f5', fontSize: 12 },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
}

function StatCard({ label, value, sub, warn }: { label: string; value: string | number; sub: string; warn?: boolean }) {
  return (
    <div className="card">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-2xl font-bold ${warn ? 'text-orange-400' : 'text-fg'}`}>{value}</p>
      <p className="text-xs text-muted mt-1">{sub}</p>
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

  const maxMonth = Math.max(...data.monthOverMonth.map((m) => m.revenue), 1)

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-fg">Reports</h1>
        <p className="text-muted text-sm mt-0.5">Last 30 days</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Jobs" value={data.totals.totalJobs} sub="last 30 days" />
        <StatCard label="Revenue" value={formatCurrency(data.totals.totalRevenue)} sub={`${data.totals.paidJobs} paid jobs`} />
        <StatCard label="Avg Job Value" value={formatCurrency(data.totals.avgJobValue)} sub="from paid jobs" />
        <StatCard label="Avg Repair Time" value={data.avgRepairDays != null ? `${data.avgRepairDays}d` : '—'} sub="intake to collected" />
        <StatCard label="Low Stock Parts" value={data.lowStock} sub="need reordering" warn={data.lowStock > 0} />
      </div>

      {/* Revenue area chart */}
      <div className="card">
        <h2 className="font-semibold text-fg mb-4">Daily Revenue — Last 30 Days</h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data.revenueByDay} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} interval={4} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => `£${v}`} width={52} />
            <Tooltip {...tooltipStyle} formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Revenue']} labelFormatter={(l) => `Date: ${l}`} />
            <Area type="monotone" dataKey="revenue" stroke="#dc2626" strokeWidth={2} fill="url(#revenueGrad)" dot={false} activeDot={{ r: 4, fill: '#dc2626' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Month-over-month + Jobs by status */}
      <div className="grid lg:grid-cols-2 gap-6">
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
                    const isUp = !prev || entry.revenue >= prev.revenue
                    return <Cell key={entry.month} fill={isUp ? '#22c55e' : '#ef4444'} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Jobs by status donut */}
        <div className="card">
          <h2 className="font-semibold text-fg mb-4">Jobs by Status</h2>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
                  {statusPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
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
      </div>

      {/* Busiest days + hours */}
      <div className="grid lg:grid-cols-2 gap-6">
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

        <div className="card">
          <h2 className="font-semibold text-fg mb-4">Busiest Hours</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={hourData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="hour" tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v) => [Number(v ?? 0), 'Jobs']} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {hourData.map((entry, i) => (
                  <Cell key={i} fill={entry.isWorking ? '#dc2626' : '#3f3f46'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Device type + top faults */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-fg mb-4">Jobs by Device Type</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={deviceData} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} width={70} />
              <Tooltip {...tooltipStyle} formatter={(v) => [Number(v ?? 0), 'Jobs']} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {deviceData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {data.topFaults.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-fg mb-4">Most Common Faults</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.topFaults.slice(0, 6)} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} />
                <YAxis type="category" dataKey="fault" tick={{ fill: '#71717a', fontSize: 10 }} width={100} />
                <Tooltip {...tooltipStyle} formatter={(v) => [Number(v ?? 0), 'Jobs']} />
                <Bar dataKey="count" fill="#a855f7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Technician performance table */}
      {data.techStats && data.techStats.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-fg mb-4">Technician Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-muted font-medium pb-3 pr-4">#</th>
                  <th className="text-left text-muted font-medium pb-3 pr-4">Technician</th>
                  <th className="text-right text-muted font-medium pb-3 pr-4">Jobs Completed</th>
                  <th className="text-right text-muted font-medium pb-3 pr-4">Revenue</th>
                  <th className="text-right text-muted font-medium pb-3">Time Logged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {data.techStats.map((t, i) => {
                  const h = Math.floor(t.total_minutes / 60)
                  const m = t.total_minutes % 60
                  const timeLabel = h > 0 ? `${h}h ${m}m` : t.total_minutes > 0 ? `${m}m` : '—'
                  return (
                    <tr key={t.technician} className="hover:bg-zinc-800/30 transition-colors">
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
