import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * GET /api/jobs/[id]/full
 *
 * Single endpoint that returns everything the job detail page needs in one
 * round-trip instead of 4:
 *   - job (with customer, photos, signature, parts)
 *   - time logs + total minutes
 *   - job notes (timeline)
 *   - custody events
 */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const [
    { data: job, error: jobError },
    { data: timeLogs },
    { data: notes },
    { data: custodyEvents },
  ] = await Promise.all([
    supabase
      .from('jobs')
      .select('*, customer:customers(id,name,phone,email), photos:job_photos(*), signature:signatures(*), parts:job_parts(*)')
      .eq('id', id)
      .single(),
    supabase
      .from('job_time_logs')
      .select('*')
      .eq('job_id', id)
      .order('started_at', { ascending: false }),
    supabase
      .from('job_notes')
      .select('*')
      .eq('job_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('job_custody_events')
      .select('*')
      .eq('job_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message ?? 'Job not found' }, { status: 404 })
  }

  // Compute duration_minutes for completed time log entries
  type RawTimeLog = { id: string; started_at: string; ended_at: string | null; [key: string]: unknown }
  const enrichedLogs = (timeLogs ?? []).map((log: RawTimeLog) => {
    if (!log.ended_at) return { ...log, duration_minutes: null }
    const ms = new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()
    return { ...log, duration_minutes: Math.round(ms / 60000) }
  })

  type EnrichedLog = RawTimeLog & { duration_minutes: number | null }
  const totalMinutes = (enrichedLogs as EnrichedLog[])
    .filter((l) => l.duration_minutes != null)
    .reduce((sum: number, l: EnrichedLog) => sum + (l.duration_minutes as number), 0)

  return NextResponse.json({
    job,
    timeLogs: enrichedLogs,
    totalMinutes,
    notes: notes ?? [],
    custodyEvents: custodyEvents ?? [],
  })
}
