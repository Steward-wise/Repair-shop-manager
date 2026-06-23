import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getApiUserRole } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const { role } = await getApiUserRole()
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const settings: Record<string, string> = {}
  for (const row of data ?? []) settings[row.key] = row.value ?? ''
  return NextResponse.json({ settings }, {
    headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=60' },
  })
}

export async function POST(request: NextRequest) {
  const { role } = await getApiUserRole()
  if (role !== 'manager') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  try {
    const body = await request.json()
    // body: { key: string, value: string } or { settings: Record<string,string> }
    const pairs: { key: string; value: string }[] = body.settings
      ? Object.entries(body.settings as Record<string, string>).map(([key, value]) => ({ key, value }))
      : [{ key: body.key, value: body.value }]

    for (const { key, value } of pairs) {
      await supabase
        .from('app_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
