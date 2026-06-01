import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { buildDefaultTests } from '@/lib/phone-tests'

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const purpose = searchParams.get('purpose')

  let query = supabase
    .from('phone_checks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) query = query.eq('status', status)
  if (purpose) query = query.eq('purpose', purpose)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ checks: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()
  const { job_id, purpose = 'repair', platform } = body

  // Build default test list for this platform
  const tests = buildDefaultTests(platform)

  const { data, error } = await supabase
    .from('phone_checks')
    .insert({
      job_id: job_id ?? null,
      purpose,
      platform: platform ?? null,
      tests,
      status: 'in_progress',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ check: data }, { status: 201 })
}
