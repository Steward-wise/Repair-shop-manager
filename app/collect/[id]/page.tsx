'use client'

import { useEffect, useState, use } from 'react'
import Image from 'next/image'
import SignaturePad from '@/components/signature-pad'
import { formatTicketNumber, formatDateTime } from '@/lib/utils'
import type { Job } from '@/types'

export default function CollectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [step, setStep] = useState<'details' | 'sign' | 'done'>('details')
  const [collectorName, setCollectorName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'

  useEffect(() => {
    async function loadJob() {
      const res = await fetch(`/api/jobs/${id}`)
      if (!res.ok) { setNotFound(true); setLoading(false); return }
      const data = await res.json()
      setJob(data.job)
      setLoading(false)
    }
    loadJob()
  }, [id])

  async function handleSignature(dataUrl: string) {
    setSubmitting(true)
    setError(null)

    // Convert data URL to blob
    const blob = await (await fetch(dataUrl)).blob()
    const formData = new FormData()
    formData.append('file', blob, 'signature.png')
    formData.append('jobId', id)
    formData.append('photoType', 'signature')

    try {
      // Upload signature image
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error ?? 'Upload failed')

      // Save signature record + mark collected
      const res = await fetch(`/api/jobs/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'collected',
          signature_url: uploadData.url,
          collector_name: collectorName.trim() || 'Customer',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to record collection')

      setJob(data.job)
      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-fg mb-2">Job not found</h1>
          <p className="text-muted">This link may be invalid or the job may have already been collected.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="bg-surface border-b border-border px-4 py-4 flex items-center justify-center gap-3">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        </div>
        <span className="font-bold text-fg">{appName}</span>
      </header>

      <main className="max-w-lg mx-auto p-4 py-8 space-y-6">

        {/* Done state */}
        {step === 'done' && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-900/40 flex items-center justify-center mx-auto">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-fg mb-2">Collection confirmed!</h1>
              <p className="text-muted">
                Thank you, {collectorName || 'customer'}. Your device has been checked out.
              </p>
            </div>
            <div className="card text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Ticket</span>
                <span className="text-fg font-mono font-medium">{formatTicketNumber(job.ticket_number)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Device</span>
                <span className="text-fg">{job.device_make} {job.device_model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Collected</span>
                <span className="text-fg">{formatDateTime(new Date().toISOString())}</span>
              </div>
            </div>
            <p className="text-muted text-sm">This page can now be closed. Thank you for your business!</p>
          </div>
        )}

        {/* Job details */}
        {step === 'details' && (
          <>
            {job.status === 'collected' && (
              <div className="p-4 bg-green-900/20 border border-green-900/40 rounded-xl text-center">
                <p className="text-success font-medium">This device has already been collected.</p>
                {job.signature && (
                  <p className="text-muted text-xs mt-1">Collected {formatDateTime(job.signature.created_at)}</p>
                )}
              </div>
            )}

            {job.status !== 'collected' && job.status !== 'ready' && (
              <div className="p-4 bg-yellow-900/20 border border-yellow-900/40 rounded-xl text-center">
                <p className="text-warning font-medium">This device is not yet ready for collection.</p>
                <p className="text-muted text-xs mt-1">Please check with the shop.</p>
              </div>
            )}

            <div>
              <h1 className="text-2xl font-bold text-fg mb-1">Device Collection</h1>
              <p className="text-muted text-sm">Please review your repair details and sign to confirm collection.</p>
            </div>

            {/* Job summary */}
            <div className="card space-y-3 text-sm">
              <h2 className="font-semibold text-fg">Repair Summary</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted">Ticket</span>
                  <span className="text-fg font-mono font-medium">{formatTicketNumber(job.ticket_number)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Device</span>
                  <span className="text-fg">{job.device_make} {job.device_model}</span>
                </div>
                {job.imei && (
                  <div className="flex justify-between">
                    <span className="text-muted">IMEI</span>
                    <span className="text-fg font-mono text-xs">{job.imei}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted">Fault reported</span>
                  <span className="text-fg text-right max-w-[60%]">{job.reported_fault}</span>
                </div>
                {job.final_price !== null && (
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="text-muted font-medium">Total</span>
                    <span className="text-fg font-bold text-base">£{job.final_price?.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Photos */}
            {job.photos && job.photos.length > 0 && (
              <div className="card space-y-3">
                <h2 className="font-semibold text-fg text-sm">Pre-existing damage on intake</h2>
                <div className="grid grid-cols-2 gap-2">
                  {job.photos.filter((p) => p.photo_type === 'damage' || p.photo_type === 'intake').map((p) => (
                    <div key={p.id} className="relative h-28 rounded-lg overflow-hidden bg-surface-2">
                      <Image src={p.url} alt={p.photo_type} fill className="object-cover" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted">These photos were taken at intake. Any damage shown existed before the repair.</p>
              </div>
            )}

            {job.status === 'ready' && (
              <button
                onClick={() => setStep('sign')}
                className="btn-primary w-full text-base py-3"
              >
                Proceed to sign for collection →
              </button>
            )}
          </>
        )}

        {/* Signature step */}
        {step === 'sign' && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-fg mb-1">Sign for Collection</h1>
              <p className="text-muted text-sm">By signing below you confirm you are collecting this device in satisfactory condition.</p>
            </div>

            <div>
              <label className="label">Your name</label>
              <input
                type="text"
                className="input"
                placeholder="Full name"
                value={collectorName}
                onChange={(e) => setCollectorName(e.target.value)}
                autoComplete="name"
              />
            </div>

            <SignaturePad onSave={handleSignature} disabled={submitting} />

            {error && (
              <div className="p-3 bg-red-900/20 border border-red-900/40 rounded-lg text-sm text-primary text-center">
                {error}
              </div>
            )}

            {submitting && (
              <p className="text-center text-muted text-sm">Recording collection…</p>
            )}

            <button type="button" onClick={() => setStep('details')} className="btn-ghost w-full text-sm">
              ← Back to details
            </button>
          </>
        )}
      </main>
    </div>
  )
}
