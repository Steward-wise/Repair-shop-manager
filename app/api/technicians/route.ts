import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('technicians')
    .select('*')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ technicians: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()
  const { name, email, phone } = body
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const { data, error } = await supabase
    .from('technicians')
    .insert({ name: name.trim(), email: email || null, phone: phone || null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ technician: data }, { status: 201 })
}
