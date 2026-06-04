'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import toast, { Toaster } from 'react-hot-toast'
import JobStatusBadge from '@/components/job-status-badge'
import SignaturePad from '@/components/signature-pad'
import { formatTicketNumber, formatDateTime, formatCurrency, generateCollectionLink } from '@/lib/utils'
import {
  JOB_STATUS_LABELS, DEVICE_TYPE_LABELS,
  type Job, type JobStatus, type InventoryItem, type JobPart, type JobTimeLog
} from '@/types'

const STATUS_FLOW: JobStatus[] = ['intake', 'diagnosed', 'awaiting_approval', 'awaiting_repair', 'in_progress', 'waiting_parts', 'ready', 'collected']

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [internalNote, setInternalNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [finalPrice, setFinalPrice] = useState('')
  const [savingPrice, setSavingPrice] = useState(false)
  const [technicianName, setTechnicianName] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositPaid, setDepositPaid] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'deposit_paid' | 'paid'>('unpaid')
  const [markingPaid, setMarkingPaid] = useState(false)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [selectedPart, setSelectedPart] = useState('')
  const [partQty, setPartQty] = useState('1')
  const [addingPart, setAddingPart] = useState(false)
  const [parts, setParts] = useState<JobPart[]>([])
  const [timeLogs, setTimeLogs] = useState<JobTimeLog[]>([])
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [activeLogId, setActiveLogId] = useState<string | null>(null)
  const [timerRunning, setTimerRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0) // seconds
  const [timerTechName, setTimerTechName] = useState('')
  const [sendingRating, setSendingRating] = useState(false)
  const [sendingApproval, setSendingApproval] = useState(false)
  const [checklist, setChecklist] = useState<{ label: string; checked: boolean }[]>([])

  // Sign collection modal
  const [showSignModal, setShowSignModal] = useState(false)
  const [signCollectorName, setSignCollectorName] = useState('')
  const [signingCollection, setSigningCollection] = useState(false)

  // Sign intake modal
  const [showIntakeSignModal, setShowIntakeSignModal] = useState(false)
  const [signingIntake, setSigningIntake] = useState(false)

  useEffect(() => {
    loadJob()
    loadInventory()
    loadTimeLogs()
  }, [id])

  // Live timer tick
  useEffect(() => {
    if (!timerRunning) return
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(interval)
  }, [timerRunning])

  async function loadJob() {
    const res = await fetch(`/api/jobs/${id}`)
    if (!res.ok) { router.push('/jobs'); return }
    const data = await res.json()
    setJob(data.job)
    setFinalPrice(data.job.final_price?.toString() ?? '')
    setTechnicianName(data.job.technician_name ?? '')
    setInternalNote(data.job.internal_notes ?? '')
    setParts(data.job.parts ?? [])
    setDepositAmount(data.job.deposit_amount?.toString() ?? '')
    setDepositPaid(data.job.deposit_paid ?? false)
    setPaymentMethod(data.job.payment_method ?? '')
    setPaymentStatus(data.job.payment_status ?? 'unpaid')
    setChecklist(data.job.checklist ?? [])
    setLoading(false)
  }

  async function loadInventory() {
    const res = await fetch('/api/inventory')
    const data = await res.json()
    setInventory(data.items ?? [])
  }

  async function loadTimeLogs() {
    const res = await fetch(`/api/jobs/${id}/time`)
    const data = await res.json()
    setTimeLogs(data.logs ?? [])
    setTotalMinutes(data.total_minutes ?? 0)
    // Check if there's an active (unended) log
    const active = (data.logs ?? []).find((l: JobTimeLog) => !l.ended_at)
    if (active) {
      setActiveLogId(active.id)
      setTimerRunning(true)
      const startedSeconds = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000)
      setElapsed(startedSeconds)
    }
  }

  async function startTimer() {
    const res = await fetch(`/api/jobs/${id}/time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ technician: timerTechName || null }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error('Failed to start timer'); return }
    setActiveLogId(data.log.id)
    setTimerRunning(true)
    setElapsed(0)
    toast.success('Timer started')
  }

  async function stopTimer() {
    if (!activeLogId) return
    const res = await fetch(`/api/jobs/${id}/time`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logId: activeLogId }),
    })
    if (!res.ok) { toast.error('Failed to stop timer'); return }
    setTimerRunning(false)
    setActiveLogId(null)
    setElapsed(0)
    toast.success('Timer stopped')
    loadTimeLogs()
  }

  function formatDuration(minutes: number | null | undefined) {
    if (!minutes) return '—'
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  function formatElapsed(secs: number) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  async function updateStatus(newStatus: JobStatus) {
    setUpdatingStatus(true)
    const res = await fetch(`/api/jobs/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to update status'); setUpdatingStatus(false); return }
    setJob(data.job)
    toast.success(`Status updated to ${JOB_STATUS_LABELS[newStatus]}`)
    if (data.notified) toast.success('Customer notified via SMS/email')
    setUpdatingStatus(false)
  }

  async function saveInternalNote() {
    setSavingNote(true)
    const res = await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ internal_notes: internalNote, final_price: finalPrice ? parseFloat(finalPrice) : null, technician_name: technicianName }),
    })
    const data = await res.json()
    if (!res.ok) toast.error('Failed to save')
    else { setJob(data.job); toast.success('Saved') }
    setSavingNote(false)
  }

  async function addPart() {
    if (!selectedPart) return
    setAddingPart(true)
    const item = inventory.find((i) => i.id === selectedPart)
    const res = await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        add_part: {
          inventory_id: item?.id,
          part_name: item?.part_name ?? 'Unknown part',
          quantity: parseInt(partQty, 10) || 1,
          unit_price: item?.sell_price,
        },
      }),
    })
    const data = await res.json()
    if (!res.ok) toast.error(data.error ?? 'Failed to add part')
    else { setParts(data.parts ?? []); toast.success('Part added'); setSelectedPart(''); setPartQty('1') }
    setAddingPart(false)
  }

  async function updatePayment(newStatus: 'unpaid' | 'deposit_paid' | 'paid', method?: string) {
    setMarkingPaid(true)
    const res = await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_status: newStatus,
        deposit_amount: depositAmount ? parseFloat(depositAmount) : 0,
        deposit_paid: newStatus !== 'unpaid',
        payment_method: method ?? paymentMethod,
      }),
    })
    const data = await res.json()
    if (!res.ok) toast.error('Failed to update payment')
    else {
      setJob(data.job)
      setPaymentStatus(newStatus)
      setDepositPaid(newStatus !== 'unpaid')
      if (method) setPaymentMethod(method)
      toast.success(newStatus === 'paid' ? 'Marked as fully paid' : newStatus === 'deposit_paid' ? 'Deposit recorded' : 'Payment status updated')
    }
    setMarkingPaid(false)
  }

  async function sendQuoteForApproval() {
    if (!finalPrice || parseFloat(finalPrice) <= 0) {
      toast.error('Enter a final price first')
      return
    }
    // Save price first
    await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ final_price: parseFloat(finalPrice), technician_name: technicianName, internal_notes: internalNote }),
    })
    setSendingApproval(true)
    const res = await fetch(`/api/jobs/${id}/send-quote`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to send quote')
    } else {
      toast.success('Quote sent to customer for approval!')
      loadJob()
    }
    setSendingApproval(false)
  }

  async function handleSignIntake(dataUrl: string) {
    setSigningIntake(true)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const formData = new FormData()
      formData.append('file', blob, 'intake-signature.png')
      formData.append('jobId', id)
      formData.append('photoType', 'signature')
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error ?? 'Upload failed')

      const res = await fetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intake_signature_url: uploadData.url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save signature')

      setJob(data.job)
      setShowIntakeSignModal(false)
      toast.success('Intake signature saved!')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSigningIntake(false)
    }
  }

  async function handleSignCollection(dataUrl: string) {
    setSigningCollection(true)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const formData = new FormData()
      formData.append('file', blob, 'collection-signature.png')
      formData.append('jobId', id)
      formData.append('photoType', 'signature')
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error ?? 'Upload failed')

      const res = await fetch(`/api/jobs/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'collected',
          signature_url: uploadData.url,
          collector_name: signCollectorName.trim() || 'Customer',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to record collection')

      setJob(data.job)
      setShowSignModal(false)
      setSignCollectorName('')
      toast.success('Collection signed and recorded!')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSigningCollection(false)
    }
  }

  async function sendRatingRequest() {
    setSendingRating(true)
    const res = await fetch(`/api/jobs/${id}/send-rating`, { method: 'POST' })

    const data = await res.json()
    if (!res.ok) toast.error(data.error ?? 'Failed to send rating request')
    else toast.success('Rating request sent!')
    setSendingRating(false)
  }

  async function toggleChecklistItem(idx: number) {
    const updated = checklist.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item)
    setChecklist(updated)
    const res = await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklist: updated }),
    })
    if (!res.ok) {
      // Revert on failure
      setChecklist(checklist)
      toast.error('Failed to update checklist')
    }
  }

  function copyCollectionLink() {
    const link = generateCollectionLink(id)
    navigator.clipboard.writeText(link)
    toast.success('Collection link copied!')
  }

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function deleteJob() {
    setDeleting(true)
    const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Failed to delete job')
      setDeleting(false)
      setConfirmDelete(false)
      return
    }
    toast.success('Job deleted')
    router.push('/jobs')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!job) return null

  const currentStatusIndex = STATUS_FLOW.indexOf(job.status)

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46' } }} />

      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-muted hover:text-fg transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-fg font-mono">{formatTicketNumber(job.ticket_number)}</h1>
                <JobStatusBadge status={job.status} />
              </div>
              <p className="text-muted text-sm mt-0.5">{job.device_make} {job.device_model} · {job.customer?.name ?? 'Walk-in'}</p>
            </div>
          </div>
          <div className="ml-auto flex gap-2 flex-wrap">
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn-secondary text-sm flex items-center gap-2 text-red-400 border-red-900 hover:bg-red-900/30"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
              Delete
            </button>
            <button
              onClick={() => window.open(`/jobs/${id}/print`, '_blank')}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>
              </svg>
              Print Job Sheet
            </button>
            {!job.intake_signature_url && (
              <button
                onClick={() => setShowIntakeSignModal(true)}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>
                </svg>
                Sign Intake
              </button>
            )}
            {job.status !== 'collected' && (
              <button
                onClick={() => setShowSignModal(true)}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>
                </svg>
                Sign Collection
              </button>
            )}
            <button
              onClick={() => window.open(`/jobs/${id}/intake-receipt`, '_blank')}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="M16.5 9.4 7.55 4.24"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/>
              </svg>
              Intake Receipt
            </button>
            <button
              onClick={() => window.open(`/jobs/${id}/receipt`, '_blank')}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
              Print Receipt
            </button>
            <button
              onClick={() => window.open(`/jobs/${id}/label`, '_blank')}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
              Print Label
            </button>
            {job.status === 'ready' && (
              <button onClick={copyCollectionLink} className="btn-secondary text-sm flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
                Copy collection link
              </button>
            )}
            {job.customer?.email && (
              <button
                onClick={sendRatingRequest}
                disabled={sendingRating}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                {sendingRating ? 'Sending…' : 'Send Rating Request'}
              </button>
            )}
          </div>
        </div>

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="card border-red-800 space-y-3">
            <p className="text-sm text-fg font-medium">Delete this job?</p>
            <p className="text-xs text-muted">This will permanently remove the job, all parts, photos, and time logs. This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={deleteJob}
                disabled={deleting}
                className="btn-secondary text-sm text-red-400 border-red-800 hover:bg-red-900/30"
              >
                {deleting ? 'Deleting…' : 'Yes, delete job'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Status pipeline */}
        <div className="card">
          <h2 className="font-semibold text-fg mb-4 text-sm">Update Status</h2>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {STATUS_FLOW.map((s, i) => {
              const isPast = i < currentStatusIndex
              const isCurrent = i === currentStatusIndex
              return (
                <button
                  key={s}
                  disabled={updatingStatus || isCurrent}
                  onClick={() => !isCurrent && updateStatus(s)}
                  className={`flex-1 min-w-[90px] px-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                    isCurrent
                      ? 'border-primary bg-primary-muted text-primary'
                      : isPast
                      ? 'border-border bg-surface-2 text-muted hover:border-primary/50 hover:text-fg cursor-pointer'
                      : 'border-border bg-surface-2 text-fg hover:border-primary hover:bg-primary-muted cursor-pointer'
                  }`}
                >
                  {isPast && '✓ '}
                  {JOB_STATUS_LABELS[s]}
                </button>
              )
            })}
          </div>
          {updatingStatus && <p className="text-xs text-muted mt-2 text-center">Updating and sending notifications…</p>}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Device Info */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-fg">Device</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Type</dt>
                <dd className="text-fg">{DEVICE_TYPE_LABELS[job.device_type]}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Make</dt>
                <dd className="text-fg">{job.device_make}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Model</dt>
                <dd className="text-fg">{job.device_model}</dd>
              </div>
              {job.imei && (
                <div className="flex justify-between">
                  <dt className="text-muted">IMEI</dt>
                  <dd className="text-fg font-mono text-xs">{job.imei}</dd>
                </div>
              )}
              {job.password && (
                <div className="flex justify-between">
                  <dt className="text-muted">Password</dt>
                  <dd className="text-fg font-mono">{job.password}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Backup advised</dt>
                <dd className={job.backup_required ? 'text-success' : 'text-muted'}>
                  {job.backup_required ? 'Yes' : 'No'}
                </dd>
              </div>
            </dl>
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted font-medium mb-1">Reported fault</p>
              <p className="text-sm text-fg">{job.reported_fault}</p>
            </div>
            {job.notes && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted font-medium mb-1">Customer notes</p>
                <p className="text-sm text-fg">{job.notes}</p>
              </div>
            )}
          </div>

          {/* Customer Info */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-fg">Customer</h2>
              {job.customer && (
                <Link href={`/customers/${job.customer_id}`} className="text-xs text-primary hover:underline">View profile →</Link>
              )}
            </div>
            {job.customer ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Name</dt>
                  <dd className="text-fg font-medium">{job.customer.name}</dd>
                </div>
                {job.customer.phone && (
                  <div className="flex justify-between">
                    <dt className="text-muted">Phone</dt>
                    <dd><a href={`tel:${job.customer.phone}`} className="text-primary hover:underline">{job.customer.phone}</a></dd>
                  </div>
                )}
                {job.customer.email && (
                  <div className="flex justify-between">
                    <dt className="text-muted">Email</dt>
                    <dd><a href={`mailto:${job.customer.email}`} className="text-primary hover:underline text-xs">{job.customer.email}</a></dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-muted text-sm">Walk-in customer</p>
            )}

            <div className="pt-2 border-t border-border space-y-3">
              <h3 className="font-medium text-fg text-sm">Financials</h3>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Quoted price</span>
                <span className="text-fg">{formatCurrency(job.quoted_price)}</span>
              </div>
              <div>
                <label className="label text-xs">Final price (£)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="input"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={finalPrice}
                    onChange={(e) => setFinalPrice(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="label text-xs">Technician</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Name"
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs">Internal notes</label>
                <textarea
                  className="input resize-none text-sm"
                  rows={3}
                  placeholder="Internal notes (not shown to customer)…"
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                />
              </div>
              <button onClick={saveInternalNote} disabled={savingNote} className="btn-primary w-full text-sm">
                {savingNote ? 'Saving…' : 'Save changes'}
              </button>

              {/* Quote approval — shown when diagnosed and price is set */}
              {job.status === 'diagnosed' && (
                <div className="pt-3 border-t border-zinc-800 space-y-2">
                  <p className="text-xs text-zinc-400">Send the customer a payment link to approve and pay for this repair.</p>
                  <button
                    onClick={sendQuoteForApproval}
                    disabled={sendingApproval || !finalPrice || parseFloat(finalPrice) <= 0}
                    className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 px-4 rounded-lg transition-colors"
                  >
                    {sendingApproval ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</>
                    ) : (
                      <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9l20-7z"/></svg> Send Quote for Approval</>
                    )}
                  </button>
                  {!finalPrice || parseFloat(finalPrice) <= 0 ? (
                    <p className="text-xs text-zinc-600 text-center">Enter a final price above to enable</p>
                  ) : null}
                </div>
              )}

              {/* Awaiting approval status banner */}
              {job.status === 'awaiting_approval' && (
                <div className="pt-3 border-t border-zinc-800">
                  <div className="bg-pink-900/20 border border-pink-800/40 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-pink-300">⏳ Awaiting customer approval</p>
                    <p className="text-xs text-zinc-400">Quote for <span className="text-fg font-medium">£{job.approval_price?.toFixed(2)}</span> sent{job.approval_sent_at ? ` on ${new Date(job.approval_sent_at).toLocaleDateString('en-GB')}` : ''}.</p>
                    {job.stripe_payment_link && (
                      <a href={job.stripe_payment_link} target="_blank" rel="noopener noreferrer" className="text-xs text-pink-400 underline">View payment link →</a>
                    )}
                  </div>
                </div>
              )}

              {/* Awaiting repair banner */}
              {job.status === 'awaiting_repair' && (
                <div className="pt-3 border-t border-zinc-800">
                  <div className="bg-cyan-900/20 border border-cyan-800/40 rounded-lg p-3">
                    <p className="text-xs font-semibold text-cyan-300">✓ Payment received — ready to repair</p>
                    <p className="text-xs text-zinc-400 mt-1">Customer has paid. Move to <strong>In Progress</strong> when you start the repair.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-border text-xs text-muted space-y-1">
              <div className="flex justify-between">
                <span>Created</span>
                <span>{formatDateTime(job.created_at)}</span>
              </div>
              {job.collected_at && (
                <div className="flex justify-between">
                  <span>Collected</span>
                  <span>{formatDateTime(job.collected_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Parts used */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-fg">Parts Used</h2>
            {parts.length === 0 ? (
              <p className="text-muted text-sm">No parts logged yet.</p>
            ) : (
              <div className="space-y-2">
                {parts.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm border-b border-border pb-2 last:border-0">
                    <span className="text-fg">{p.part_name} ×{p.quantity}</span>
                    <span className="text-muted">{formatCurrency(p.unit_price ? p.unit_price * p.quantity : null)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <select
                className="input text-sm flex-1"
                value={selectedPart}
                onChange={(e) => setSelectedPart(e.target.value)}
              >
                <option value="">Select part from inventory…</option>
                {inventory.map((i) => (
                  <option key={i.id} value={i.id} disabled={i.quantity === 0}>
                    {i.part_name} {i.quantity === 0 ? '(out of stock)' : `(${i.quantity} in stock)`}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="input w-16 text-sm text-center"
                value={partQty}
                min="1"
                onChange={(e) => setPartQty(e.target.value)}
              />
              <button onClick={addPart} disabled={addingPart || !selectedPart} className="btn-primary text-sm px-3">
                Add
              </button>
            </div>
          </div>

          {/* Time Tracking */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-fg">Time Tracking</h2>
              <span className="text-xs text-muted">Total: <span className="text-fg font-medium">{formatDuration(totalMinutes)}</span></span>
            </div>

            {/* Live timer */}
            <div className="flex items-center gap-2 flex-wrap">
              {!timerRunning ? (
                <>
                  <input
                    type="text"
                    placeholder="Technician (optional)"
                    value={timerTechName}
                    onChange={(e) => setTimerTechName(e.target.value)}
                    className="input text-sm flex-1 min-w-0"
                  />
                  <button onClick={startTimer} className="btn-primary text-sm px-3 flex items-center gap-1.5 whitespace-nowrap">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Start Timer
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1 font-mono text-xl font-bold text-primary tabular-nums">
                    {formatElapsed(elapsed)}
                  </div>
                  <button onClick={stopTimer} className="btn-secondary text-sm px-3 flex items-center gap-1.5 text-red-400 border-red-800 hover:bg-red-900/30 whitespace-nowrap">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                    Stop
                  </button>
                </>
              )}
            </div>

            {/* Log history */}
            {timeLogs.filter((l) => l.ended_at).length > 0 && (
              <div className="border-t border-border pt-3 space-y-1.5">
                {timeLogs.filter((l) => l.ended_at).map((log) => (
                  <div key={log.id} className="flex justify-between text-xs">
                    <span className="text-muted">
                      {log.technician ?? 'Unknown'} · {new Date(log.started_at).toLocaleDateString()}
                    </span>
                    <span className="text-fg font-medium">{formatDuration(log.duration_minutes)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checklist */}
          {checklist.length > 0 && (
            <div className="card space-y-3">
              <h2 className="font-semibold text-fg">Repair Checklist</h2>
              <div className="space-y-2">
                {checklist.map((item, idx) => (
                  <label key={idx} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleChecklistItem(idx)}
                      className="w-4 h-4 accent-primary flex-shrink-0"
                    />
                    <span className={`text-sm transition-colors ${item.checked ? 'line-through text-muted' : 'text-fg'}`}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted">{checklist.filter((i) => i.checked).length} / {checklist.length} completed</p>
            </div>
          )}

          {/* Warranty */}
          {job.status === 'collected' && job.warranty_expires_at && (
            <div className="card space-y-2">
              <h2 className="font-semibold text-fg">Warranty</h2>
              {new Date(job.warranty_expires_at) > new Date() ? (
                <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-700/40 rounded-lg">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400 flex-shrink-0">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-green-300">Under warranty</p>
                    <p className="text-xs text-muted">
                      Expires {new Date(job.warranty_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-surface-2 rounded-lg">
                  <p className="text-sm text-muted">Warranty expired</p>
                </div>
              )}
            </div>
          )}

          {/* Payment */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-fg">Payment</h2>
              <span className={`text-xs font-medium px-2 py-1 rounded-full border ${
                paymentStatus === 'paid' ? 'bg-green-900/40 text-green-300 border-green-700' :
                paymentStatus === 'deposit_paid' ? 'bg-yellow-900/40 text-yellow-300 border-yellow-700' :
                'bg-red-900/40 text-red-300 border-red-700'
              }`}>
                {paymentStatus === 'paid' ? 'Paid' : paymentStatus === 'deposit_paid' ? 'Deposit Paid' : 'Unpaid'}
              </span>
            </div>
            <div>
              <label className="label text-xs">Deposit amount (£)</label>
              <div className="flex gap-2">
                <input
                  type="number" className="input" placeholder="0.00" min="0" step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
                {paymentStatus === 'unpaid' && (
                  <button
                    onClick={() => updatePayment('deposit_paid')}
                    disabled={markingPaid || !depositAmount}
                    className="btn-secondary text-sm px-3 whitespace-nowrap"
                  >
                    Record deposit
                  </button>
                )}
              </div>
            </div>
            {paymentStatus !== 'paid' && (
              <div>
                <p className="label text-xs mb-2">Mark as fully paid</p>
                <div className="flex gap-2 flex-wrap">
                  {['Cash', 'Card', 'Bank Transfer'].map((method) => (
                    <button
                      key={method}
                      onClick={() => updatePayment('paid', method)}
                      disabled={markingPaid}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {paymentStatus === 'paid' && (
              <div className="text-sm text-muted flex justify-between">
                <span>Payment method</span>
                <span className="text-fg">{paymentMethod || '—'}</span>
              </div>
            )}
          </div>

          {/* Photos */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-fg">Photos</h2>
            {!job.photos?.length ? (
              <p className="text-muted text-sm">No photos attached.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {job.photos.map((p) => (
                  <div key={p.id} className="relative rounded-lg overflow-hidden">
                    <div className="relative h-32 bg-surface-2">
                      <Image src={p.url} alt={p.photo_type} fill className="object-cover" />
                    </div>
                    <p className="text-xs text-muted mt-1 capitalize">{p.photo_type.replace('_', ' ')}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Signature */}
            {job.signature && (
              <div className="pt-3 border-t border-border">
                <h3 className="text-sm font-medium text-fg mb-2">Collection Signature</h3>
                <div className="relative h-24 bg-white rounded-lg overflow-hidden">
                  <Image src={job.signature.signature_url} alt="Signature" fill className="object-contain p-2" />
                </div>
                <p className="text-xs text-muted mt-1">
                  Collected by {job.signature.customer_name ?? 'unknown'} · {formatDateTime(job.signature.created_at)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sign Intake Modal */}
      {showIntakeSignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md space-y-5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-fg">Sign for Intake</h2>
                <p className="text-xs text-muted mt-0.5">Customer confirms they have handed over the device</p>
              </div>
              <button
                onClick={() => setShowIntakeSignModal(false)}
                className="text-muted hover:text-fg p-1"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>

            <SignaturePad onSave={handleSignIntake} disabled={signingIntake} />

            {signingIntake && (
              <p className="text-center text-muted text-sm">Saving signature…</p>
            )}
          </div>
        </div>
      )}

      {/* Sign Collection Modal */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md space-y-5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-fg">Sign for Collection</h2>
                <p className="text-xs text-muted mt-0.5">Customer signs to confirm they are collecting this device</p>
              </div>
              <button
                onClick={() => { setShowSignModal(false); setSignCollectorName('') }}
                className="text-muted hover:text-fg p-1"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>

            <div>
              <label className="label">Collector name</label>
              <input
                type="text"
                className="input"
                placeholder="Full name of person collecting"
                value={signCollectorName}
                onChange={(e) => setSignCollectorName(e.target.value)}
                autoComplete="name"
              />
            </div>

            <SignaturePad onSave={handleSignCollection} disabled={signingCollection} />

            {signingCollection && (
              <p className="text-center text-muted text-sm">Recording collection…</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
