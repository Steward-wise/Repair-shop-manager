import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const type = searchParams.get('type')

  let query = supabase.from('support_clients').select('*').order('company_name')
  if (q) query = query.ilike('company_name', `%${q}%`)
  if (type) query = query.eq('client_type', type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ clients: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()
  const { company_name, contact_name, contact_email, contact_phone, address, website, client_type, industry, notes, monthly_value, sla_hours } = body
  if (!company_name) return NextResponse.json({ error: 'company_name required' }, { status: 400 })
  const { data, error } = await supabase.from('support_clients').insert({ company_name, contact_name, contact_email, contact_phone, address, website, client_type: client_type ?? 'prospect', industry, notes, monthly_value, sla_hours: sla_hours ?? null }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data }, { status: 201 })
}
