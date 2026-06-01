import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const SHOP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (token) {
    const supabase = createAdminClient()
    await supabase
      .from('quotes')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('quote_token', token)
      .in('status', ['sent', 'pending'])
  }

  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Quote declined — ${SHOP_NAME}</title></head>
    <body style="margin:0;padding:0;background:#09090b;font-family:system-ui,sans-serif;color:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh;">
      <div style="text-align:center;padding:40px 20px;max-width:400px;">
        <p style="font-size:48px;margin:0 0 16px;">👍</p>
        <h1 style="font-size:22px;font-weight:700;margin:0 0 12px;">No problem at all</h1>
        <p style="color:#a1a1aa;font-size:15px;margin:0 0 24px;line-height:1.6;">
          Thanks for letting us know. If you change your mind or need help in the future, we&apos;re always here.
        </p>
        <p style="color:#71717a;font-size:14px;margin:0;">${SHOP_NAME}</p>
      </div>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  )
}
