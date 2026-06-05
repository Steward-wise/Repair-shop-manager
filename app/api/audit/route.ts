import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getApiUserRole } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const { role } = await getApiUserRole()
  if (role !== 'manager') return NextResponse.json({ error: 'Manager access required' }, { status: 403 })

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const entity = searchParams.get('entity')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '200', 10), 500)

  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (entity) query = query.eq('entity', entity)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data })
}
