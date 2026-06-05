'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface SaleItem {
  part_name: string
  sku: string | null
  quantity: number
  unit_price: number
  total: number
}

interface PosSale {
  id: string
  items: SaleItem[]
  subtotal: number
  discount: number
  total: number
  payment_method: string
  customer_name: string | null
  customer_email: string | null
  created_by: string | null
  created_at: string
}

export default function PosReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const [sale, setSale] = useState<PosSale | null>(null)

  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
  const shopAddress = process.env.NEXT_PUBLIC_SHOP_ADDRESS ?? ''
  const shopPhone = process.env.NEXT_PUBLIC_SHOP_PHONE ?? ''

  useEffect(() => {
    fetch(`/api/pos/sale/${id}`)
      .then((r) => r.json())
      .then((d) => setSale(d.sale))
  }, [id])

  useEffect(() => {
    if (!sale) return
    const timer = setTimeout(() => window.print(), 500)
    return () => clearTimeout(timer)
  }, [sale])

  if (!sale) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const saleDate = new Date(sale.created_at)
  const dateStr = saleDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = saleDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const receiptRef = `SALE-${sale.id.slice(-6).toUpperCase()}`

  return (
    <>
      <style>{`
        @page { size: 80mm auto; margin: 6mm; }
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
        }
        @media screen {
          body { background: #09090b; }
        }
      `}</style>

      <div className="no-print fixed top-4 right-4 flex gap-2 z-10">
        <button onClick={() => window.print()} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-red-700">
          Print Receipt
        </button>
        <button onClick={() => window.location.href = '/pos/sale'} className="bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-zinc-600">
          New Sale
        </button>
        <button onClick={() => window.location.href = '/pos'} className="bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-zinc-600">
          POS Home
        </button>
      </div>

      <div className="max-w-xs mx-auto p-6 bg-white text-black min-h-screen font-mono text-sm">
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-4 mb-4">
          <p className="text-xl font-bold tracking-tight">{shopName}</p>
          {shopAddress && <p className="text-xs text-gray-600 mt-0.5">{shopAddress}</p>}
          {shopPhone && <p className="text-xs text-gray-600">{shopPhone}</p>}
          <div className="mt-3 border-t border-dashed border-gray-400 pt-2">
            <p className="text-xs text-gray-500">{dateStr} · {timeStr}</p>
            <p className="text-xs font-bold tracking-widest mt-0.5">{receiptRef}</p>
          </div>
        </div>

        {/* Customer */}
        {sale.customer_name && (
          <div className="mb-3 text-xs">
            <span className="text-gray-500">Customer: </span>{sale.customer_name}
          </div>
        )}

        {/* Items */}
        <div className="mb-4">
          <div className="border-b border-dashed border-gray-300 pb-1 mb-2 flex justify-between text-xs text-gray-500 uppercase tracking-wider">
            <span>Item</span>
            <span>Total</span>
          </div>
          {sale.items.map((item, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between">
                <span className="flex-1 pr-2 text-xs leading-tight">{item.part_name}</span>
                <span className="font-bold text-xs shrink-0">£{item.total.toFixed(2)}</span>
              </div>
              {item.quantity > 1 && (
                <div className="text-xs text-gray-500">{item.quantity} × £{item.unit_price.toFixed(2)}</div>
              )}
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-dashed border-gray-300 pt-3 space-y-1 mb-4">
          {sale.discount > 0 && (
            <>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Subtotal</span>
                <span>£{sale.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Discount</span>
                <span>-£{sale.discount.toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-base border-t border-black pt-2 mt-1">
            <span>TOTAL</span>
            <span>£{sale.total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>Payment</span>
            <span>{sale.payment_method}</span>
          </div>
        </div>

        {/* Staff */}
        {sale.created_by && (
          <p className="text-xs text-gray-500 mb-3">Served by: {sale.created_by}</p>
        )}

        {/* Footer */}
        <div className="border-t border-dashed border-gray-300 pt-3 text-center text-xs text-gray-500 space-y-1">
          <p className="font-bold text-black">Thank you!</p>
          <p>Please retain this receipt as proof of purchase.</p>
          <p className="font-mono text-gray-400 text-xs mt-2">ref: {receiptRef}</p>
        </div>
      </div>
    </>
  )
}
