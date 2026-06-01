'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ITQuote, ITQuoteItem } from '@/types'

interface Props {
  quote: ITQuote
  token: string
  shopName: string
  shopPhone: string
}

export default function ITQuoteClient({ quote, token, shopName, shopPhone }: Props) {
  const router = useRouter()
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(quote.status === 'accepted')

  const items = quote.items as ITQuoteItem[]
  const subtotal = quote.subtotal
  const vatRate = quote.vat_rate
  const vat = quote.total - subtotal
  const total = quote.total

  async function accept() {
    setAccepting(true)
    const res = await fetch(`/api/it-quotes/public?token=${token}`, { method: 'POST' })
    if (res.ok) {
      setAccepted(true)
      router.push('/it-quote/confirmed')
    } else {
      setAccepting(false)
      alert('Something went wrong — please try again or contact us.')
    }
  }

  const isExpired = quote.valid_until ? new Date(quote.valid_until) < new Date() : false

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Top bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
            <span className="font-bold text-lg text-white">{shopName}</span>
          </div>
          {shopPhone && (
            <a href={`tel:${shopPhone}`} className="text-sm text-zinc-400 hover:text-white transition-colors">{shopPhone}</a>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Title */}
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">IT Quote</p>
          <h1 className="text-3xl font-bold text-white">{quote.title}</h1>
          {quote.client && (
            <p className="text-zinc-400 mt-1">Prepared for <span className="text-white">{quote.client.company_name}</span>
              {quote.client.contact_name ? ` · ${quote.client.contact_name}` : ''}
            </p>
          )}
          {quote.valid_until && (
            <p className={`text-sm mt-2 ${isExpired ? 'text-red-400' : 'text-zinc-400'}`}>
              {isExpired ? '⚠ This quote has expired' : `Valid until ${new Date(quote.valid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
            </p>
          )}
        </div>

        {/* Items table */}
        <div className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-800 text-zinc-400 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-semibold">Description</th>
                <th className="px-5 py-3 text-center font-semibold">Qty</th>
                <th className="px-5 py-3 text-right font-semibold">Unit Price</th>
                <th className="px-5 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-t border-zinc-800">
                  <td className="px-5 py-4 text-white">{item.description}</td>
                  <td className="px-5 py-4 text-center text-zinc-300">{item.quantity}</td>
                  <td className="px-5 py-4 text-right text-zinc-300">£{item.unit_price.toFixed(2)}</td>
                  <td className="px-5 py-4 text-right text-white font-medium">£{(item.quantity * item.unit_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-zinc-700">
              <tr>
                <td colSpan={3} className="px-5 py-3 text-right text-zinc-400 text-sm">Subtotal</td>
                <td className="px-5 py-3 text-right text-white">£{subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="px-5 py-3 text-right text-zinc-400 text-sm">VAT ({vatRate}%)</td>
                <td className="px-5 py-3 text-right text-white">£{vat.toFixed(2)}</td>
              </tr>
              <tr className="bg-zinc-800">
                <td colSpan={3} className="px-5 py-4 text-right font-bold text-white">Total (inc. VAT)</td>
                <td className="px-5 py-4 text-right font-bold text-white text-lg">£{total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Notes</h3>
            <p className="text-zinc-300 whitespace-pre-wrap text-sm">{quote.notes}</p>
          </div>
        )}

        {/* CTA */}
        {!accepted && !isExpired && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Ready to proceed?</h2>
            <p className="text-zinc-400 text-sm">Click the button below to accept this quote. One of our engineers will be in touch to arrange a visit or next steps.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={accept}
                disabled={accepting}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-sm"
              >
                {accepting ? 'Accepting…' : '✓ Accept & Proceed'}
              </button>
              {shopPhone && (
                <a href={`tel:${shopPhone}`} className="flex-1 text-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold py-3 px-6 rounded-xl transition-colors text-sm">
                  📞 Call Us Instead
                </a>
              )}
            </div>
          </div>
        )}

        {accepted && (
          <div className="bg-green-900/20 border border-green-700/40 rounded-2xl p-6 text-center space-y-2">
            <div className="text-4xl">✓</div>
            <h2 className="text-xl font-bold text-green-400">Quote Accepted</h2>
            <p className="text-zinc-400 text-sm">Thank you! We&apos;ll be in touch soon to arrange the work.</p>
          </div>
        )}

        {isExpired && quote.status !== 'accepted' && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 text-center space-y-2">
            <h2 className="text-lg font-bold text-zinc-400">Quote Expired</h2>
            <p className="text-zinc-500 text-sm">This quote is no longer valid. Please contact us for an updated quote.</p>
            {shopPhone && (
              <a href={`tel:${shopPhone}`} className="inline-block mt-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold py-2 px-5 rounded-lg transition-colors text-sm">
                📞 {shopPhone}
              </a>
            )}
          </div>
        )}

        <p className="text-center text-xs text-zinc-600 pb-4">&copy; {new Date().getFullYear()} {shopName}</p>
      </div>
    </div>
  )
}
