'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { SupportClient, ClientType } from '@/types'

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  prospect: 'Prospect',
  active: 'Active',
  inactive: 'Inactive',
}
const CLIENT_TYPE_COLORS: Record<ClientType, string> = {
  prospect: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  active: 'bg-green-900/40 text-green-300 border-green-700',
  inactive: 'bg-zinc-800 text-zinc-400 border-zinc-600',
}

export default function ClientsPage() {
  const [clients, setClients] = useState<SupportClient[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<ClientType | 'all'>('all')
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState({ company_name: '', contact_name: '', contact_email: '', contact_phone: '', client_type: 'prospect' as ClientType, industry: '', monthly_value: '', sla_hours: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (typeFilter !== 'all') params.set('type', typeFilter)
    const res = await fetch(`/api/clients?${params}`)
    const json = await res.json()
    setClients(json.clients ?? [])
    setLoading(false)
  }, [q, typeFilter])

  useEffect(() => { load() }, [load])

  function setF(field: string, val: string) { setForm(f => ({ ...f, [field]: val })) }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_name.trim()) return
    setSaving(true)
    setCreateError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, monthly_value: form.monthly_value ? parseFloat(form.monthly_value) : null, sla_hours: form.sla_hours ? parseInt(form.sla_hours) : null }),
      })
      const json = await res.json()
      if (!res.ok) { setCreateError(json.error ?? 'Failed to save client'); return }
      setShowNew(false)
      setForm({ company_name: '', contact_name: '', contact_email: '', contact_phone: '', client_type: 'prospect', industry: '', monthly_value: '', sla_hours: '' })
      load()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to save client')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-fg">Clients</h1>
        <button onClick={() => { setShowNew(true); setCreateError('') }} className="btn-primary flex items-center gap-2 text-sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"/><path d="M12 5v14"/>
          </svg>
          Add Client
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Search clients…" value={q} onChange={e => setQ(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-fg placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-red-600" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as ClientType | 'all')} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-fg focus:outline-none focus:ring-1 focus:ring-red-600">
          <option value="all">All Types</option>
          <option value="prospect">Prospects</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* New client modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-lg space-y-4 border border-zinc-800" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-fg">Add Client</h2>
            <form onSubmit={create} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Company Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.company_name} onChange={e => setF('company_name', e.target.value)} className="w-full input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Contact Name</label>
                  <input type="text" value={form.contact_name} onChange={e => setF('contact_name', e.target.value)} className="w-full input-field" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Industry</label>
                  <input type="text" value={form.industry} onChange={e => setF('industry', e.target.value)} className="w-full input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Email</label>
                  <input type="email" value={form.contact_email} onChange={e => setF('contact_email', e.target.value)} className="w-full input-field" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Phone</label>
                  <input type="tel" value={form.contact_phone} onChange={e => setF('contact_phone', e.target.value)} className="w-full input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Type</label>
                  <select value={form.client_type} onChange={e => setF('client_type', e.target.value)} className="w-full input-field">
                    <option value="prospect">Prospect</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Monthly Value (£)</label>
                  <input type="number" step="0.01" value={form.monthly_value} onChange={e => setF('monthly_value', e.target.value)} placeholder="0.00" className="w-full input-field" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">SLA Response Time (hours)</label>
                <input type="number" min="1" value={form.sla_hours} onChange={e => setF('sla_hours', e.target.value)} placeholder="e.g. 4" className="w-full input-field" />
                <p className="text-xs text-zinc-500 mt-1">Tickets for this client will show a countdown timer</p>
              </div>
              {createError && <p className="text-red-400 text-sm">{createError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Add Client'}</button>
                <button type="button" onClick={() => { setShowNew(false); setCreateError('') }} className="btn-secondary text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">Loading…</div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <p className="text-sm">No clients found</p>
          <button onClick={() => setShowNew(true)} className="btn-primary text-sm">Add First Client</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(c => (
            <Link key={c.id} href={`/clients/${c.id}`} className="card hover:border-zinc-600 transition-colors block">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-600/20 border border-red-700/40 flex items-center justify-center flex-shrink-0">
                  <span className="text-red-400 font-bold text-sm">{c.company_name.charAt(0).toUpperCase()}</span>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${CLIENT_TYPE_COLORS[c.client_type]}`}>
                  {CLIENT_TYPE_LABELS[c.client_type]}
                </span>
              </div>
              <h3 className="font-semibold text-fg mb-0.5">{c.company_name}</h3>
              {c.contact_name && <p className="text-sm text-zinc-400">{c.contact_name}</p>}
              {c.industry && <p className="text-xs text-zinc-500 mt-1">{c.industry}</p>}
              {c.monthly_value != null && (
                <p className="text-xs text-green-400 font-medium mt-2">£{c.monthly_value.toFixed(2)}/mo</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
