'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Quote {
  first_name: string
  last_name: string
  email: string
  phone: string | null
  device_type: string | null
  device_make_model: string | null
  status: string
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa']

export default function BookingPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Calendar state
  const [calMonth, setCalMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  // Booking state
  const [notes, setNotes] = useState('')
  const [booking, setBooking] = useState(false)

  useEffect(() => {
    setLoadingQuote(true)
    fetch(`/api/book/quote?token=${token}`)
      .then(async r => {
        const text = await r.text()
        try {
          const d = JSON.parse(text)
          if (d.error || !d.quote) { setError(`This booking link is invalid or has expired. (${d.error ?? 'no data'})`); return }
          if (['declined', 'closed'].includes(d.quote.status)) { setError('This quote is no longer available.'); return }
          setQuote(d.quote)
        } catch {
          setError(`Unable to load booking page. Server returned: ${text.slice(0, 120)}`)
        }
      })
      .catch((e: unknown) => setError(`Unable to load booking page. ${e instanceof Error ? e.message : String(e)}`))
      .finally(() => setLoadingQuote(false))
  }, [token])

  async function loadSlots(date: string) {
    setSelectedDate(date)
    setSelectedSlot(null)
    setLoadingSlots(true)
    const res = await fetch(`/api/availability/slots?date=${date}`)
    const data = await res.json()
    setSlots(data.slots ?? [])
    setLoadingSlots(false)
  }

  async function confirmBooking() {
    if (!selectedDate || !selectedSlot || !quote) return
    setBooking(true)
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quote_token: token,
        customer_name: `${quote.first_name} ${quote.last_name}`,
        customer_email: quote.email,
        customer_phone: quote.phone,
        appointment_date: selectedDate,
        appointment_time: selectedSlot,
        device_info: [quote.device_type, quote.device_make_model].filter(Boolean).join(' — '),
        notes: notes.trim() || null,
      }),
    })
    setBooking(false)
    if (res.ok) {
      router.push('/book/confirmed')
    } else {
      const d = await res.json()
      if (d.error === 'already_booked') {
        router.push('/book/confirmed') // already booked — treat as success
      } else {
        setError(d.error ?? 'Booking failed. Please try again.')
      }
    }
  }

  // Calendar helpers
  const today = new Date(); today.setHours(0,0,0,0)
  const calYear = calMonth.getFullYear()
  const calMonthIndex = calMonth.getMonth()
  const firstDay = new Date(calYear, calMonthIndex, 1).getDay()
  const daysInMonth = new Date(calYear, calMonthIndex + 1, 0).getDate()
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 42)

  function formatTime(t: string) {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'pm' : 'am'
    return `${h % 12 || 12}:${String(m).padStart(2, '0')}${ampm}`
  }

  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'

  if (loadingQuote) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">😔</p>
        <h1 className="text-xl font-bold text-white mb-3">Link unavailable</h1>
        <p className="text-zinc-400">{error}</p>
      </div>
    </div>
  )

  if (!quote) return null

  const deviceInfo = [quote.device_type, quote.device_make_model].filter(Boolean).join(' — ')

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-red-600 rounded-xl mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Book Your Appointment</h1>
          <p className="text-zinc-400 mt-1 text-sm">{shopName}</p>
        </div>

        {/* Quote summary */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm space-y-1">
          <p className="text-zinc-400">Booking for</p>
          <p className="font-semibold">{quote.first_name} {quote.last_name}</p>
          {deviceInfo && <p className="text-zinc-400">{deviceInfo}</p>}
        </div>

        {/* Calendar */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth()-1, 1))}
              disabled={calYear === today.getFullYear() && calMonthIndex <= today.getMonth()}
              className="p-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-30 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span className="font-semibold text-sm">{MONTH_NAMES[calMonthIndex]} {calYear}</span>
            <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth()+1, 1))}
              disabled={new Date(calYear, calMonthIndex+1, 1) > maxDate}
              className="p-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-30 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_SHORT.map(d => <div key={d} className="text-center text-xs text-zinc-500 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const dateStr = `${calYear}-${String(calMonthIndex+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const dayDate = new Date(calYear, calMonthIndex, day)
              const isPast = dayDate < today
              const isSelected = dateStr === selectedDate
              const isToday = dateStr === today.toISOString().split('T')[0]
              return (
                <button key={day} disabled={isPast}
                  onClick={() => loadSlots(dateStr)}
                  className={`h-10 min-h-[40px] rounded-lg text-sm font-medium transition-colors flex items-center justify-center w-full
                    ${isPast ? 'text-zinc-700 cursor-not-allowed' : ''}
                    ${isSelected ? 'bg-red-600 text-white' : ''}
                    ${!isPast && !isSelected && isToday ? 'bg-zinc-700 text-white' : ''}
                    ${!isPast && !isSelected && !isToday ? 'hover:bg-zinc-800 active:bg-zinc-700 text-zinc-300' : ''}`}>
                  {day}
                </button>
              )
            })}
          </div>
        </div>

        {/* Time slots */}
        {selectedDate && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-3">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            {loadingSlots ? (
              <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : slots.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-4">No available slots on this day</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map(slot => (
                  <button key={slot} onClick={() => setSelectedSlot(slot)}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors border
                      ${selectedSlot === slot ? 'bg-red-600 border-red-600 text-white' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white'}`}>
                    {formatTime(slot)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes + confirm */}
        {selectedSlot && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
            <div className="p-3 bg-zinc-800 rounded-lg text-sm">
              <p className="text-zinc-400 mb-1">Your appointment</p>
              <p className="font-semibold">{new Date(selectedDate! + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at {formatTime(selectedSlot)}</p>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Any additional notes? <span className="text-zinc-600">(optional)</span></label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-600"
                placeholder="Anything we should know…" />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={confirmBooking} disabled={booking}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl text-base transition-colors disabled:opacity-60">
              {booking ? 'Confirming…' : 'Confirm Appointment'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
