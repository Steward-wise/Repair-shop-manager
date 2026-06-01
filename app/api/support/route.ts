import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const q = searchParams.get('q')

  let query = supabase
    .from('support_tickets')
    .select('*, client:support_clients(id, company_name, contact_name)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) query = query.eq('status', status)
  if (type) query = query.eq('ticket_type', type)
  if (q) query = query.or(`title.ilike.%${q}%,contact_name.ilike.%${q}%,contact_email.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tickets: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()
  const { title, description, ticket_type, priority, client_id, contact_name, contact_email, contact_phone, assigned_to, technician_id } = body

  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  // Calculate SLA due date if client has SLA hours set
  let sla_due_at: string | null = null
  if (client_id) {
    const { data: client } = await supabase
      .from('support_clients')
      .select('sla_hours')
      .eq('id', client_id)
      .single()
    if (client?.sla_hours) {
      const due = new Date()
      due.setHours(due.getHours() + client.sla_hours)
      sla_due_at = due.toISOString()
    }
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({ title, description, ticket_type: ticket_type ?? 'service_desk', priority: priority ?? null, client_id: client_id ?? null, contact_name, contact_email, contact_phone, assigned_to, technician_id: technician_id ?? null, sla_due_at })
    .select('*, client:support_clients(id, company_name), technician:technicians(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Add created event to timeline
  await supabase.from('ticket_timeline').insert({
    ticket_id: data.id,
    event_type: 'created',
    description: `Ticket created`,
  })

  return NextResponse.json({ ticket: data }, { status: 201 })
}
