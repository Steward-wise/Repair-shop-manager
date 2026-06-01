import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const SHOP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'

function confirmationPage() {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Unsubscribed — ${SHOP_NAME}</title></head>
    <body style="margin:0;padding:0;background:#09090b;font-family:system-ui,sans-serif;color:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh;">
      <div style="text-align:center;padding:40px 20px;">
        <p style="font-size:48px;margin:0 0 16px;">✓</p>
        <h1 style="font-size:24px;font-weight:700;margin:0 0 8px;">You&apos;ve been unsubscribed</h1>
        <p style="color:#a1a1aa;font-size:15px;margin:0;">You won&apos;t receive follow-up or promotional emails from ${SHOP_NAME}.<br>You&apos;ll still receive important updates about your active repairs.</p>
      </div>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  )
}

async function unsubscribe(cid: string | null) {
  if (!cid) return false
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('customers')
    .update({ marketing_consent: false })
    .eq('id', cid)
  return !error
}

// One-click unsubscribe (Gmail uses POST with List-Unsubscribe-Post header)
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  await unsubscribe(searchParams.get('cid'))
  return NextResponse.json({ unsubscribed: true })
}

// Link click from email client
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  await unsubscribe(searchParams.get('cid'))
  return confirmationPage()
}
