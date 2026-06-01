'use client'

import { useEffect, useState, useCallback } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { type Appointment, APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@/types'

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: 'bg-blue-900/40 text-blue-300 border-blue-700',
  completed: 'bg-green-900/40 text-green-300 border-green-700',
  cancelled: 'bg-zinc-800 text-zinc-400 border-zinc-600',
  no_show: 'bg-red-900/40 text-red-300 border-red-700',
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${ampm}`
}

const EMPTY_FORM = { customer_name: '', customer_email: '', customer_phone: '', device_info: '', appointment_date: '', appointment_time: '', notes: '' }

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'week'>('list')
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState(EMPTY_FORM)
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadSlots(date: string) {
    if (!date) { setSlots([]); return }
    setLoadingSlots(true)
    const res = await fetch(`/api/availability/slots?date=${date}`)
    const data = await res.json()
    setSlots(data.slots ?? [])
    setLoadingSlots(false)
  }

  async function createAppointment() {
    const { customer_name, customer_email, appointment_date, appointment_time } = newForm
    if (!customer_name || !customer_email || !appointment_date || !appointment_time) {
      toast.error('Fill in required fields'); return
    }
    setSaving(true)
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newForm, customer_phone: newForm.customer_phone || null, device_info: newForm.device_info || null, notes: newForm.notes || null }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Failed to create appointment'); return }
    toast.success('Appointment booked')
    setShowNew(false)
    setNewForm(EMPTY_FORM)
    setSlots([])
    load()
  }

  const load = useCallback(async () => {
    setLoading(true)
    const from = new Date()
    from.setDate(from.getDate() - 7)
    const res = await fetch(`/api/appointments?from=${from.toISOString().split('T')[0]}`)
    const data = await res.json()
    setAppointments(data.appointments ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function updateStatus(id: string, status: AppointmentStatus) {
    const res = await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) { toast.error('Failed to update'); return }
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    toast.success('Updated')
  }

  async function cancel(id: string) {
    if (!confirm('Cancel this appointment?')) return
    await fetch(`/api/appointments/${id}`, { method: 'DELETE' })
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a))
    toast.success('Appointment cancelled')
  }

  // Group by date for list view
  const grouped = appointments.reduce<Record<string, Appointment[]>>((acc, a) => {
    acc[a.appointment_date] = [...(acc[a.appointment_date] ?? []), a]
    return acc
  }, {})

  const today = new Date().toISOString().split('T')[0]

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46' } }} />
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold text-fg">Appointments</h1>
          <div className="flex gap-2">
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg'}`}>List</button>
            <button onClick={() => setViewMode('week')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'week' ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg'}`}>Week</button>
            <button onClick={() => setShowNew(true)} className="btn-primary text-sm py-1.5 px-3">+ New</button>
          </div>
        </div>

        {/* New Appointment Modal */}
        {showNew && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={e => { if (e.target === e.currentTarget) { setShowNew(false); setNewForm(EMPTY_FORM); setSlots([]) }}}>
            <div className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 className="font-semibold text-fg">New Appointment</h2>
                <button onClick={() => { setShowNew(false); setNewForm(EMPTY_FORM); setSlots([]) }} className="text-muted hover:text-fg">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted mb-1">Name *</label>
                    <input value={newForm.customer_name} onChange={e => setNewForm(f => ({ ...f, customer_name: e.target.value }))} className="input w-full text-sm" placeholder="Full name" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Phone</label>
                    <input value={newForm.customer_phone} onChange={e => setNewForm(f => ({ ...f, customer_phone: e.target.value }))} className="input w-full text-sm" placeholder="07..." />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Email *</label>
                  <input type="email" value={newForm.customer_email} onChange={e => setNewForm(f => ({ ...f, customer_email: e.target.value }))} className="input w-full text-sm" placeholder="customer@email.com" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Device</label>
                  <input value={newForm.device_info} onChange={e => setNewForm(f => ({ ...f, device_info: e.target.value }))} className="input w-full text-sm" placeholder="e.g. iPhone 14 — Screen repair" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted mb-1">Date *</label>
                    <input type="date" value={newForm.appointment_date} onChange={e => { const d = e.target.value; setNewForm(f => ({ ...f, appointment_date: d, appointment_time: '' })); loadSlots(d) }} className="input w-full text-sm" min={new Date().toISOString().split('T')[0]} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Time *</label>
                    {loadingSlots ? (
                      <div className="input w-full text-sm text-muted">Loading…</div>
                    ) : slots.length > 0 ? (
                      <select value={newForm.appointment_time} onChange={e => setNewForm(f => ({ ...f, appointment_time: e.target.value }))} className="input w-full text-sm">
                        <option value="">Select time</option>
                        {slots.map(s => <option key={s} value={s}>{formatTime(s)}</option>)}
                      </select>
                    ) : (
                      <input type="time" value={newForm.appointment_time} onChange={e => setNewForm(f => ({ ...f, appointment_time: e.target.value }))} className="input w-full text-sm" />
                    )}
                  </div>
                </div>
                {newForm.appointment_date && slots.length === 0 && !loadingSlots && (
                  <p className="text-xs text-amber-400">No availability slots for this date — you can still enter a time manually above.</p>
                )}
                <div>
                  <label className="block text-xs text-muted mb-1">Notes</label>
                  <textarea value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} className="input w-full text-sm" rows={2} placeholder="Any notes…" />
                </div>
              </div>
              <div className="flex gap-3 px-6 pb-6">
                <button onClick={() => { setShowNew(false); setNewForm(EMPTY_FORM); setSlots([]) }} className="btn-secondary flex-1 text-sm">Cancel</button>
                <button onClick={createAppointment} disabled={saving} className="btn-primary flex-1 text-sm">{saving ? 'Booking…' : 'Book Appointment'}</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : appointments.length === 0 ? (
          <div className="card text-center py-12"><p className="text-muted text-sm">No appointments scheduled</p></div>
        ) : viewMode === 'list' ? (
          <div className="space-y-6">
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, appts]) => {
              const d = new Date(date + 'T12:00:00')
              const isToday = date === today
              return (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-fg'}`}>
                      {isToday ? 'Today — ' : ''}{d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted">{appts.length} appt{appts.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-2">
                    {appts.sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)).map(appt => (
                      <div key={appt.id} className={`card p-4 ${appt.status === 'cancelled' ? 'opacity-50' : ''}`}>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-4">
                            <div className="text-center min-w-[48px]">
                              <div className="text-lg font-bold text-fg font-mono">{formatTime(appt.appointment_time)}</div>
                              <div className="text-xs text-muted">{appt.duration_mins}m</div>
                            </div>
                            <div>
                              <div className="font-medium text-fg">{appt.customer_name}</div>
                              <div className="text-sm text-muted">{appt.device_info || appt.customer_email}</div>
                              {appt.notes && <div className="text-xs text-muted mt-0.5">{appt.notes}</div>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[appt.status as AppointmentStatus]}`}>
                              {APPOINTMENT_STATUS_LABELS[appt.status as AppointmentStatus]}
                            </span>
                            {appt.status === 'scheduled' && (
                              <>
                                <button onClick={() => updateStatus(appt.id, 'completed')} className="text-xs bg-green-900/30 text-green-300 border border-green-700 px-2 py-1 rounded-lg hover:bg-green-900/50">
                                  Complete
                                </button>
                                <button onClick={() => updateStatus(appt.id, 'no_show')} className="text-xs bg-surface-2 text-muted border border-border px-2 py-1 rounded-lg hover:text-fg">
                                  No show
                                </button>
                                <button onClick={() => cancel(appt.id)} className="text-xs text-red-400 hover:text-red-300">
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <WeekView appointments={appointments} onStatusChange={updateStatus} />
        )}
      </div>
    </>
  )
}

function WeekView({ appointments, onStatusChange }: { appointments: Appointment[], onStatusChange: (id: string, s: AppointmentStatus) => void }) {
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0,0,0,0); return d
  })

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d
  })

  const today = new Date().toISOString().split('T')[0]

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate()-7); return n })} className="btn-secondary text-sm py-1.5 px-3">← Prev</button>
        <span className="text-sm text-fg font-medium flex-1 text-center">
          {days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <button onClick={() => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate()+7); return n })} className="btn-secondary text-sm py-1.5 px-3">Next →</button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map(day => {
          const dateStr = day.toISOString().split('T')[0]
          const dayAppts = appointments.filter(a => a.appointment_date === dateStr && a.status !== 'cancelled')
          const isToday = dateStr === today
          return (
            <div key={dateStr} className={`card p-2 min-h-[120px] ${isToday ? 'border-primary/50' : ''}`}>
              <div className={`text-xs font-semibold mb-2 ${isToday ? 'text-primary' : 'text-muted'}`}>
                <div>{DAY_SHORT[day.getDay()]}</div>
                <div className="text-lg font-bold text-fg">{day.getDate()}</div>
              </div>
              {dayAppts.length === 0 ? (
                <p className="text-xs text-muted/50 text-center mt-4">–</p>
              ) : (
                <div className="space-y-1">
                  {dayAppts.sort((a,b) => a.appointment_time.localeCompare(b.appointment_time)).map(a => (
                    <div key={a.id} className="text-xs bg-primary/20 border border-primary/30 rounded p-1.5">
                      <div className="font-medium text-fg">{formatTime(a.appointment_time)}</div>
                      <div className="text-muted truncate">{a.customer_name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
