'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'

interface Props {
  customerId: string
  customerName?: string
}

export default function GdprDeleteButton({ customerId, customerName }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(`/api/gdpr/export/${customerId}`)
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Export failed')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gdpr-export-${customerId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Data export downloaded')
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/customers/${customerId}`, { method: 'DELETE' })
    const data = await res.json()
    setDeleting(false)
    setConfirming(false)
    if (!res.ok) {
      toast.error(data.error ?? 'Could not anonymise customer')
      return
    }
    toast.success('Customer data anonymised (GDPR)')
    setTimeout(() => router.push('/customers'), 1500)
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46' } }} />

      <div className="card border-border space-y-3">
        <div>
          <h3 className="font-semibold text-fg text-sm">Data &amp; Privacy (GDPR)</h3>
          <p className="text-xs text-muted mt-0.5">
            Under UK GDPR, customers have the right to access their data and the right to erasure.
          </p>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          {/* Right of Access — Article 15 */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exporting ? 'Exporting…' : 'Export All Data'}
          </button>

          {/* Right to Erasure — Article 17 */}
          {!confirming && (
            <button
              onClick={() => setConfirming(true)}
              className="text-xs text-red-400 hover:text-red-300 underline transition-colors"
            >
              Anonymise / Erase Personal Data
            </button>
          )}
        </div>

        {confirming && (
          <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg space-y-2">
            <p className="text-sm text-red-300 font-medium">Confirm erasure{customerName ? ` for ${customerName}` : ''}?</p>
            <p className="text-xs text-muted">
              Name, email and phone will be permanently replaced with anonymised values. Job history is retained for financial and legal records. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={deleting} className="btn-secondary text-sm text-red-400 border-red-800 hover:bg-red-900/30">
                {deleting ? 'Anonymising…' : 'Yes, erase personal data'}
              </button>
              <button onClick={() => setConfirming(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted border-t border-border pt-2">
          Exports include all repair records, notes, photos metadata, and consent history. All exports are logged in the audit trail.
        </p>
      </div>
    </>
  )
}
