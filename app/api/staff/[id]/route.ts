import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getApiUserRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { email: actorEmail, role: actorRole } = await getApiUserRole()
  if (actorRole !== 'manager') return NextResponse.json({ error: 'Manager access required' }, { status: 403 })

  const supabase = createAdminClient()
  try {
    const { role } = await request.json()
    if (!['manager', 'technician'].includes(role)) {
      return NextResponse.json({ error: 'role must be manager or technician' }, { status: 400 })
    }

    const { data, error } = await supabase.auth.admin.updateUserById(id, {
      user_metadata: { role },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit({
      action: 'user.role_changed',
      entity: 'user',
      entityId: id,
      userEmail: actorEmail,
      description: `Role changed to ${role} for ${data.user.email}`,
      newValue: { role, target_email: data.user.email },
    })

    return NextResponse.json({ user: { id, email: data.user.email, role } })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
