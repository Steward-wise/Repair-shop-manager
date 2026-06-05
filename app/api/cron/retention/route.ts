import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

/**
 * Data Retention Cron — UK GDPR Art. 5(1)(e) Storage Limitation
 *
 * Anonymises customers whose repair records are older than the configured
 * retention period (default 7 years). Anonymised = name/email/phone removed,
 * job records kept for financial compliance.
 *
 * Schedule this via Vercel Cron, GitHub Actions, or a system cron:
 *   - Vercel: add to vercel.json: { "crons": [{ "path": "/api/cron/retention", "schedule": "0 3 * * 0" }] }
 *   - Systemd/cron: curl -X POST https://yourapp.com/api/cron/retention -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  // Secure with a bearer token to prevent unauthorised triggers
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Read retention years from app_settings
  const { data: settingRow } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'data_retention_years')
    .single()
  const retentionYears = parseInt(settingRow?.value ?? '7', 10) || 7

  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - retentionYears)

  // Find customers whose most recent job is older than the retention period
  // and who haven't already been anonymised
  const { data: oldCustomers } = await supabase
    .from('customers')
    .select('id, name, email')
    .is('anonymised_at', null)
    .lt('updated_at', cutoff.toISOString())
    .limit(50) // process in batches

  if (!oldCustomers?.length) {
    return NextResponse.json({ anonymised: 0, message: 'No customers eligible for anonymisation' })
  }

  let anonymised = 0
  for (const customer of oldCustomers) {
    // Double-check: does this customer have any job newer than the cutoff?
    const { data: recentJobs } = await supabase
      .from('jobs')
      .select('id')
      .eq('customer_id', customer.id)
      .gt('created_at', cutoff.toISOString())
      .limit(1)

    if (recentJobs && recentJobs.length > 0) continue // Has recent jobs — skip

    const { error } = await supabase
      .from('customers')
      .update({
        name: 'Anonymised Customer',
        email: null,
        phone: null,
        notes: null,
        anonymised_at: new Date().toISOString(),
      })
      .eq('id', customer.id)

    if (!error) {
      await logAudit({
        action: 'customer.anonymised',
        entity: 'customer',
        entityId: customer.id,
        userEmail: 'system:retention-cron',
        description: `Auto-anonymised under ${retentionYears}-year data retention policy (was: ${customer.name})`,
        oldValue: { name: customer.name, email: customer.email },
        newValue: { name: 'Anonymised Customer', email: null },
      })
      anonymised++
    }
  }

  return NextResponse.json({
    anonymised,
    retention_years: retentionYears,
    cutoff: cutoff.toISOString(),
    message: `${anonymised} customer${anonymised !== 1 ? 's' : ''} anonymised`,
  })
}
