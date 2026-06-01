import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data } = await supabase.from('ticket_timeline').select('*').eq('ticket_id', id).order('created_at', { ascending: false })
  return NextResponse.json({ events: data ?? [] })
}
