import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('it_quotes')
    .select('*, client:support_clients(id, company_name, contact_name, contact_email)')
    .eq('quote_token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ quote: data })
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: quote } = await supabase.from('it_quotes').select('id, status').eq('quote_token', token).single()
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (quote.status === 'accepted') return NextResponse.json({ ok: true, already: true })

  const { error } = await supabase
    .from('it_quotes')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', quote.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
