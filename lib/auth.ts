import { createClient } from '@/lib/supabase/server'

export type UserRole = 'manager' | 'technician'

/** Read the role from the current session's user_metadata. Returns null when not authenticated. */
export async function getUserRole(): Promise<UserRole | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    return (user.user_metadata?.role as UserRole) === 'technician' ? 'technician' : 'manager'
  } catch {
    return null
  }
}

/** Returns { user, role } for use in layouts and server components. */
export async function getSessionWithRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role: UserRole | null = user
    ? ((user.user_metadata?.role as UserRole) === 'technician' ? 'technician' : 'manager')
    : null
  return { user, role }
}

/** Check role from an API route using the request's auth cookie. Returns null role when not authenticated. */
export async function getApiUserRole(): Promise<{ email: string | null; role: UserRole | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { email: null, role: null }
    const role: UserRole = (user.user_metadata?.role as UserRole) === 'technician' ? 'technician' : 'manager'
    return { email: user.email ?? null, role }
  } catch {
    return { email: null, role: null }
  }
}
