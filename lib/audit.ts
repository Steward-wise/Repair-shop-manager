import { createAdminClient } from '@/lib/supabase/server'

export type AuditAction =
  | 'job.created' | 'job.deleted' | 'job.status_changed' | 'job.price_updated'
  | 'job.payment_marked' | 'customer.created' | 'customer.anonymised' | 'customer.updated'
  | 'pos.sale_completed' | 'pos.sale_voided'
  | 'inventory.po_received' | 'settings.updated'
  | 'user.role_changed'

export async function logAudit({
  action,
  entity,
  entityId,
  userEmail,
  description,
  oldValue,
  newValue,
}: {
  action: AuditAction
  entity: string
  entityId?: string
  userEmail?: string | null
  description: string
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
}) {
  try {
    const supabase = createAdminClient()
    await supabase.from('audit_log').insert({
      action,
      entity,
      entity_id: entityId ?? null,
      user_email: userEmail ?? null,
      description,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
    })
  } catch {
    // Never let audit logging crash the main request
  }
}
