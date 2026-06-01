import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendQuoteToCustomer } from '@/lib/resend'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: quote, error } = await supabase.from('quotes').select('*').eq('id', id).single()
  if (error || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  const price = quote.final_price ?? quote.suggested_price
  if (!price) return NextResponse.json({ error: 'Set a price before sending' }, { status: 400 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const acceptUrl = `${appUrl}/book/${quote.quote_token}`
  const declineUrl = `${appUrl}/api/quotes/decline?token=${quote.quote_token}`
  const deviceInfo = [quote.device_type, quote.device_make_model].filter(Boolean).join(' — ') || 'Your device'
  const customerName = `${quote.first_name} ${quote.last_name}`

  const sent = await sendQuoteToCustomer(
    quote.email, customerName, deviceInfo,
    quote.problem_description, price, quote.price_notes,
    acceptUrl, declineUrl
  )

  if (!sent) return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })

  await supabase.from('quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id)
  return NextResponse.json({ sent: true })
}
