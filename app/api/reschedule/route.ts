import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendAppointmentConfirmation } from '@/lib/resend'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('appointments')
    .select('id, customer_name, customer_email, device_info, appointment_date, appointment_time, status, reschedule_count')
    .eq('reschedule_token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (data.status === 'cancelled') return NextResponse.json({ error: 'cancelled' }, { status: 410 })

  // Check 24h window
  const apptDateTime = new Date(`${data.appointment_date}T${data.appointment_time}`)
  const hoursUntil = (apptDateTime.getTime() - Date.now()) / 3600000
  if (hoursUntil < 24) return NextResponse.json({ error: 'too_late', hours_until: Math.round(hoursUntil) }, { status: 400 })

  return NextResponse.json({ appointment: data })
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: appt } = await supabase
    .from('appointments')
    .select('id, customer_name, customer_email, device_info, appointment_date, appointment_time, status, reschedule_count')
    .eq('reschedule_token', token)
    .single()

  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (appt.status === 'cancelled') return NextResponse.json({ error: 'cancelled' }, { status: 410 })

  // Enforce 24h cutoff
  const apptDateTime = new Date(`${appt.appointment_date}T${appt.appointment_time}`)
  const hoursUntil = (apptDateTime.getTime() - Date.now()) / 3600000
  if (hoursUntil < 24) return NextResponse.json({ error: 'too_late' }, { status: 400 })

  const body = await request.json()
  const { appointment_date, appointment_time } = body
  if (!appointment_date || !appointment_time) return NextResponse.json({ error: 'date and time required' }, { status: 400 })

  // Generate a fresh reschedule token so the old link can't be reused
  const { createClient } = require('@supabase/supabase-js')
  const newToken = crypto.randomUUID()

  const { error } = await supabase.from('appointments').update({
    appointment_date,
    appointment_time,
    reschedule_token: newToken,
    reschedule_count: (appt.reschedule_count ?? 0) + 1,
  }).eq('id', appt.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send updated confirmation email
  const dateFormatted = new Date(appointment_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const [h, m] = appointment_time.split(':')
  const timeFormatted = new Date(0, 0, 0, parseInt(h), parseInt(m)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  await sendAppointmentConfirmation(
    appt.customer_email, appt.customer_name,
    appt.device_info || 'Your device',
    dateFormatted, timeFormatted, newToken
  )

  return NextResponse.json({ ok: true })
}
