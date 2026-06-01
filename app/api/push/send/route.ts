import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // Skip silently if VAPID keys aren't configured
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ sent: 0, reason: 'VAPID not configured' })
  }

  const supabase = createAdminClient()

  try {
    const { job_id, title, body, url } = await request.json()

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('job_id', job_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!subscriptions || subscriptions.length === 0) return NextResponse.json({ sent: 0 })

    const { webpush } = await import('@/lib/push')
    let sent = 0

    for (const sub of subscriptions as { endpoint: string; p256dh: string; auth: string }[]) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url: url ?? '/' })
        )
        sent++
      } catch {
        // Remove stale subscriptions (410 Gone)
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }

    return NextResponse.json({ sent })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
