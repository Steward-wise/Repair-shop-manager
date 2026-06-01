import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createAdminClient()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const fourMonthsAgo = new Date()
  fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4)

  const [
    { data: jobs },
    { data: paidJobs },
    { data: paidJobsHistory },
    { data: collectedJobs },
    { data: inventory },
    { data: timeLogs },
    { data: collectedJobsForTech },
  ] = await Promise.all([
    supabase
      .from('jobs')
      .select('id,status,device_type,technician_name,final_price,quoted_price,created_at,payment_status,reported_fault')
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('jobs')
      .select('final_price,created_at')
      .eq('payment_status', 'paid')
      .gte('created_at', thirtyDaysAgo.toISOString()),
    // 4 months for month-over-month
    supabase
      .from('jobs')
      .select('final_price,created_at')
      .eq('payment_status', 'paid')
      .gte('created_at', fourMonthsAgo.toISOString()),
    // Collected jobs for avg repair time
    supabase
      .from('jobs')
      .select('created_at,collected_at')
      .eq('status', 'collected')
      .not('collected_at', 'is', null)
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('inventory')
      .select('part_name,quantity,reorder_threshold,sell_price'),
    // Time logs for technician stats
    supabase
      .from('job_time_logs')
      .select('job_id,technician,started_at,ended_at')
      .not('ended_at', 'is', null),
    // Collected jobs for tech revenue
    supabase
      .from('jobs')
      .select('technician_name,final_price')
      .eq('status', 'collected')
      .gte('created_at', thirtyDaysAgo.toISOString()),
  ])

  // Revenue by day (last 30 days)
  const revenueByDay: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    revenueByDay[d.toISOString().slice(0, 10)] = 0
  }
  for (const j of paidJobs ?? []) {
    const day = j.created_at.slice(0, 10)
    if (day in revenueByDay) revenueByDay[day] = (revenueByDay[day] ?? 0) + (j.final_price ?? 0)
  }

  // Jobs by status
  const byStatus: Record<string, number> = {}
  for (const j of jobs ?? []) {
    byStatus[j.status] = (byStatus[j.status] ?? 0) + 1
  }

  // Jobs by device type
  const byDevice: Record<string, number> = {}
  for (const j of jobs ?? []) {
    byDevice[j.device_type] = (byDevice[j.device_type] ?? 0) + 1
  }

  // Jobs by technician
  const byTech: Record<string, number> = {}
  for (const j of jobs ?? []) {
    const name = j.technician_name ?? 'Unassigned'
    byTech[name] = (byTech[name] ?? 0) + 1
  }

  // Totals
  const totalRevenue = (paidJobs ?? []).reduce((sum: number, j: { final_price: number | null }) => sum + (j.final_price ?? 0), 0)
  const totalJobs = (jobs ?? []).length
  const avgJobValue = paidJobs?.length ? totalRevenue / paidJobs.length : 0

  // ── TREND DATA ──

  // Busy hours (0–23) — how many jobs created at each hour
  const busyHours: number[] = Array(24).fill(0)
  for (const j of jobs ?? []) {
    const h = new Date(j.created_at).getHours()
    busyHours[h]++
  }

  // Busy days of week (0=Sun … 6=Sat)
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const busyDaysRaw: number[] = Array(7).fill(0)
  for (const j of jobs ?? []) {
    const d = new Date(j.created_at).getDay()
    busyDaysRaw[d]++
  }
  const busyDays = DAY_NAMES.map((name, i) => ({ name, count: busyDaysRaw[i] }))

  // Month-over-month revenue (current + prior 3 months)
  const monthRevenue: Record<string, number> = {}
  for (const j of paidJobsHistory ?? []) {
    const key = j.created_at.slice(0, 7) // "YYYY-MM"
    monthRevenue[key] = (monthRevenue[key] ?? 0) + (j.final_price ?? 0)
  }
  const monthOverMonth = Object.entries(monthRevenue)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-4)
    .map(([month, revenue]) => ({ month, revenue }))

  // Top faults (by first 40 chars of reported_fault, normalised)
  const faultCounts: Record<string, number> = {}
  for (const j of jobs ?? []) {
    if (!j.reported_fault) continue
    const key = j.reported_fault.slice(0, 40).toLowerCase().trim()
    faultCounts[key] = (faultCounts[key] ?? 0) + 1
  }
  const topFaults = Object.entries(faultCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([fault, count]) => ({ fault: fault.charAt(0).toUpperCase() + fault.slice(1), count }))

  // Average repair time (days from created_at to collected_at)
  let avgRepairDays: number | null = null
  if (collectedJobs && collectedJobs.length > 0) {
    const total = collectedJobs.reduce((sum: number, j: { collected_at: string | null; created_at: string }) => {
      const ms = new Date(j.collected_at!).getTime() - new Date(j.created_at).getTime()
      return sum + ms / (1000 * 60 * 60 * 24)
    }, 0)
    avgRepairDays = Math.round((total / collectedJobs.length) * 10) / 10
  }

  // Technician stats from time logs
  interface TimeLogRow { job_id: string; technician: string | null; started_at: string; ended_at: string | null }
  const techMinutes: Record<string, number> = {}
  for (const log of (timeLogs ?? []) as TimeLogRow[]) {
    const name = log.technician ?? 'Unassigned'
    if (!log.ended_at) continue
    const mins = Math.round((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000)
    techMinutes[name] = (techMinutes[name] ?? 0) + mins
  }

  // Collected jobs / revenue per tech
  interface CollectedJobRow { technician_name: string | null; final_price: number | null }
  const techJobsCompleted: Record<string, number> = {}
  const techRevenue: Record<string, number> = {}
  for (const j of (collectedJobsForTech ?? []) as CollectedJobRow[]) {
    const name = j.technician_name ?? 'Unassigned'
    techJobsCompleted[name] = (techJobsCompleted[name] ?? 0) + 1
    techRevenue[name] = (techRevenue[name] ?? 0) + (j.final_price ?? 0)
  }

  const allTechs = new Set([...Object.keys(techMinutes), ...Object.keys(techJobsCompleted)])
  const techStats = Array.from(allTechs).map((technician) => ({
    technician,
    jobs_completed: techJobsCompleted[technician] ?? 0,
    revenue: techRevenue[technician] ?? 0,
    total_minutes: techMinutes[technician] ?? 0,
  })).sort((a, b) => b.jobs_completed - a.jobs_completed)

  return NextResponse.json({
    revenueByDay: Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue })),
    byStatus,
    byDevice,
    byTech: Object.entries(byTech)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count })),
    totals: { totalRevenue, totalJobs, avgJobValue, paidJobs: paidJobs?.length ?? 0 },
    lowStock: (inventory ?? []).filter((i: { quantity: number; reorder_threshold: number }) => i.quantity <= i.reorder_threshold).length,
    // Trend data
    busyHours,
    busyDays,
    monthOverMonth,
    topFaults,
    avgRepairDays,
    // Technician leaderboard
    techStats,
  })
}
