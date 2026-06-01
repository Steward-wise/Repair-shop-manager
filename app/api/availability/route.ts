import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('availability').select('*').order('day_of_week')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ availability: data })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    const { slots } = await request.json()
    if (!Array.isArray(slots)) return NextResponse.json({ error: 'slots array required' }, { status: 400 })

    for (const slot of slots) {
      await supabase.from('availability').upsert({
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        slot_duration_mins: slot.slot_duration_mins,
        is_active: slot.is_active,
      }, { onConflict: 'day_of_week' })
    }

    return NextResponse.json({ saved: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
