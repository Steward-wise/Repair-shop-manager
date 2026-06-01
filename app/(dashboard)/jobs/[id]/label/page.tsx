'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { formatTicketNumber } from '@/lib/utils'

export default function LabelPage() {
  const params = useParams<{ id: string }>()
  const [job, setJob] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    fetch(`/api/jobs/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setJob(d.job)
        setTimeout(() => window.print(), 300)
      })
  }, [params.id])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (!job) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const ticketDisplay = formatTicketNumber(job.ticket_number as number)
  const customer = job.customer as Record<string, string> | null
  const trackUrl = `${appUrl}/track/${job.ticket_number}`

  return (
    <>
      <style>{`
        @page {
          size: 62mm 29mm;
          margin: 0;
        }
        @media print {
          body { background: white !important; margin: 0; }
          .no-print { display: none !important; }
          .label { margin: 0 !important; box-shadow: none !important; border: none !important; }
        }
        @media screen {
          body { background: #09090b; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        }
      `}</style>

      {/* Buttons hidden when printing */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-10">
        <button
          onClick={() => window.print()}
          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-red-700"
        >
          Print Label
        </button>
        <button
          onClick={() => window.close()}
          className="bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-zinc-600"
        >
          Close
        </button>
      </div>

      {/* Label — 62mm × 29mm */}
      <div
        className="label bg-white text-black flex items-center gap-2 border border-gray-300 shadow-xl"
        style={{ width: '62mm', height: '29mm', padding: '2mm', fontFamily: 'monospace', boxSizing: 'border-box' }}
      >
        {/* QR code */}
        <QRCodeSVG
          value={trackUrl}
          size={72}
          bgColor="#ffffff"
          fgColor="#000000"
          style={{ flexShrink: 0 }}
        />

        {/* Text info */}
        <div style={{ flex: 1, overflow: 'hidden', lineHeight: '1.2' }}>
          <div style={{ fontSize: '14pt', fontWeight: 'bold', letterSpacing: '-0.5px' }}>{ticketDisplay}</div>
          {customer?.name && (
            <div style={{ fontSize: '7pt', marginTop: '1mm', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {customer.name}
            </div>
          )}
          <div style={{ fontSize: '7pt', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {job.device_make as string} {job.device_model as string}
          </div>
          <div style={{ fontSize: '5.5pt', color: '#666', marginTop: '1mm' }}>
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'}
          </div>
        </div>
      </div>
    </>
  )
}
