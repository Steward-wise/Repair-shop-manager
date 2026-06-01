import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  try {
    const body = await request.json()
    const allowed = ['status', 'notes', 'appointment_date', 'appointment_time']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) { if (key in body) updates[key] = body[key] }
    const { data, error } = await supabase.from('appointments').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ appointment: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id)
  return NextResponse.json({ cancelled: true })
}
