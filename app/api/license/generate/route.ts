import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

function generateKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = () => Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `RSP-${seg()}-${seg()}-${seg()}`
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    const body = await request.json()
    const { customer_email, customer_name, plan = 'standard', max_activations = 3, notes, expires_at } = body

    const key = generateKey()

    const { data, error } = await supabase
      .from('licenses')
      .insert({
        key,
        customer_email: customer_email?.trim() || null,
        customer_name: customer_name?.trim() || null,
        plan,
        max_activations,
        notes: notes?.trim() || null,
        expires_at: expires_at || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ license: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('licenses')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ licenses: data ?? [] })
}

export async function PATCH(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    const { id, status, notes, max_activations } = await request.json()
    const updates: Record<string, unknown> = {}
    if (status !== undefined) updates.status = status
    if (notes !== undefined) updates.notes = notes
    if (max_activations !== undefined) updates.max_activations = max_activations
    const { data, error } = await supabase.from('licenses').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ license: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
