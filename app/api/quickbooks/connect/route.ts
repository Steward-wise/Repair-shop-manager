import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI ?? 'http://localhost:3000/api/quickbooks/callback'
  const sandbox = process.env.QUICKBOOKS_SANDBOX === 'true'

  if (!clientId) {
    return NextResponse.json({ error: 'QUICKBOOKS_CLIENT_ID not configured' }, { status: 500 })
  }

  const scope = 'com.intuit.quickbooks.accounting'
  const state = Math.random().toString(36).slice(2)
  const baseUrl = sandbox
    ? 'https://appcenter.intuit.com/connect/oauth2'
    : 'https://appcenter.intuit.com/connect/oauth2'

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    state,
  })

  return NextResponse.redirect(`${baseUrl}?${params.toString()}`)
}
