'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface ApptInfo {
  customer_name: string
  device_info: string | null
  appointment_date: string
  appointment_time: string
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa']

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${ampm}`
}

export default function ReschedulePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [appt, setAppt] = useState<ApptInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [calMonth, setCalMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'

  useEffect(() => {
    fetch(`/api/reschedule?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error === 'too_late') { setError(`Rescheduling is only available more than 24 hours before your appointment. (${d.hours_until ?? 0}h remaining)`) }
        else if (d.error === 'cancelled') { setError('This appointment has been cancelled.') }
        else if (d.error) { setError('This link is invalid or has expired.') }
        else { setAppt(d.appointment) }
      })
      .catch(() => setError('Unable to load. Please try again.'))
      .finally(() => setLoading(false))
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

  async function confirm() {
    if (!selectedDate || !selectedSlot) return
    setSaving(true)
    const res = await fetch(`/api/reschedule?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_date: selectedDate, appointment_time: selectedSlot }),
    })
    if (res.ok) { setDone(true) }
    else { const d = await res.json(); setError(d.error === 'too_late' ? 'Sorry, the 24-hour reschedule window has now passed.' : (d.error ?? 'Failed to reschedule.')) }
    setSaving(false)
  }

  const today = new Date(); today.setHours(0,0,0,0)
  const calYear = calMonth.getFullYear()
  const calMonthIdx = calMonth.getMonth()
  const firstDay = new Date(calYear, calMonthIdx, 1).getDay()
  const daysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate()
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 42)

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="text-center max-w-sm space-y-3">
        <p className="text-4xl">😔</p>
        <h1 className="text-xl font-bold text-white">Unable to Reschedule</h1>
        <p className="text-zinc-400 text-sm">{error}</p>
        <p className="text-zinc-600 text-xs">{shopName}</p>
      </div>
    </div>
  )

  if (done) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="text-center max-w-sm space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-900/40 border border-green-700 rounded-full">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Appointment Rescheduled</h1>
        <p className="text-zinc-400 text-sm">We&apos;ve sent a confirmation to your email with the new details.</p>
        <p className="text-zinc-600 text-xs">{shopName}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-red-600 rounded-xl mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Reschedule Appointment</h1>
          <p className="text-zinc-400 text-sm mt-1">{shopName}</p>
        </div>

        {appt && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm space-y-1">
            <p className="text-zinc-400">Current appointment</p>
            <p className="font-semibold">{appt.customer_name}</p>
            {appt.device_info && <p className="text-zinc-400">{appt.device_info}</p>}
            <p className="text-zinc-400">
              {new Date(appt.appointment_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at {formatTime(appt.appointment_time)}
            </p>
          </div>
        )}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth()-1, 1))}
              disabled={calYear === today.getFullYear() && calMonthIdx <= today.getMonth()}
              className="p-2 rounded-lg hover:bg-zinc-800 disabled:opacity-30 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span className="font-semibold text-sm">{MONTH_NAMES[calMonthIdx]} {calYear}</span>
            <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth()+1, 1))}
              disabled={new Date(calYear, calMonthIdx+1, 1) > maxDate}
              className="p-2 rounded-lg hover:bg-zinc-800 disabled:opacity-30 transition-colors">
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
              const dateStr = `${calYear}-${String(calMonthIdx+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const dayDate = new Date(calYear, calMonthIdx, day)
              const isPast = dayDate < today
              const isSelected = dateStr === selectedDate
              const isToday = dateStr === today.toISOString().split('T')[0]
              return (
                <button key={day} disabled={isPast} onClick={() => loadSlots(dateStr)}
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
                    className={`py-2.5 rounded-lg text-sm font-medium transition-colors border ${selectedSlot === slot ? 'bg-red-600 border-red-600 text-white' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}>
                    {formatTime(slot)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedSlot && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
            <div className="p-3 bg-zinc-800 rounded-lg text-sm">
              <p className="text-zinc-400 mb-1">New appointment</p>
              <p className="font-semibold">{new Date(selectedDate! + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at {formatTime(selectedSlot)}</p>
            </div>
            <button onClick={confirm} disabled={saving}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl text-base transition-colors disabled:opacity-60">
              {saving ? 'Confirming…' : 'Confirm New Time'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
