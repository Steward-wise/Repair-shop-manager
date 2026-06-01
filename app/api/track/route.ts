import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ticket = searchParams.get('ticket')

  if (!ticket) return NextResponse.json({ error: 'ticket required' }, { status: 400 })

  const ticketNum = parseInt(ticket, 10)
  if (isNaN(ticketNum)) return NextResponse.json({ error: 'invalid ticket number' }, { status: 400 })

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('jobs')
    .select('id,ticket_number,device_type,device_make,device_model,status,quoted_price,final_price,updated_at,created_at')
    .eq('ticket_number', ticketNum)
    .single()

  if (error || !data) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({ job: data })
}
