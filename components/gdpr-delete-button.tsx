'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'

export default function GdprDeleteButton({ customerId }: { customerId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  if (confirming) {
    return (
      <>
        <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46' } }} />
        <div className="card border-red-800 space-y-3">
          <h3 className="font-semibold text-red-400">Confirm Anonymisation</h3>
          <p className="text-sm text-muted">
            This will permanently replace the customer&apos;s name, email, and phone with anonymised values. Their job history will remain but all personal data will be removed. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-secondary text-sm text-red-400 border-red-800 hover:bg-red-900/30"
            >
              {deleting ? 'Anonymising…' : 'Yes, anonymise this customer'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46' } }} />
      <div className="card border-border space-y-2">
        <h3 className="font-semibold text-fg text-sm">Data &amp; Privacy (GDPR)</h3>
        <p className="text-xs text-muted">
          Anonymise this customer&apos;s personal data. All jobs will remain for financial records but the name, email, and phone will be permanently removed.
        </p>
        <button
          onClick={() => setConfirming(true)}
          className="text-xs text-red-400 hover:text-red-300 underline transition-colors"
        >
          Delete / Anonymise Customer Data
        </button>
      </div>
    </>
  )
}
