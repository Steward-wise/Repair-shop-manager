import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * GET /api/health
 *
 * Returns a JSON health report for uptime monitors to ping.
 * Responds 200 when all critical checks pass, 503 when any critical check fails.
 * External monitors (UptimeRobot, Better Uptime, etc.) should check for the
 * keyword "healthy" in the response body.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {}
  let allOk = true

  // ── 1. Supabase connectivity ───────────────────────────────────────────────
  try {
    const supabase = createAdminClient()
    // Lightweight query — just check we can reach the DB at all
    const { error } = await supabase.from('jobs').select('id').limit(1)
    if (error) throw error
    checks.database = { ok: true }
  } catch (e) {
    checks.database = { ok: false, detail: e instanceof Error ? e.message : String(e) }
    allOk = false
  }

  // ── 2. Critical environment variables ─────────────────────────────────────
  const requiredEnv = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'RESEND_API_KEY',
  ]
  const missingEnv = requiredEnv.filter(k => !process.env[k])
  checks.env_vars = missingEnv.length === 0
    ? { ok: true }
    : { ok: false, detail: `Missing: ${missingEnv.join(', ')}` }
  if (missingEnv.length > 0) allOk = false

  // ── 3. Owner notification email configured ─────────────────────────────────
  const ownerEmail = process.env.OWNER_EMAIL || process.env.REORDER_ALERT_EMAIL
  checks.owner_email = ownerEmail
    ? { ok: true }
    : { ok: false, detail: 'OWNER_EMAIL not set — booking notifications will not be delivered' }
  // Warn but don't mark allOk false (non-critical to uptime)

  // ── 4. Stripe webhook secret (warn only) ──────────────────────────────────
  checks.stripe = process.env.STRIPE_WEBHOOK_SECRET
    ? { ok: true }
    : { ok: false, detail: 'STRIPE_WEBHOOK_SECRET not set — payment webhooks may fail' }

  const status = allOk ? 'healthy' : 'degraded'

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: allOk ? 200 : 503,
      headers: {
        // Never cache — monitors need live results
        'Cache-Control': 'no-store',
      },
    }
  )
}
