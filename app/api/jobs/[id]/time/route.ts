import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

interface RouteParams { params: Promise<{ id: string }> }

/** GET /api/jobs/[id]/time — list all time logs for a job */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: logs, error } = await supabase
    .from('job_time_logs')
    .select('*')
    .eq('job_id', id)
    .order('started_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type TimeLog = { id: string; started_at: string; ended_at: string | null; duration_minutes?: number | null; [key: string]: unknown }

  // Compute duration_minutes for completed entries
  const enriched: TimeLog[] = (logs ?? []).map((log: TimeLog) => {
    if (!log.ended_at) return { ...log, duration_minutes: null }
    const ms = new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()
    return { ...log, duration_minutes: Math.round(ms / 60000) }
  })

  const totalMinutes = enriched
    .filter((l) => l.duration_minutes != null)
    .reduce((sum: number, l: TimeLog) => sum + (l.duration_minutes ?? 0), 0)

  return NextResponse.json({ logs: enriched, total_minutes: totalMinutes })
}

/** POST /api/jobs/[id]/time — start a new timer */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = createAdminClient()

  const body = await request.json().catch(() => ({}))
  const technician = body.technician ?? null

  const { data: log, error } = await supabase
    .from('job_time_logs')
    .insert({ job_id: id, technician, started_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ log }, { status: 201 })
}

/** PATCH /api/jobs/[id]/time — stop a timer or add notes (body: { logId, notes? }) */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = createAdminClient()

  const body = await request.json().catch(() => ({}))
  const { logId, notes } = body as { logId?: string; notes?: string }

  if (!logId) return NextResponse.json({ error: 'logId required' }, { status: 400 })

  const update: Record<string, unknown> = { ended_at: new Date().toISOString() }
  if (notes !== undefined) update.notes = notes

  const { data: log, error } = await supabase
    .from('job_time_logs')
    .update(update)
    .eq('id', logId)
    .eq('job_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ms = new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()
  return NextResponse.json({ log: { ...log, duration_minutes: Math.round(ms / 60000) } })
}
