import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  try {
    const body = await request.json()
    const { part_name, sku, description, quantity, reorder_threshold, cost_price, sell_price, supplier } = body

    const updates: Record<string, unknown> = {}
    if (part_name !== undefined) updates.part_name = part_name
    if (sku !== undefined) updates.sku = sku
    if (description !== undefined) updates.description = description
    if (quantity !== undefined) updates.quantity = Number(quantity)
    if (reorder_threshold !== undefined) updates.reorder_threshold = Number(reorder_threshold)
    if (cost_price !== undefined) updates.cost_price = cost_price
    if (sell_price !== undefined) updates.sell_price = sell_price
    if (supplier !== undefined) updates.supplier = supplier

    const { data, error } = await supabase
      .from('inventory')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ item: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { error } = await supabase.from('inventory').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
