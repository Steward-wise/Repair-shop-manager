'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import type { SupportClient, SupportTicket, ClientType } from '@/types'
import { formatTicketRef, TICKET_STATUS_LABELS, TICKET_STATUS_COLORS } from '@/types'

const CLIENT_TYPE_LABELS: Record<ClientType, string> = { prospect: 'Prospect', active: 'Active', inactive: 'Inactive' }

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [client, setClient] = useState<SupportClient | null>(null)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<SupportClient>>({})

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then(r => r.json())
      .then(j => {
        setClient(j.client ?? null)
        setTickets(j.tickets ?? [])
        setForm(j.client ?? {})
      })
      .catch(err => console.error('Failed to load client:', err))
      .finally(() => setLoading(false))
  }, [id])

  function setF(field: string, val: string) { setForm(f => ({ ...f, [field]: val })) }

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (json.client) { setClient(json.client); setEditing(false) }
    setSaving(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">Loading…</div>
  if (!client) return <div className="flex items-center justify-center h-64 text-red-400 text-sm">Client not found</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/clients" className="text-zinc-400 hover:text-fg transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-fg">{client.company_name}</h1>
          <p className="text-sm text-zinc-400">{CLIENT_TYPE_LABELS[client.client_type]}{client.industry ? ` · ${client.industry}` : ''}</p>
        </div>
        <button onClick={() => setEditing(!editing)} className={editing ? 'btn-secondary text-sm' : 'btn-primary text-sm'}>
          {editing ? 'Cancel' : 'Edit'}
        </button>
        {editing && (
          <button onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Tickets */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-fg">Support Tickets</h2>
            <Link href={`/support/new?client_id=${id}`} className="btn-primary text-sm flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="M12 5v14"/>
              </svg>
              New Ticket
            </Link>
          </div>
          {tickets.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-12 text-zinc-500 gap-2">
              <p className="text-sm">No tickets for this client</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Ref</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide hidden md:table-cell">Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => (
                    <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                        <Link href={`/support/${t.id}`} className="hover:text-fg">{formatTicketRef(t.ticket_type, t.ticket_number)}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/support/${t.id}`} className="text-fg hover:text-red-400 transition-colors">{t.title}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TICKET_STATUS_COLORS[t.status]}`}>
                          {TICKET_STATUS_LABELS[t.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs hidden md:table-cell">
                        {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info sidebar */}
        <div className="space-y-4">
          <div className="card space-y-4">
            <h3 className="font-semibold text-fg">Client Info</h3>
            {editing ? (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Company Name</label>
                  <input type="text" value={form.company_name ?? ''} onChange={e => setF('company_name', e.target.value)} className="w-full input-field" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Contact Name</label>
                  <input type="text" value={form.contact_name ?? ''} onChange={e => setF('contact_name', e.target.value)} className="w-full input-field" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Email</label>
                  <input type="email" value={form.contact_email ?? ''} onChange={e => setF('contact_email', e.target.value)} className="w-full input-field" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Phone</label>
                  <input type="tel" value={form.contact_phone ?? ''} onChange={e => setF('contact_phone', e.target.value)} className="w-full input-field" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Website</label>
                  <input type="text" value={form.website ?? ''} onChange={e => setF('website', e.target.value)} className="w-full input-field" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Industry</label>
                  <input type="text" value={form.industry ?? ''} onChange={e => setF('industry', e.target.value)} className="w-full input-field" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Type</label>
                  <select value={form.client_type ?? 'prospect'} onChange={e => setF('client_type', e.target.value)} className="w-full input-field">
                    <option value="prospect">Prospect</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Monthly Value (£)</label>
                  <input type="number" step="0.01" value={form.monthly_value ?? ''} onChange={e => setF('monthly_value', e.target.value)} className="w-full input-field" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">SLA Response Time (hours)</label>
                  <input type="number" min="1" value={form.sla_hours ?? ''} onChange={e => setF('sla_hours', e.target.value)} placeholder="e.g. 4" className="w-full input-field" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Notes</label>
                  <textarea value={form.notes ?? ''} onChange={e => setF('notes', e.target.value)} rows={3} className="w-full input-field resize-none" />
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {client.contact_name && <div><p className="text-xs text-zinc-500">Contact</p><p className="text-fg">{client.contact_name}</p></div>}
                {client.contact_email && <div><p className="text-xs text-zinc-500">Email</p><a href={`mailto:${client.contact_email}`} className="text-red-400 hover:underline">{client.contact_email}</a></div>}
                {client.contact_phone && <div><p className="text-xs text-zinc-500">Phone</p><a href={`tel:${client.contact_phone}`} className="text-red-400 hover:underline">{client.contact_phone}</a></div>}
                {client.website && <div><p className="text-xs text-zinc-500">Website</p><a href={client.website} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">{client.website}</a></div>}
                {client.address && <div><p className="text-xs text-zinc-500">Address</p><p className="text-fg whitespace-pre-wrap">{client.address}</p></div>}
                {client.monthly_value != null && <div><p className="text-xs text-zinc-500">Monthly Value</p><p className="text-green-400 font-medium">£{client.monthly_value.toFixed(2)}/mo</p></div>}
                {client.sla_hours != null && <div><p className="text-xs text-zinc-500">SLA</p><p className="text-fg">{client.sla_hours}h response</p></div>}
                {client.notes && <div><p className="text-xs text-zinc-500">Notes</p><p className="text-zinc-300 whitespace-pre-wrap">{client.notes}</p></div>}
                <div><p className="text-xs text-zinc-500">Client Since</p><p className="text-fg">{new Date(client.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
              </div>
            )}
          </div>

          <Link href={`/it-quotes?client_id=${id}`} className="card flex items-center gap-3 hover:border-zinc-600 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <span className="text-sm text-zinc-300">View IT Quotes</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
