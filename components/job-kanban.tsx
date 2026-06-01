'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  closestCenter,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Job, JobStatus } from '@/types'
import { JOB_STATUS_LABELS } from '@/types'
import { formatCurrency, formatTicketNumber } from '@/lib/utils'
import JobStatusBadge from './job-status-badge'

const COLUMNS: JobStatus[] = ['intake', 'diagnosed', 'in_progress', 'waiting_parts', 'ready', 'collected']

const COLUMN_COLORS: Record<JobStatus, string> = {
  intake:        'border-blue-500/40 bg-blue-500/5',
  diagnosed:     'border-purple-500/40 bg-purple-500/5',
  in_progress:   'border-yellow-500/40 bg-yellow-500/5',
  waiting_parts: 'border-orange-500/40 bg-orange-500/5',
  ready:         'border-green-500/40 bg-green-500/5',
  collected:     'border-zinc-600/40 bg-zinc-600/5',
}
const COLUMN_HEADER: Record<JobStatus, string> = {
  intake:        'text-blue-400',
  diagnosed:     'text-purple-400',
  in_progress:   'text-yellow-400',
  waiting_parts: 'text-orange-400',
  ready:         'text-green-400',
  collected:     'text-zinc-400',
}

function JobCard({ job, isDragging = false }: { job: Job; isDragging?: boolean }) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: job.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-surface border border-zinc-800 rounded-lg p-3 cursor-grab active:cursor-grabbing select-none ${isDragging ? 'shadow-2xl rotate-1 scale-105' : 'hover:border-zinc-700 transition-colors'}`}
      onClick={(e) => {
        // Only navigate if not dragging
        if (!isSortableDragging) {
          e.stopPropagation()
          router.push(`/jobs/${job.id}`)
        }
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-zinc-500">#{formatTicketNumber(job.ticket_number)}</span>
        {job.final_price != null && (
          <span className="text-xs font-semibold text-green-400">{formatCurrency(job.final_price)}</span>
        )}
      </div>
      <p className="text-sm font-medium text-fg truncate">
        {job.customer?.name ?? 'No customer'}
      </p>
      <p className="text-xs text-zinc-400 truncate mt-0.5">
        {job.device_make} {job.device_model}
      </p>
      {job.reported_fault && (
        <p className="text-xs text-zinc-500 truncate mt-1">{job.reported_fault}</p>
      )}
      <div className="flex items-center justify-between mt-2 gap-2">
        {job.technician_name && (
          <span className="text-xs text-zinc-500 truncate">{job.technician_name}</span>
        )}
        {job.payment_status === 'paid' && (
          <span className="text-xs text-green-400 ml-auto shrink-0">Paid ✓</span>
        )}
        {job.payment_status === 'deposit_paid' && (
          <span className="text-xs text-yellow-400 ml-auto shrink-0">Deposit</span>
        )}
      </div>
    </div>
  )
}

function Column({ status, jobs }: { status: JobStatus; jobs: Job[] }) {
  return (
    <div className={`flex flex-col rounded-xl border ${COLUMN_COLORS[status]} min-h-[200px] w-64 shrink-0`}>
      <div className="px-3 py-2.5 border-b border-zinc-800/60">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${COLUMN_HEADER[status]}`}>
            {JOB_STATUS_LABELS[status]}
          </span>
          <span className="text-xs font-medium bg-zinc-800 text-zinc-400 rounded-full px-2 py-0.5">
            {jobs.length}
          </span>
        </div>
      </div>
      <SortableContext items={jobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-2 flex-1">
          {jobs.map(job => (
            <JobCard key={job.id} job={job} />
          ))}
          {jobs.length === 0 && (
            <div className="flex items-center justify-center h-16 text-zinc-700 text-xs">
              Empty
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export default function JobKanban({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs)
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const jobsByStatus = useCallback(() => {
    const map: Record<JobStatus, Job[]> = {
      intake: [], diagnosed: [], in_progress: [], waiting_parts: [], ready: [], collected: []
    }
    for (const job of jobs) {
      if (map[job.status]) map[job.status].push(job)
    }
    return map
  }, [jobs])

  function handleDragStart(event: DragStartEvent) {
    const job = jobs.find(j => j.id === event.active.id)
    if (job) setActiveJob(job)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveJob(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    // Determine which column the card was dropped into
    // over.id could be a job id (dropped on another card) or a column status
    const targetStatus = COLUMNS.find(s => s === over.id)
      ?? jobs.find(j => j.id === over.id)?.status

    if (!targetStatus) return

    const draggedJob = jobs.find(j => j.id === active.id)
    if (!draggedJob || draggedJob.status === targetStatus) return

    // Optimistic update
    setJobs(prev => prev.map(j => j.id === active.id ? { ...j, status: targetStatus } : j))

    // Persist to server
    setSaving(String(active.id))
    try {
      await fetch(`/api/jobs/${active.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      })
    } catch {
      // Revert on failure
      setJobs(prev => prev.map(j => j.id === active.id ? { ...j, status: draggedJob.status } : j))
    } finally {
      setSaving(null)
    }
  }

  const grouped = jobsByStatus()

  return (
    <div className="relative">
      {saving && (
        <div className="absolute top-0 right-0 text-xs text-zinc-500 flex items-center gap-1">
          <div className="w-3 h-3 border border-zinc-500 border-t-transparent rounded-full animate-spin" />
          Saving…
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map(status => (
            <Column key={status} status={status} jobs={grouped[status]} />
          ))}
        </div>
        <DragOverlay>
          {activeJob && (
            <div className="w-64">
              <JobCard job={activeJob} isDragging />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
