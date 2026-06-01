import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('it_quotes')
    .select('*, client:support_clients(id, company_name, contact_name, contact_email)')
    .eq('id', id)
    .single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ quote: data })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await request.json()
  const allowed = ['title', 'client_id', 'ticket_id', 'items', 'notes', 'vat_rate', 'valid_until', 'status']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) { if (key in body) updates[key] = body[key] }

  // Recalculate totals if items or vat_rate changed
  if (updates.items !== undefined || updates.vat_rate !== undefined) {
    const { data: existing } = await supabase.from('it_quotes').select('items, vat_rate').eq('id', id).single()
    const items = (updates.items ?? existing?.items ?? []) as { quantity: number; unit_price: number }[]
    const vatRate = (updates.vat_rate ?? existing?.vat_rate ?? 20) as number
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    updates.subtotal = subtotal
    updates.total = subtotal * (1 + vatRate / 100)
  }

  const { data, error } = await supabase
    .from('it_quotes')
    .update(updates)
    .eq('id', id)
    .select('*, client:support_clients(id, company_name, contact_name, contact_email)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quote: data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { error } = await supabase.from('it_quotes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
