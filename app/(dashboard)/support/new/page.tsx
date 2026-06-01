'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SupportClient, TicketType, TicketPriority } from '@/types'

export default function NewTicketPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [clients, setClients] = useState<SupportClient[]>([])

  const [form, setForm] = useState({
    ticket_type: 'service_desk' as TicketType,
    title: '',
    description: '',
    priority: '' as TicketPriority | '',
    client_id: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    assigned_to: '',
  })

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(j => setClients(j.clients ?? []))
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  // Auto-fill contact info when client is selected
  function onClientChange(id: string) {
    set('client_id', id)
    if (id) {
      const c = clients.find(c => c.id === id)
      if (c) {
        set('contact_name', c.contact_name ?? '')
        set('contact_email', c.contact_email ?? '')
        set('contact_phone', c.contact_phone ?? '')
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      client_id: form.client_id || null,
      priority: form.priority || null,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      assigned_to: form.assigned_to || null,
    }
    const res = await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed to create ticket'); setSaving(false); return }
    router.push(`/support/${json.ticket.id}`)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-zinc-400 hover:text-fg transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-fg">New Ticket</h1>
      </div>

      <form onSubmit={submit} className="card space-y-5">
        {/* Type + Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Ticket Type</label>
            <select value={form.ticket_type} onChange={e => set('ticket_type', e.target.value)} className="w-full input-field">
              <option value="service_desk">Service Desk</option>
              <option value="incident">Incident</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Priority</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)} className="w-full input-field">
              <option value="">No priority</option>
              <option value="p1">P1 – Critical</option>
              <option value="p2">P2 – High</option>
              <option value="p3">P3 – Medium</option>
              <option value="p4">P4 – Low</option>
            </select>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Title <span className="text-red-500">*</span></label>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Brief description of the issue" className="w-full input-field" required />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Detailed description…" rows={4} className="w-full input-field resize-none" />
        </div>

        <hr className="border-zinc-800" />

        {/* Client */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Client</label>
          <select value={form.client_id} onChange={e => onClientChange(e.target.value)} className="w-full input-field">
            <option value="">— No client —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Contact Name</label>
            <input type="text" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className="w-full input-field" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Contact Email</label>
            <input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} className="w-full input-field" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Contact Phone</label>
            <input type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className="w-full input-field" />
          </div>
        </div>

        {/* Assigned to */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Assigned To</label>
          <input type="text" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} placeholder="Technician name" className="w-full input-field" />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Ticket'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary text-sm">Cancel</button>
        </div>
      </form>
    </div>
  )
}
