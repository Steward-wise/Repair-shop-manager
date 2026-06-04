'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatTicketNumber, formatDate } from '@/lib/utils'

interface IntakeJob {
  id: string
  ticket_number: number
  created_at: string
  intake_method: 'drop_off' | 'collection' | null
  intake_date: string | null
  alternate_contact: string | null
  intake_signature_url: string | null
  device_type: string
  device_make: string
  device_model: string
  imei: string | null
  reported_fault: string
  password: string | null
  notes: string | null
  quoted_price: number | null
  technician_name: string | null
  customer: { name: string; phone: string | null; email: string | null } | null
}

export default function IntakeReceiptPage() {
  const params = useParams<{ id: string }>()
  const [job, setJob] = useState<IntakeJob | null>(null)

  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
  const shopAddress = process.env.NEXT_PUBLIC_SHOP_ADDRESS ?? ''
  const shopPhone = process.env.NEXT_PUBLIC_SHOP_PHONE ?? ''

  useEffect(() => {
    fetch(`/api/jobs/${params.id}`)
      .then((r) => r.json())
      .then((d) => setJob(d.job as IntakeJob))
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

  const intakeLabel = job.intake_method === 'collection' ? 'Collection' : 'Drop-off'
  const displayDate = job.intake_date
    ? formatDate(job.intake_date + 'T00:00:00')
    : formatDate(job.created_at)

  return (
    <>
      <style>{`
        @page { size: A5 portrait; margin: 12mm; }
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .signature-box { break-inside: avoid; }
        }
        @media screen {
          body { background: #09090b; }
        }
      `}</style>

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
            <p className="text-2xl font-bold tracking-widest uppercase">Device {intakeLabel} Receipt</p>
            <p className="font-mono font-bold text-lg">{formatTicketNumber(job.ticket_number)}</p>
            <p className="text-xs text-gray-500">{displayDate}</p>
          </div>
        </div>

        {/* Intake method banner */}
        <div className={`mb-4 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider text-center ${
          job.intake_method === 'collection'
            ? 'bg-blue-100 text-blue-800 border border-blue-300'
            : 'bg-green-100 text-green-800 border border-green-300'
        }`}>
          {job.intake_method === 'collection'
            ? `Device collected by us on ${displayDate}`
            : `Device dropped off by customer on ${displayDate}`}
        </div>

        {/* Customer */}
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Customer</p>
          {job.customer ? (
            <>
              <p className="font-semibold">{job.customer.name}</p>
              {job.customer.phone && <p className="text-gray-700 text-xs">{job.customer.phone}</p>}
              {job.customer.email && <p className="text-gray-700 text-xs">{job.customer.email}</p>}
              {job.alternate_contact && (
                <p className="text-gray-600 text-xs mt-0.5">Alt. contact: {job.alternate_contact}</p>
              )}
            </>
          ) : (
            <p className="text-gray-500">Walk-in</p>
          )}
        </div>

        {/* Device */}
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Device Received</p>
          <p className="font-semibold">{job.device_make} {job.device_model}</p>
          <p className="text-xs text-gray-600 capitalize">{job.device_type}</p>
          {job.imei && <p className="font-mono text-xs text-gray-600 mt-0.5">IMEI: {job.imei}</p>}
        </div>

        {/* Reported fault */}
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Reported Fault</p>
          <p className="text-gray-800">{job.reported_fault}</p>
          {job.notes && <p className="text-gray-500 text-xs mt-1 italic">{job.notes}</p>}
        </div>

        {/* Estimate */}
        {job.quoted_price != null && (
          <div className="mb-4 flex justify-between border-t border-gray-200 pt-3">
            <span className="font-semibold">Estimated repair cost</span>
            <span className="font-bold">£{job.quoted_price.toFixed(2)}</span>
          </div>
        )}

        {/* Declaration */}
        <div className="border border-gray-300 rounded p-3 mb-5 bg-gray-50 text-xs text-gray-700 leading-snug">
          <p className="font-bold mb-1">Declaration</p>
          <p>
            I confirm that I have {job.intake_method === 'collection' ? 'authorised collection of' : 'voluntarily handed over'}
            {' '}the above device to <strong>{shopName}</strong> for the purpose of repair.
            I understand that the shop will contact me when the repair is complete or if further authorisation is required.
          </p>
        </div>

        {/* Signatures */}
        <div className="signature-box grid grid-cols-2 gap-6 mb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Customer signature</p>
            {job.intake_signature_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={job.intake_signature_url} alt="Customer signature" className="h-16 w-full object-contain object-left border-b border-black pb-1" />
            ) : (
              <div className="h-16 border-b border-black" />
            )}
            <p className="text-xs text-gray-500 mt-1">{job.customer?.name ?? 'Customer'}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Staff signature</p>
            <div className="h-16 border-b border-black" />
            <p className="text-xs text-gray-500 mt-1">{job.technician_name ?? 'Staff member'}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-300 pt-4 text-center">
          <p className="text-xs text-gray-500">Please retain this receipt as proof that your device has been received.</p>
          <p className="text-xs text-gray-400 mt-1">Ticket: {formatTicketNumber(job.ticket_number)}</p>
        </div>
      </div>
    </>
  )
}
