import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendQuoteToCustomer } from '@/lib/resend'

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    const { ids, action } = await request.json()
    if (!ids?.length || !action) return NextResponse.json({ error: 'ids and action required' }, { status: 400 })

    if (action === 'delete') {
      const { error } = await supabase.from('quotes').delete().in('id', ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ deleted: ids.length })
    }

    if (action === 'close') {
      await supabase.from('quotes').update({ status: 'closed' }).in('id', ids)
      return NextResponse.json({ updated: ids.length })
    }

    if (action === 'decline') {
      await supabase.from('quotes').update({ status: 'declined', responded_at: new Date().toISOString() }).in('id', ids)
      return NextResponse.json({ updated: ids.length })
    }

    if (action === 'send') {
      const { data: quotes } = await supabase.from('quotes').select('*').in('id', ids)
      if (!quotes) return NextResponse.json({ sent: 0 })

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      let sent = 0

      for (const quote of quotes) {
        const price = quote.final_price ?? quote.suggested_price
        if (!price) continue
        const acceptUrl = `${appUrl}/book/${quote.quote_token}`
        const declineUrl = `${appUrl}/api/quotes/decline?token=${quote.quote_token}`
        const deviceInfo = [quote.device_type, quote.device_make_model].filter(Boolean).join(' — ') || 'Your device'
        const ok = await sendQuoteToCustomer(
          quote.email, `${quote.first_name} ${quote.last_name}`,
          deviceInfo, quote.problem_description, price,
          quote.price_notes, acceptUrl, declineUrl
        )
        if (ok) {
          await supabase.from('quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', quote.id)
          sent++
        }
      }
      return NextResponse.json({ sent })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
