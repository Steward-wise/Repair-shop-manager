import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const ticket = searchParams.get('ticket')

  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const supabase = createAdminClient()

  // Look up customer by email
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('email', email)
    .single()

  if (!customer) return NextResponse.json({ jobs: [] })

  if (ticket) {
    const ticketNum = parseInt(ticket, 10)
    const { data: job } = await supabase
      .from('jobs')
      .select('*, customer:customers(id,name,phone,email), photos:job_photos(*), parts:job_parts(*)')
      .eq('customer_id', customer.id)
      .eq('ticket_number', ticketNum)
      .single()

    return NextResponse.json({ job: job ?? null })
  }

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id,ticket_number,device_type,device_make,device_model,status,quoted_price,final_price,created_at,updated_at')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ jobs: jobs ?? [] })
}
