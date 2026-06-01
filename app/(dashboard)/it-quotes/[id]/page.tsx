'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { ITQuote, ITQuoteItem, SupportClient } from '@/types'
import { IT_QUOTE_STATUS_LABELS } from '@/types'

const STATUS_COLORS = {
  draft: 'bg-zinc-800 text-zinc-400 border-zinc-600',
  sent: 'bg-blue-900/40 text-blue-300 border-blue-700',
  accepted: 'bg-green-900/40 text-green-300 border-green-700',
}

function emptyItem(): ITQuoteItem { return { description: '', quantity: 1, unit_price: 0 } }

export default function ITQuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNew = id === 'new'

  const [quote, setQuote] = useState<ITQuote | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [clients, setClients] = useState<SupportClient[]>([])
  const [copied, setCopied] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState(searchParams.get('client_id') ?? '')
  const [ticketId] = useState(searchParams.get('ticket_id') ?? '')
  const [items, setItems] = useState<ITQuoteItem[]>([emptyItem()])
  const [notes, setNotes] = useState('')
  const [vatRate, setVatRate] = useState(20)
  const [validUntil, setValidUntil] = useState('')

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(j => setClients(j.clients ?? []))
    if (isNew) {
      const t = searchParams.get('title')
      if (t) setTitle(t)
      return
    }
    fetch(`/api/it-quotes/${id}`).then(r => r.json()).then(j => {
      if (j.quote) {
        const q: ITQuote = j.quote
        setQuote(q)
        setTitle(q.title)
        setClientId(q.client_id ?? '')
        setItems(q.items.length ? q.items : [emptyItem()])
        setNotes(q.notes ?? '')
        setVatRate(q.vat_rate)
        setValidUntil(q.valid_until ? q.valid_until.split('T')[0] : '')
      }
      setLoading(false)
    })
  }, [id, isNew, searchParams])

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const vat = subtotal * (vatRate / 100)
  const total = subtotal + vat

  function updateItem(idx: number, field: keyof ITQuoteItem, val: string | number) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item))
  }
  function addItem() { setItems(prev => [...prev, emptyItem()]) }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }

  const buildPayload = useCallback(() => ({
    title,
    client_id: clientId || null,
    ticket_id: ticketId || null,
    items,
    notes: notes || null,
    vat_rate: vatRate,
    valid_until: validUntil || null,
  }), [title, clientId, ticketId, items, notes, vatRate, validUntil])

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    if (isNew) {
      const res = await fetch('/api/it-quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPayload()) })
      const json = await res.json()
      if (json.quote) router.replace(`/it-quotes/${json.quote.id}`)
    } else {
      const res = await fetch(`/api/it-quotes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPayload()) })
      const json = await res.json()
      if (json.quote) setQuote(json.quote)
    }
    setSaving(false)
  }

  async function sendQuote() {
    if (!quote) return
    setSending(true)
    const res = await fetch(`/api/it-quotes/${id}/send`, { method: 'POST' })
    const json = await res.json()
    if (json.ok) { setQuote(q => q ? { ...q, status: 'sent' } : q) }
    else { alert(json.error ?? 'Failed to send') }
    setSending(false)
  }

  async function deleteQuote() {
    if (!confirm('Delete this quote?')) return
    setDeleting(true)
    await fetch(`/api/it-quotes/${id}`, { method: 'DELETE' })
    router.push('/it-quotes')
  }

  function copyLink() {
    if (!quote) return
    const url = `${window.location.origin}/it-quote/${quote.quote_token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">Loading…</div>

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/it-quotes" className="text-zinc-400 hover:text-fg transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-fg flex-1">{isNew ? 'New IT Quote' : (title || 'IT Quote')}</h1>
        {quote && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[quote.status]}`}>
            {IT_QUOTE_STATUS_LABELS[quote.status]}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
        {/* Editor */}
        <div className="space-y-5">
          {/* Meta */}
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

          {/* Line items */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-fg text-sm">Line Items</h3>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-center">
                  <input
                    type="text"
                    value={item.description}
                    onChange={e => updateItem(idx, 'description', e.target.value)}
                    placeholder="Description"
                    className="input-field text-sm"
                  />
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                    className="input-field text-sm text-center"
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">£</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="input-field text-sm pl-7"
                    />
                  </div>
                  <button
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-30"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="w-full py-2 rounded-lg border border-dashed border-zinc-700 text-sm text-zinc-400 hover:text-fg hover:border-zinc-500 transition-colors flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="M12 5v14"/>
              </svg>
              Add Line Item
            </button>

            {/* Totals */}
            <div className="border-t border-zinc-800 pt-3 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Subtotal</span>
                <span className="text-fg">£{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">VAT</span>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={vatRate}
                      onChange={e => setVatRate(parseFloat(e.target.value) || 0)}
                      className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-sm text-fg text-right"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">%</span>
                  </div>
                </div>
                <span className="text-fg">£{vat.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-base border-t border-zinc-700 pt-2 mt-1">
                <span className="text-fg">Total</span>
                <span className="text-fg">£{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Notes / Terms</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes or terms…" rows={3} className="w-full input-field resize-none" />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button onClick={save} disabled={saving || !title.trim()} className="btn-primary text-sm disabled:opacity-50">
              {saving ? 'Saving…' : isNew ? 'Create Quote' : 'Save Changes'}
            </button>
            {!isNew && (
              <>
                <button onClick={sendQuote} disabled={sending || quote?.status === 'accepted'} className="btn-secondary text-sm disabled:opacity-50 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  {sending ? 'Sending…' : 'Send to Client'}
                </button>
                <button onClick={copyLink} className="btn-secondary text-sm flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <button onClick={deleteQuote} disabled={deleting} className="ml-auto text-sm text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  </svg>
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        {!isNew && quote && (
          <div className="space-y-4">
            {quote.client && (
              <div className="card space-y-2 text-sm">
                <h3 className="font-semibold text-fg">Client</h3>
                <Link href={`/clients/${quote.client_id}`} className="text-red-400 hover:underline font-medium">{quote.client.company_name}</Link>
                {quote.client.contact_name && <p className="text-zinc-400">{quote.client.contact_name}</p>}
                {quote.client.contact_email && <p className="text-zinc-400">{quote.client.contact_email}</p>}
              </div>
            )}
            <div className="card space-y-2 text-sm">
              <h3 className="font-semibold text-fg">Quote Status</h3>
              <p className="text-zinc-400">Status: <span className="text-fg">{IT_QUOTE_STATUS_LABELS[quote.status]}</span></p>
              {quote.sent_at && <p className="text-zinc-400">Sent: <span className="text-fg">{new Date(quote.sent_at).toLocaleDateString('en-GB')}</span></p>}
              {quote.accepted_at && <p className="text-zinc-400">Accepted: <span className="text-fg">{new Date(quote.accepted_at).toLocaleDateString('en-GB')}</span></p>}
            </div>
            <div className="card space-y-2 text-sm">
              <h3 className="font-semibold text-fg">Client Link</h3>
              <p className="text-xs text-zinc-500 break-all">/it-quote/{quote.quote_token.slice(0, 16)}…</p>
              <button onClick={copyLink} className="w-full btn-secondary text-xs py-1.5">{copied ? '✓ Copied!' : 'Copy Public Link'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
