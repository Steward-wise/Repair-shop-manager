import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('quote_rules')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rules: data ?? [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, device_type, keywords, min_price, max_price, notes, sort_order } = body
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('quote_rules')
    .insert({
      name,
      device_type: device_type || null,
      keywords: keywords || null,
      min_price: min_price ?? null,
      max_price: max_price ?? null,
      notes: notes || null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data }, { status: 201 })
}
