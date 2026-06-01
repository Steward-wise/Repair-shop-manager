'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { SupportClient, ITQuoteItem } from '@/types'

function emptyItem(): ITQuoteItem { return { description: '', quantity: 1, unit_price: 0 } }

export default function NewITQuotePage() {
  const router = useRouter()
  const sp = useSearchParams()

  const [title, setTitle] = useState(sp.get('title') ?? '')
  const [clientId, setClientId] = useState(sp.get('client_id') ?? '')
  const [ticketId] = useState(sp.get('ticket_id') ?? '')
  const [items, setItems] = useState<ITQuoteItem[]>([emptyItem()])
  const [notes, setNotes] = useState('')
  const [vatRate, setVatRate] = useState(20)
  const [validUntil, setValidUntil] = useState('')
  const [clients, setClients] = useState<SupportClient[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(j => setClients(j.clients ?? []))
  }, [])

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const vat = subtotal * (vatRate / 100)
  const total = subtotal + vat

  function updateItem(idx: number, field: keyof ITQuoteItem, val: string | number) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item))
  }
  function addItem() { setItems(prev => [...prev, emptyItem()]) }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/it-quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, client_id: clientId || null, ticket_id: ticketId || null, items, notes: notes || null, vat_rate: vatRate, valid_until: validUntil || null }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed to create'); setSaving(false); return }
    router.push(`/it-quotes/${json.quote.id}`)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/it-quotes" className="text-zinc-400 hover:text-fg transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-fg">New IT Quote</h1>
      </div>

      <form onSubmit={save} className="space-y-5">
        <div className="card space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Quote Title <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Network Infrastructure Upgrade" className="w-full input-field" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Client</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full input-field">
                <option value="">— No client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Valid Until</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-full input-field" />
            </div>
          </div>
        </div>

        <div className="card space-y-3">
          <h3 className="font-semibold text-fg text-sm">Line Items</h3>
          <div className="hidden grid-cols-[1fr_80px_100px_32px] gap-2 sm:grid">
            <span className="text-xs text-zinc-500">Description</span>
            <span className="text-xs text-zinc-500 text-center">Qty</span>
            <span className="text-xs text-zinc-500 text-right">Unit Price</span>
            <span />
          </div>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-center">
                <input type="text" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Description" className="input-field text-sm" />
                <input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} className="input-field text-sm text-center" />
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">£</span>
                  <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="input-field text-sm pl-7" />
                </div>
                <button type="button" onClick={() => removeItem(idx)} disabled={items.length === 1} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-30">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="w-full py-2 rounded-lg border border-dashed border-zinc-700 text-sm text-zinc-400 hover:text-fg hover:border-zinc-500 transition-colors flex items-center justify-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            Add Line Item
          </button>
          <div className="border-t border-zinc-800 pt-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm"><span className="text-zinc-400">Subtotal</span><span className="text-fg">£{subtotal.toFixed(2)}</span></div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">VAT</span>
                <div className="relative">
                  <input type="number" min="0" max="100" value={vatRate} onChange={e => setVatRate(parseFloat(e.target.value) || 0)} className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-sm text-fg text-right" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">%</span>
                </div>
              </div>
              <span className="text-fg">£{vat.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between font-bold text-base border-t border-zinc-700 pt-2 mt-1">
              <span className="text-fg">Total</span><span className="text-fg">£{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Notes / Terms</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes or terms…" rows={3} className="w-full input-field resize-none" />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-50">{saving ? 'Creating…' : 'Create Quote'}</button>
          <Link href="/it-quotes" className="btn-secondary text-sm">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
