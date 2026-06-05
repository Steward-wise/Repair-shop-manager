import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('pos_sales').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  return NextResponse.json({ sale: data })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  try {
    const { voided } = await request.json()
    const { data, error } = await supabase
      .from('pos_sales')
      .update({ voided: true, voided_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    void voided
    return NextResponse.json({ sale: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
