import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const ticketId = searchParams.get('ticket_id')

  let query = supabase
    .from('it_quotes')
    .select('*, client:support_clients(id, company_name)')
    .order('created_at', { ascending: false })

  if (ticketId) query = query.eq('ticket_id', ticketId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quotes: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()
  const { title, client_id, ticket_id, items = [], notes, vat_rate = 20, valid_until } = body
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const subtotal = items.reduce((s: number, i: { quantity: number; unit_price: number }) => s + i.quantity * i.unit_price, 0)
  const total = subtotal * (1 + vat_rate / 100)

  const { data, error } = await supabase
    .from('it_quotes')
    .insert({ title, client_id: client_id ?? null, ticket_id: ticket_id ?? null, items, subtotal, vat_rate, total, notes, valid_until })
    .select('*, client:support_clients(id, company_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If this quote is linked to a ticket, add a timeline event
  if (ticket_id && data) {
    await supabase.from('ticket_timeline').insert({
      ticket_id,
      event_type: 'quote_created',
      description: `IT Quote created: ${title} (£${total.toFixed(2)} inc. VAT)`,
    })
    await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticket_id)
  }

  return NextResponse.json({ quote: data }, { status: 201 })
}
