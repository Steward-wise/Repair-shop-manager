import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Day of week for requested date (0=Sun)
  const dayOfWeek = new Date(date + 'T12:00:00').getDay()

  const { data: avail } = await supabase
    .from('availability')
    .select('*')
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .single()

  if (!avail) return NextResponse.json({ slots: [], closed: true })

  const { data: blocks } = await supabase
    .from('availability_blocks')
    .select('*')
    .eq('block_date', date)

  if (blocks?.some((b: { start_time: string | null }) => !b.start_time)) {
    return NextResponse.json({ slots: [], closed: true, reason: blocks.find((b: { reason: string | null }) => b.reason)?.reason })
  }

  const { data: booked } = await supabase
    .from('appointments')
    .select('appointment_time')
    .eq('appointment_date', date)
    .neq('status', 'cancelled')

  const bookedTimes = new Set((booked ?? []).map((a: { appointment_time: string }) => a.appointment_time.substring(0, 5)))

  const [sh, sm] = avail.start_time.split(':').map(Number)
  const [eh, em] = avail.end_time.split(':').map(Number)
  const duration = avail.slot_duration_mins
  const endMins = eh * 60 + em

  const slots: string[] = []
  let cur = sh * 60 + sm
  while (cur + duration <= endMins) {
    const h = Math.floor(cur / 60)
    const m = cur % 60
    const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

    const inBlock = (blocks ?? []).some((b: { start_time: string | null; end_time: string | null }) => {
      if (!b.start_time) return false
      const bs = parseInt(b.start_time.split(':')[0]) * 60 + parseInt(b.start_time.split(':')[1])
      const be = b.end_time ? parseInt(b.end_time.split(':')[0]) * 60 + parseInt(b.end_time.split(':')[1]) : endMins
      return cur >= bs && cur < be
    })

    if (!bookedTimes.has(t) && !inBlock) slots.push(t)
    cur += duration
  }

  return NextResponse.json({ slots, duration })
}
