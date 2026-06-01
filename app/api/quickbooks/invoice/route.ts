import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

async function getValidToken(supabase: ReturnType<typeof createAdminClient>) {
  const { data: token } = await supabase
    .from('quickbooks_tokens')
    .select('*')
    .limit(1)
    .single()

  if (!token) return null

  // Refresh if expired (or within 5 min of expiry)
  if (new Date(token.expires_at).getTime() - Date.now() < 5 * 60 * 1000) {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID!
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!
    const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refresh_token }),
    })
    const refreshed = await res.json()
    if (res.ok && refreshed.access_token) {
      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      await supabase.from('quickbooks_tokens').update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? token.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }).eq('id', token.id)
      return { ...token, access_token: refreshed.access_token }
    }
    return null // refresh failed
  }

  return token
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const { jobId } = await request.json()

  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  const token = await getValidToken(supabase)
  if (!token) return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 503 })

  // Fetch job details
  const { data: job } = await supabase
    .from('jobs')
    .select('*, customer:customers(name,email)')
    .eq('id', jobId)
    .single()

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const sandbox = process.env.QUICKBOOKS_SANDBOX === 'true'
  const baseUrl = sandbox
    ? `https://sandbox-quickbooks.api.intuit.com/v3/company/${token.realm_id}`
    : `https://quickbooks.api.intuit.com/v3/company/${token.realm_id}`

  const headers = {
    Authorization: `Bearer ${token.access_token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  const customer = job.customer as { name: string; email: string | null } | null
  const amount = job.final_price ?? job.quoted_price ?? 0
  const description = `Repair: ${job.device_make} ${job.device_model} — Ticket #${String(job.ticket_number).padStart(5, '0')}`

  // Simple invoice payload — no customer lookup for brevity
  const invoice = {
    Line: [{
      Amount: amount,
      DetailType: 'SalesItemLineDetail',
      Description: description,
      SalesItemLineDetail: {
        ItemRef: { value: '1', name: 'Services' },
        UnitPrice: amount,
        Qty: 1,
      },
    }],
    CustomerRef: { value: '1' }, // Default customer — staff should update in QB
    DocNumber: `RS-${job.ticket_number}`,
    PrivateNote: customer?.name ?? 'Walk-in',
  }

  const res = await fetch(`${baseUrl}/invoice`, {
    method: 'POST',
    headers,
    body: JSON.stringify(invoice),
  })

  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: data.Fault?.Error?.[0]?.Message ?? 'QB error' }, { status: 500 })
  }

  return NextResponse.json({ invoice: data.Invoice, invoiceId: data.Invoice?.Id })
}
