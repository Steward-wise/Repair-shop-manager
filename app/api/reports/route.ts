import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') ?? '30', 10)

  const since = new Date()
  since.setDate(since.getDate() - days)

  const fourMonthsAgo = new Date()
  fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 6)

  const [
    { data: jobs },
    { data: paidJobs },
    { data: paidJobsHistory },
    { data: collectedJobs },
    { data: inventory },
    { data: timeLogs },
    { data: collectedJobsForTech },
    { data: jobParts },
    { data: quotesData },
  ] = await Promise.all([
    supabase
      .from('jobs')
      .select('id,status,device_type,technician_name,final_price,quoted_price,created_at,payment_status,reported_fault,approval_sent_at')
      .gte('created_at', since.toISOString()),
    supabase
      .from('jobs')
      .select('id,final_price,created_at')
      .eq('payment_status', 'paid')
      .gte('created_at', since.toISOString()),
    supabase
      .from('jobs')
      .select('final_price,created_at')
      .eq('payment_status', 'paid')
      .gte('created_at', fourMonthsAgo.toISOString()),
    supabase
      .from('jobs')
      .select('id,created_at,collected_at,device_type,final_price')
      .eq('status', 'collected')
      .not('collected_at', 'is', null)
      .gte('created_at', since.toISOString()),
    supabase
      .from('inventory')
      .select('part_name,quantity,reorder_threshold,sell_price'),
    supabase
      .from('job_time_logs')
      .select('job_id,technician,started_at,ended_at')
      .not('ended_at', 'is', null),
    supabase
      .from('jobs')
      .select('technician_name,final_price')
      .eq('status', 'collected')
      .gte('created_at', since.toISOString()),
    // Parts used on paid jobs — for margin calculation
    supabase
      .from('job_parts')
      .select('job_id,unit_price,quantity,cost_price'),
    // Quote conversion: jobs where approval_sent_at is set (quote sent) vs paid
    supabase
      .from('jobs')
      .select('id,approval_sent_at,payment_status')
      .not('approval_sent_at', 'is', null)
      .gte('created_at', since.toISOString()),
  ])

  // ── REVENUE BY DAY ──
  const revenueByDay: Record<string, number> = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    revenueByDay[d.toISOString().slice(0, 10)] = 0
  }
  for (const j of paidJobs ?? []) {
    const day = j.created_at.slice(0, 10)
    if (day in revenueByDay) revenueByDay[day] = (revenueByDay[day] ?? 0) + (j.final_price ?? 0)
  }

  // ── WEEKLY REVENUE (last 8 weeks) ──
  const weekRevenue: Record<string, number> = {}
  for (const j of paidJobsHistory ?? []) {
    const d = new Date(j.created_at)
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = monday.toISOString().slice(0, 10)
    weekRevenue[key] = (weekRevenue[key] ?? 0) + (j.final_price ?? 0)
  }
  const weeklyRevenue = Object.entries(weekRevenue)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([week, revenue]) => ({ week: `w/c ${week.slice(5)}`, revenue }))

  // ── JOBS BY STATUS ──
  const byStatus: Record<string, number> = {}
  for (const j of jobs ?? []) {
    byStatus[j.status] = (byStatus[j.status] ?? 0) + 1
  }

  // ── JOBS BY DEVICE ──
  const byDevice: Record<string, number> = {}
  for (const j of jobs ?? []) {
    byDevice[j.device_type] = (byDevice[j.device_type] ?? 0) + 1
  }

  // ── BY TECH ──
  const byTech: Record<string, number> = {}
  for (const j of jobs ?? []) {
    const name = j.technician_name ?? 'Unassigned'
    byTech[name] = (byTech[name] ?? 0) + 1
  }

  // ── TOTALS ──
  const totalRevenue = (paidJobs ?? []).reduce((sum: number, j: { final_price: number | null }) => sum + (j.final_price ?? 0), 0)
  const totalJobs = (jobs ?? []).length
  const avgJobValue = paidJobs?.length ? totalRevenue / paidJobs.length : 0

  // ── BUSY HOURS ──
  const busyHours: number[] = Array(24).fill(0)
  for (const j of jobs ?? []) {
    const h = new Date(j.created_at).getHours()
    busyHours[h]++
  }

  // ── BUSY DAYS ──
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const busyDaysRaw: number[] = Array(7).fill(0)
  for (const j of jobs ?? []) {
    const d = new Date(j.created_at).getDay()
    busyDaysRaw[d]++
  }
  const busyDays = DAY_NAMES.map((name, i) => ({ name, count: busyDaysRaw[i] }))

  // ── MONTH-OVER-MONTH ──
  const monthRevenue: Record<string, number> = {}
  for (const j of paidJobsHistory ?? []) {
    const key = j.created_at.slice(0, 7)
    monthRevenue[key] = (monthRevenue[key] ?? 0) + (j.final_price ?? 0)
  }
  const monthOverMonth = Object.entries(monthRevenue)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([month, revenue]) => ({ month, revenue }))

  // ── TOP FAULTS ──
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

  // ── AVG REPAIR TIME (days) ──
  let avgRepairDays: number | null = null
  if (collectedJobs && collectedJobs.length > 0) {
    const total = collectedJobs.reduce((sum: number, j: { collected_at: string | null; created_at: string }) => {
      const ms = new Date(j.collected_at!).getTime() - new Date(j.created_at).getTime()
      return sum + ms / (1000 * 60 * 60 * 24)
    }, 0)
    avgRepairDays = Math.round((total / collectedJobs.length) * 10) / 10
  }

  // ── AVG REPAIR TIME BY DEVICE TYPE ──
  interface CollectedJobRow { id: string; created_at: string; collected_at: string | null; device_type: string; final_price: number | null }
  const deviceTimes: Record<string, number[]> = {}
  for (const j of (collectedJobs ?? []) as CollectedJobRow[]) {
    if (!j.collected_at) continue
    const mins = (new Date(j.collected_at).getTime() - new Date(j.created_at).getTime()) / 60000
    if (!deviceTimes[j.device_type]) deviceTimes[j.device_type] = []
    deviceTimes[j.device_type].push(mins)
  }
  const avgRepairByDevice = Object.entries(deviceTimes).map(([device_type, times]) => ({
    device_type,
    avg_hours: Math.round((times.reduce((a, b) => a + b, 0) / times.length / 60) * 10) / 10,
    job_count: times.length,
  })).sort((a, b) => b.job_count - a.job_count)

  // ── PARTS COST vs LABOUR MARGIN ──
  interface PartRow { job_id: string; unit_price: number | null; quantity: number; cost_price?: number | null }
  const partsCostByJob: Record<string, number> = {}
  for (const p of (jobParts ?? []) as PartRow[]) {
    const cost = (p.cost_price ?? p.unit_price ?? 0) * (p.quantity ?? 1)
    partsCostByJob[p.job_id] = (partsCostByJob[p.job_id] ?? 0) + cost
  }

  // Only paid jobs
  const paidJobIds = new Set((paidJobs ?? []).map((j: { id: string }) => j.id))
  let totalPartsCost = 0
  let totalMargin = 0
  let marginJobCount = 0
  const marginByDevice: Record<string, { revenue: number; parts_cost: number; count: number }> = {}

  for (const j of (collectedJobs ?? []) as CollectedJobRow[]) {
    if (!paidJobIds.has(j.id) || j.final_price == null) continue
    const partsCost = partsCostByJob[j.id] ?? 0
    const margin = j.final_price - partsCost
    totalPartsCost += partsCost
    totalMargin += margin
    marginJobCount++
    if (!marginByDevice[j.device_type]) marginByDevice[j.device_type] = { revenue: 0, parts_cost: 0, count: 0 }
    marginByDevice[j.device_type].revenue += j.final_price
    marginByDevice[j.device_type].parts_cost += partsCost
    marginByDevice[j.device_type].count++
  }

  const avgMargin = marginJobCount > 0 ? totalMargin / marginJobCount : 0
  const marginPct = totalRevenue > 0 ? Math.round((totalMargin / totalRevenue) * 100) : 0

  const marginByDeviceArr = Object.entries(marginByDevice).map(([device_type, d]) => ({
    device_type,
    revenue: Math.round(d.revenue * 100) / 100,
    parts_cost: Math.round(d.parts_cost * 100) / 100,
    margin: Math.round((d.revenue - d.parts_cost) * 100) / 100,
    count: d.count,
  })).sort((a, b) => b.margin - a.margin)

  // ── CONVERSION RATE ──
  const quotesSent = (quotesData ?? []).length
  const quotesConverted = (quotesData ?? []).filter((j: { payment_status: string }) => j.payment_status === 'paid').length
  const conversionRate = quotesSent > 0 ? Math.round((quotesConverted / quotesSent) * 100) : null

  // ── TECHNICIAN STATS ──
  interface TimeLogRow { job_id: string; technician: string | null; started_at: string; ended_at: string | null }
  const techMinutes: Record<string, number> = {}
  for (const log of (timeLogs ?? []) as TimeLogRow[]) {
    const name = log.technician ?? 'Unassigned'
    if (!log.ended_at) continue
    const mins = Math.round((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000)
    techMinutes[name] = (techMinutes[name] ?? 0) + mins
  }

  interface CollectedJobTechRow { technician_name: string | null; final_price: number | null }
  const techJobsCompleted: Record<string, number> = {}
  const techRevenue: Record<string, number> = {}
  for (const j of (collectedJobsForTech ?? []) as CollectedJobTechRow[]) {
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
    days,
    revenueByDay: Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue })),
    weeklyRevenue,
    byStatus,
    byDevice,
    byTech: Object.entries(byTech).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
    totals: {
      totalRevenue,
      totalJobs,
      avgJobValue,
      paidJobs: paidJobs?.length ?? 0,
      totalPartsCost: Math.round(totalPartsCost * 100) / 100,
      totalMargin: Math.round(totalMargin * 100) / 100,
      avgMargin: Math.round(avgMargin * 100) / 100,
      marginPct,
    },
    lowStock: (inventory ?? []).filter((i: { quantity: number; reorder_threshold: number }) => i.quantity <= i.reorder_threshold).length,
    busyHours,
    busyDays,
    monthOverMonth,
    topFaults,
    avgRepairDays,
    avgRepairByDevice,
    marginByDevice: marginByDeviceArr,
    conversionRate,
    quotesSent,
    quotesConverted,
    techStats,
  })
}
