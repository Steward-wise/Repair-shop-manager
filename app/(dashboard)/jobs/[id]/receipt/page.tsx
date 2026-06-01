'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatTicketNumber, formatDateTime, formatCurrency, formatDate } from '@/lib/utils'

interface ReceiptJob {
  id: string
  ticket_number: number
  created_at: string
  device_make: string
  device_model: string
  imei: string | null
  reported_fault: string
  notes: string | null
  final_price: number | null
  quoted_price: number | null
  payment_method: string | null
  warranty_days: number | null
  warranty_expires_at: string | null
  technician_name: string | null
  status: string
  customer: { name: string; phone: string | null; email: string | null } | null
  parts: { id: string; part_name: string; quantity: number; unit_price: number | null }[]
}

export default function ReceiptPage() {
  const params = useParams<{ id: string }>()
  const [job, setJob] = useState<ReceiptJob | null>(null)

  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
  const shopAddress = process.env.NEXT_PUBLIC_SHOP_ADDRESS ?? ''
  const shopPhone = process.env.NEXT_PUBLIC_SHOP_PHONE ?? ''

  useEffect(() => {
    fetch(`/api/jobs/${params.id}`)
      .then((r) => r.json())
      .then((d) => setJob(d.job as ReceiptJob))
  }, [params.id])

  useEffect(() => {
    if (!job) return
    const timer = setTimeout(() => window.print(), 500)
    return () => clearTimeout(timer)
  }, [job])

  if (!job) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const partsTotal = job.parts.reduce((sum, p) => sum + (p.unit_price ?? 0) * p.quantity, 0)
  const totalPaid = job.final_price ?? job.quoted_price ?? 0

  return (
    <>
      <style>{`
        @page { size: A5 portrait; margin: 12mm; }
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
        }
        @media screen {
          body { background: #09090b; }
        }
      `}</style>

      {/* Screen-only controls */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-10">
        <button
          onClick={() => window.print()}
          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-red-700"
        >
          Print Receipt
        </button>
        <button
          onClick={() => window.close()}
          className="bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-zinc-600"
        >
          Close
        </button>
      </div>

      <div className="max-w-md mx-auto p-8 bg-white text-black min-h-screen font-sans text-sm">
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-4 mb-5">
          <h1 className="text-xl font-bold">{shopName}</h1>
          {shopAddress && <p className="text-xs text-gray-600 mt-0.5">{shopAddress}</p>}
          {shopPhone && <p className="text-xs text-gray-600">{shopPhone}</p>}
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-widest uppercase">Receipt</p>
            <p className="font-mono font-bold text-lg">{formatTicketNumber(job.ticket_number)}</p>
            <p className="text-xs text-gray-500">{formatDate(job.created_at)}</p>
          </div>
        </div>

        {/* Customer */}
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Customer</p>
          {job.customer ? (
            <>
              <p className="font-semibold">{job.customer.name}</p>
              {job.customer.phone && <p className="text-gray-700 text-xs">{job.customer.phone}</p>}
            </>
          ) : (
            <p className="text-gray-500">Walk-in</p>
          )}
        </div>

        {/* Device */}
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Device</p>
          <p className="font-semibold">{job.device_make} {job.device_model}</p>
          {job.imei && <p className="font-mono text-xs text-gray-600">IMEI: {job.imei}</p>}
        </div>

        {/* Fault & work done */}
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Fault / Work Done</p>
          <p className="text-gray-800">{job.reported_fault}</p>
          {job.notes && <p className="text-gray-600 mt-1 text-xs italic">{job.notes}</p>}
        </div>

        {/* Parts */}
        {job.parts.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Parts Used</p>
            <table className="w-full text-xs border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-1.5 border-b border-gray-200">Part</th>
                  <th className="text-center p-1.5 border-b border-gray-200">Qty</th>
                  <th className="text-right p-1.5 border-b border-gray-200">Total</th>
                </tr>
              </thead>
              <tbody>
                {job.parts.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="p-1.5">{p.part_name}</td>
                    <td className="p-1.5 text-center">{p.quantity}</td>
                    <td className="p-1.5 text-right">{formatCurrency(p.unit_price ? p.unit_price * p.quantity : null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="border-t border-black pt-3 mb-4 space-y-1">
          {job.parts.length > 0 && (
            <div className="flex justify-between text-xs text-gray-600">
              <span>Parts subtotal</span>
              <span>{formatCurrency(partsTotal)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base">
            <span>Total Paid</span>
            <span>{formatCurrency(totalPaid)}</span>
          </div>
          {job.payment_method && (
            <div className="flex justify-between text-xs text-gray-600">
              <span>Payment method</span>
              <span>{job.payment_method}</span>
            </div>
          )}
        </div>

        {/* Warranty */}
        {job.warranty_days && job.warranty_days > 0 && (
          <div className="border border-gray-300 rounded p-3 mb-5 bg-gray-50">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Warranty</p>
            <p className="text-xs text-gray-700">
              This repair carries a <strong>{job.warranty_days}-day warranty</strong>
              {job.warranty_expires_at
                ? ` expiring ${formatDate(job.warranty_expires_at)}`
                : ''}.
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Please retain this receipt as proof of warranty.</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-300 pt-4 text-center">
          <p className="font-semibold text-sm">Thank you for choosing {shopName}</p>
          <p className="text-xs text-gray-500 mt-1">Printed {formatDateTime(new Date().toISOString())}</p>
        </div>
      </div>
    </>
  )
}
