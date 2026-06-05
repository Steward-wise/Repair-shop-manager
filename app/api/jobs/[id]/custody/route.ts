import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('job_custody_events')
    .select('*')
    .eq('job_id', id)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  try {
    const { event_type, direction, event_date, signature_url, person_name, notes } = await req.json()
    if (!event_type || !direction) {
      return NextResponse.json({ error: 'event_type and direction are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('job_custody_events')
      .insert({ job_id: id, event_type, direction, event_date: event_date || new Date().toISOString().split('T')[0], signature_url: signature_url || null, person_name: person_name || null, notes: notes || null })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Also log to job_notes timeline
    const label = event_type === 'intake' ? 'Device received (intake)' : event_type === 'return_to_customer' ? 'Device returned to customer' : 'Device collected by customer'
    await supabase.from('job_notes').insert({
      job_id: id,
      content: `${label}${person_name ? ` — ${person_name}` : ''}${notes ? `. ${notes}` : ''}`,
      note_type: 'custody',
      meta: { event_type, direction, custody_event_id: data.id, has_signature: !!signature_url },
    })

    return NextResponse.json({ event: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
