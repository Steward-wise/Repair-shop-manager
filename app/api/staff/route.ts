import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getApiUserRole } from '@/lib/auth'

export async function GET() {
  const { role } = await getApiUserRole()
  if (role !== 'manager') return NextResponse.json({ error: 'Manager access required' }, { status: 403 })

  const supabase = createAdminClient()
  // List all auth users via the admin API
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users = (data.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? '',
    role: (u.user_metadata?.role as string) ?? 'manager',
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }))

  return NextResponse.json({ users })
}
