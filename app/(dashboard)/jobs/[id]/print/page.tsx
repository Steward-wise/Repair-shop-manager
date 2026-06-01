'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { formatTicketNumber, formatDateTime, formatCurrency, formatDate } from '@/lib/utils'
import { DEVICE_TYPE_LABELS } from '@/types'

interface PrintJob {
  ticket_number: number
  created_at: string
  device_make: string
  device_model: string
  device_type: string
  imei: string | null
  reported_fault: string
  password: string | null
  backup_required: boolean
  quoted_price: number | null
  final_price: number | null
  technician_name: string | null
  notes: string | null
  customer: { name: string; phone: string | null; email: string | null } | null
  parts: { id: string; part_name: string; quantity: number; unit_price: number | null }[]
}

export default function PrintJobPage() {
  const params = useParams<{ id: string }>()
  const [job, setJob] = useState<PrintJob | null>(null)

  useEffect(() => {
    fetch(`/api/jobs/${params.id}`)
      .then((r) => r.json())
      .then((d) => setJob(d.job as PrintJob))
  }, [params.id])

  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
  const shopPhone = process.env.NEXT_PUBLIC_SHOP_PHONE ?? ''

  if (!job) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-page { padding: 0 !important; }
        }
        @media screen {
          body { background: #09090b; }
        }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-10">
        <button
          onClick={() => window.print()}
          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-red-700"
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          className="bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-zinc-600"
        >
          Close
        </button>
      </div>

      <div className="print-page max-w-2xl mx-auto p-8 bg-white text-black min-h-screen font-sans">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-black">
          <div>
            <h1 className="text-2xl font-bold text-black">{shopName}</h1>
            {shopPhone && <p className="text-sm text-gray-600">{shopPhone}</p>}
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <p className="text-3xl font-mono font-bold text-black">{formatTicketNumber(job.ticket_number)}</p>
            <p className="text-sm text-gray-500">{formatDate(job.created_at)}</p>
            <QRCodeSVG
              value={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/track/${String(job.ticket_number)}`}
              size={72}
              bgColor="#ffffff"
              fgColor="#000000"
            />
            <p className="text-xs text-gray-400">Scan to track</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Customer */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Customer</h2>
            {job.customer ? (
              <div className="text-sm space-y-1">
                <p className="font-semibold text-black">{job.customer.name}</p>
                {job.customer.phone && <p className="text-gray-700">{job.customer.phone}</p>}
                {job.customer.email && <p className="text-gray-700">{job.customer.email}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Walk-in</p>
            )}
          </div>

          {/* Device */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Device</h2>
            <div className="text-sm space-y-1">
              <p className="font-semibold text-black">{job.device_make} {job.device_model}</p>
              <p className="text-gray-700">{DEVICE_TYPE_LABELS[job.device_type as keyof typeof DEVICE_TYPE_LABELS]}</p>
              {job.imei && <p className="text-gray-700 font-mono text-xs">IMEI: {job.imei}</p>}
            </div>
          </div>
        </div>

        {/* Fault */}
        <div className="mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Reported Fault</h2>
          <p className="text-sm text-black border border-gray-300 rounded p-3 bg-gray-50">{job.reported_fault}</p>
        </div>

        {/* Security */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Device Password</h2>
            <p className="text-sm font-mono border border-gray-300 rounded p-2 bg-gray-50 min-h-[36px]">
              {job.password ?? ''}
            </p>
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Backup Advised</h2>
            <p className="text-sm border border-gray-300 rounded p-2 bg-gray-50 min-h-[36px]">
              {job.backup_required ? 'Yes — customer advised' : 'No'}
            </p>
          </div>
        </div>

        {/* Financials */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Quoted</h2>
            <p className="text-lg font-bold text-black">{formatCurrency(job.quoted_price)}</p>
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Final Price</h2>
            <p className="text-lg font-bold text-black">{formatCurrency(job.final_price)}</p>
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Technician</h2>
            <p className="text-sm text-black">{job.technician_name ?? '—'}</p>
          </div>
        </div>

        {/* Parts */}
        {job.parts.length > 0 && (
          <div className="mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Parts Used</h2>
            <table className="w-full text-sm border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-2 border-b border-gray-300">Part</th>
                  <th className="text-center p-2 border-b border-gray-300">Qty</th>
                  <th className="text-right p-2 border-b border-gray-300">Price</th>
                </tr>
              </thead>
              <tbody>
                {job.parts.map((p) => (
                  <tr key={p.id} className="border-b border-gray-200">
                    <td className="p-2">{p.part_name}</td>
                    <td className="p-2 text-center">{p.quantity}</td>
                    <td className="p-2 text-right">{formatCurrency(p.unit_price ? p.unit_price * p.quantity : null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        {job.notes && (
          <div className="mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Customer Notes</h2>
            <p className="text-sm text-black border border-gray-300 rounded p-3 bg-gray-50">{job.notes}</p>
          </div>
        )}

        {/* Signature box */}
        <div className="mt-8 pt-6 border-t-2 border-black grid grid-cols-2 gap-8">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Customer Signature</h2>
            <div className="border border-gray-400 rounded h-20 bg-gray-50" />
            <p className="text-xs text-gray-500 mt-1">Signature at collection</p>
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Date Collected</h2>
            <div className="border border-gray-400 rounded h-20 bg-gray-50" />
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          Printed {formatDateTime(new Date().toISOString())} · {shopName}
        </p>
      </div>
    </>
  )
}
