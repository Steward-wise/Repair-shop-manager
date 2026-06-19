import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendAppointmentConfirmation } from '@/lib/resend'

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') ?? new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .gte('appointment_date', from)
    .order('appointment_date')
    .order('appointment_time')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ appointments: data })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    const body = await request.json()
    const { quote_token, customer_name, customer_email, customer_phone, appointment_date, appointment_time, notes } = body

    if (!customer_name || !customer_email || !appointment_date || !appointment_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Resolve quote if token provided, and prevent duplicate bookings
    let quote_id: string | null = null
    let deviceInfo = body.device_info || ''
    if (quote_token) {
      const { data: quote } = await supabase
        .from('quotes')
        .select('id, device_type, device_make_model, suggested_price, matched_rule_id')
        .eq('quote_token', quote_token)
        .single()
      if (quote) {
        // Check for existing booking for this quote
        const { data: existing } = await supabase.from('appointments').select('id').eq('quote_id', quote.id).neq('status', 'cancelled').maybeSingle()
        if (existing) {
          return NextResponse.json({ error: 'already_booked', message: 'An appointment has already been booked for this quote.' }, { status: 409 })
        }
        quote_id = quote.id
        deviceInfo = [quote.device_type, quote.device_make_model].filter(Boolean).join(' — ') || deviceInfo
        // Instant-price quotes (matched via auto-rules) are auto-accepted on booking
        const newStatus = quote.suggested_price != null && quote.matched_rule_id != null ? 'accepted' : 'booked'
        await supabase.from('quotes').update({ status: newStatus, responded_at: new Date().toISOString() }).eq('id', quote.id)
      }
    }

    const { data, error } = await supabase.from('appointments').insert({
      quote_id,
      customer_name,
      customer_email,
      customer_phone: customer_phone || null,
      appointment_date,
      appointment_time,
      duration_mins: body.duration_mins ?? 60,
      device_info: deviceInfo || null,
      notes: notes || null,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Send confirmation email with reschedule link
    const dateFormatted = new Date(appointment_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const [h, m] = appointment_time.split(':')
    const timeFormatted = new Date(0, 0, 0, parseInt(h), parseInt(m)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    await sendAppointmentConfirmation(
      customer_email, customer_name, deviceInfo || 'Your device',
      dateFormatted, timeFormatted, data.reschedule_token
    )

    return NextResponse.json({ appointment: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
