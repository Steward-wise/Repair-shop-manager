import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const [{ data: client }, { data: tickets }] = await Promise.all([
    supabase.from('support_clients').select('*').eq('id', id).single(),
    supabase.from('support_tickets').select('id, ticket_number, ticket_type, title, status, priority, created_at').eq('client_id', id).order('created_at', { ascending: false }),
  ])
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ client, tickets: tickets ?? [] })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await request.json()
  const allowed = ['company_name', 'contact_name', 'contact_email', 'contact_phone', 'address', 'website', 'client_type', 'industry', 'notes', 'monthly_value', 'sla_hours']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) { if (key in body) updates[key] = body[key] }
  const { data, error } = await supabase.from('support_clients').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data })
}
