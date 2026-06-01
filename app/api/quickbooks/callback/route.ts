import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')

  if (!code || !realmId) {
    return NextResponse.redirect(new URL('/settings?qb=error', request.url))
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID!
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI ?? 'http://localhost:3000/api/quickbooks/callback'
  const sandbox = process.env.QUICKBOOKS_SANDBOX === 'true'

  const tokenUrl = sandbox
    ? 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
    : 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    const tokens = await res.json()
    if (!res.ok || !tokens.access_token) {
      return NextResponse.redirect(new URL('/settings?qb=error', request.url))
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    const supabase = createAdminClient()

    // Upsert — we only ever store one QB connection
    const existing = await supabase.from('quickbooks_tokens').select('id').limit(1).single()
    if (existing.data) {
      await supabase.from('quickbooks_tokens').update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        realm_id: realmId,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.data.id)
    } else {
      await supabase.from('quickbooks_tokens').insert({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        realm_id: realmId,
        expires_at: expiresAt,
      })
    }

    return NextResponse.redirect(new URL('/settings?qb=connected', request.url))
  } catch {
    return NextResponse.redirect(new URL('/settings?qb=error', request.url))
  }
}
