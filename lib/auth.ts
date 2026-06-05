import { createClient } from '@/lib/supabase/server'

export type UserRole = 'manager' | 'technician'

/** Read the role from the current session's user_metadata. Defaults to 'manager' so existing users aren't locked out. */
export async function getUserRole(): Promise<UserRole> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const role = user?.user_metadata?.role as UserRole | undefined
    return role === 'technician' ? 'technician' : 'manager'
  } catch {
    return 'manager'
  }
}

/** Returns { user, role } for use in layouts and server components. */
export async function getSessionWithRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role: UserRole = (user?.user_metadata?.role as UserRole) === 'technician' ? 'technician' : 'manager'
  return { user, role }
}

/** Check role from an API route using the request's auth cookie. */
export async function getApiUserRole(): Promise<{ email: string | null; role: UserRole }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { email: null, role: 'manager' }
    const role: UserRole = (user.user_metadata?.role as UserRole) === 'technician' ? 'technician' : 'manager'
    return { email: user.email ?? null, role }
  } catch {
    return { email: null, role: 'manager' }
  }
}
