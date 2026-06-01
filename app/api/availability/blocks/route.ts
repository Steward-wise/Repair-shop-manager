import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('availability_blocks')
    .select('*')
    .gte('block_date', new Date().toISOString().split('T')[0])
    .order('block_date')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ blocks: data })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    const body = await request.json()
    if (!body.block_date) return NextResponse.json({ error: 'block_date required' }, { status: 400 })
    const { data, error } = await supabase.from('availability_blocks').insert({
      block_date: body.block_date,
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      reason: body.reason || null,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ block: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
