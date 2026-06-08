import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('inventory')
    .select('id,part_name,sku,quantity,reorder_threshold,sell_price,cost_price,supplier,supplier_email,category,location')
    .order('part_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Cache for 60s — inventory doesn't change on every request
  return NextResponse.json({ items: data }, {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=30' },
  })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()

  try {
    const body = await request.json()
    const { part_name, sku, description, quantity, reorder_threshold, cost_price, sell_price, supplier } = body

    if (!part_name?.trim()) {
      return NextResponse.json({ error: 'part_name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('inventory')
      .insert({
        part_name: part_name.trim(),
        sku: sku || null,
        description: description || null,
        quantity: Number(quantity) || 0,
        reorder_threshold: Number(reorder_threshold) || 5,
        cost_price: cost_price || null,
        sell_price: sell_price || null,
        supplier: supplier || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ item: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
