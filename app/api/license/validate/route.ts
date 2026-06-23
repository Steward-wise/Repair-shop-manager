import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Public endpoint — called by template instances during setup wizard
// POST /api/license/validate
// Body: { key: string, domain?: string }
export async function POST(request: NextRequest) {
  try {
    const { key, domain } = await request.json()
    if (!key?.trim()) {
      return NextResponse.json({ valid: false, error: 'License key is required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: license, error } = await supabase
      .from('licenses')
      .select('*')
      .eq('key', key.trim().toUpperCase())
      .single()

    if (error || !license) {
      return NextResponse.json({ valid: false, error: 'Invalid license key' }, { status: 404 })
    }

    if (license.status === 'revoked') {
      return NextResponse.json({ valid: false, error: 'This license has been revoked' }, { status: 403 })
    }

    if (license.status === 'expired' || (license.expires_at && new Date(license.expires_at) < new Date())) {
      return NextResponse.json({ valid: false, error: 'This license has expired' }, { status: 403 })
    }

    // Track domain activation
    const domains: string[] = license.activated_domains ?? []
    const isNewDomain = domain && !domains.includes(domain)

    if (isNewDomain) {
      if (license.activations >= license.max_activations) {
        return NextResponse.json({
          valid: false,
          error: `License activation limit reached (${license.max_activations} deployments). Contact support to extend.`,
        }, { status: 403 })
      }
      await supabase
        .from('licenses')
        .update({
          activations: license.activations + 1,
          activated_domains: [...domains, domain],
        })
        .eq('id', license.id)
    }

    return NextResponse.json({
      valid: true,
      plan: license.plan,
      customer_name: license.customer_name,
      expires_at: license.expires_at,
      activations: license.activations + (isNewDomain ? 1 : 0),
      max_activations: license.max_activations,
    })
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid request' }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ service: 'Repair Shop License Server', status: 'ok' })
}
