'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { type Quote, QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS, type QuoteStatus } from '@/types'

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [finalPrice, setFinalPrice] = useState('')
  const [priceNotes, setPriceNotes] = useState('')
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    fetch(`/api/quotes/${id}`)
      .then(r => r.json())
      .then(d => {
        setQuote(d.quote)
        setFinalPrice(d.quote?.final_price?.toString() ?? d.quote?.suggested_price?.toString() ?? '')
        setPriceNotes(d.quote?.price_notes ?? '')
        setAdminNotes(d.quote?.admin_notes ?? '')
        setLoading(false)
      })
  }, [id])

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/quotes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        final_price: finalPrice ? parseFloat(finalPrice) : null,
        price_notes: priceNotes.trim() || null,
        admin_notes: adminNotes.trim() || null,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(data.error ?? 'Save failed'); return }
    setQuote(data.quote)
    toast.success('Saved')
  }

  async function sendQuote() {
    if (!finalPrice && !quote?.suggested_price) { toast.error('Set a price first'); return }
    await save()
    setSending(true)
    const res = await fetch(`/api/quotes/${id}/send`, { method: 'POST' })
    const data = await res.json()
    setSending(false)
    if (!res.ok) { toast.error(data.error ?? 'Failed to send'); return }
    toast.success('Quote sent!')
    setQuote(prev => prev ? { ...prev, status: 'sent' } : prev)
  }

  async function deleteQuote() {
    if (!confirm('Permanently delete this quote? This cannot be undone.')) return
    const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Quote deleted'); router.push('/quotes') }
    else toast.error('Failed to delete quote')
  }

  async function updateStatus(status: QuoteStatus) {
    const res = await fetch(`/api/quotes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
    setQuote(data.quote)
    toast.success(`Status updated to ${QUOTE_STATUS_LABELS[status]}`)
  }

  if (loading) return (
    <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  )
  if (!quote) return <div className="card text-center py-12"><p className="text-muted">Quote not found</p></div>

  const status = quote.status as QuoteStatus

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46' } }} />
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => router.push('/quotes')} className="text-muted hover:text-fg transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h1 className="text-2xl font-bold text-fg">{quote.first_name} {quote.last_name}</h1>
          <button
            onClick={deleteQuote}
            title="Delete quote"
            className="ml-auto flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 border border-red-800 hover:bg-red-950 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            Delete Quote
          </button>
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${QUOTE_STATUS_COLORS[status]}`}>
            {QUOTE_STATUS_LABELS[status]}
          </span>
          <span className="text-xs text-muted ml-auto">{new Date(quote.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: customer + device */}
          <div className="space-y-4">
            <div className="card space-y-3">
              <h2 className="font-semibold text-fg">Customer</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Name</dt><dd className="text-fg">{quote.first_name} {quote.last_name}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Email</dt><dd className="text-fg"><a href={`mailto:${quote.email}`} className="text-primary hover:underline">{quote.email}</a></dd></div>
                {quote.phone && <div className="flex justify-between"><dt className="text-muted">Phone</dt><dd className="text-fg">{quote.phone}</dd></div>}
              </dl>
            </div>
            <div className="card space-y-3">
              <h2 className="font-semibold text-fg">Device</h2>
              <dl className="space-y-2 text-sm">
                {quote.device_type && <div className="flex justify-between"><dt className="text-muted">Type</dt><dd className="text-fg capitalize">{quote.device_type}</dd></div>}
                {quote.device_make_model && <div className="flex justify-between"><dt className="text-muted">Model</dt><dd className="text-fg">{quote.device_make_model}</dd></div>}
              </dl>
              <div>
                <p className="text-xs text-muted mb-1">Problem description</p>
                <p className="text-sm text-fg bg-surface-2 rounded-lg p-3 leading-relaxed">{quote.problem_description}</p>
              </div>
              {quote.suggested_price != null && (
                <p className="text-xs text-muted">Auto-matched price: <span className="text-fg font-medium">£{quote.suggested_price.toFixed(2)}</span></p>
              )}
            </div>
          </div>

          {/* Right: pricing + actions */}
          <div className="space-y-4">
            <div className="card space-y-4">
              <h2 className="font-semibold text-fg">Quote Price</h2>
              <div>
                <label className="label">Price (£)</label>
                <input type="number" step="0.01" min="0" className="input" placeholder="0.00"
                  value={finalPrice} onChange={e => setFinalPrice(e.target.value)} />
              </div>
              <div>
                <label className="label">Price notes <span className="text-muted">(optional)</span></label>
                <input type="text" className="input" placeholder="e.g. depending on parts availability"
                  value={priceNotes} onChange={e => setPriceNotes(e.target.value)} />
              </div>
              <div>
                <label className="label">Internal notes <span className="text-muted">(not sent to customer)</span></label>
                <textarea className="input resize-none" rows={2} placeholder="Notes for your team…"
                  value={adminNotes} onChange={e => setAdminNotes(e.target.value)} />
              </div>
              <button onClick={save} disabled={saving} className="btn-secondary text-sm w-full">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>

            <div className="card space-y-3">
              <h2 className="font-semibold text-fg">Actions</h2>
              {(status === 'pending' || status === 'sent') && (
                <button onClick={sendQuote} disabled={sending} className="btn-primary w-full">
                  {sending ? 'Sending…' : status === 'sent' ? 'Re-send Quote' : 'Approve & Send Quote'}
                </button>
              )}
              {status === 'accepted' && (
                <button onClick={() => router.push(`/jobs/new`)} className="btn-primary w-full">
                  Convert to Job →
                </button>
              )}
              {status === 'booked' && (
                <div className="p-3 bg-purple-900/20 border border-purple-800 rounded-lg">
                  <p className="text-sm text-purple-300 font-medium">Customer has booked an appointment</p>
                </div>
              )}
              {!['closed', 'declined'].includes(status) && (
                <button onClick={() => updateStatus('declined')} className="btn-secondary w-full text-red-400 border-red-800 hover:bg-red-900/20">
                  Decline
                </button>
              )}
              {status !== 'closed' && (
                <button onClick={() => updateStatus('closed')} className="btn-secondary w-full text-sm">
                  Close
                </button>
              )}
              {quote.sent_at && (
                <p className="text-xs text-muted">Sent {new Date(quote.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              )}
              {quote.responded_at && (
                <p className="text-xs text-muted">Customer responded {new Date(quote.responded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
