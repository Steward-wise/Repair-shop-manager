import { cn } from '@/lib/utils'
import { JOB_STATUS_COLORS, JOB_STATUS_LABELS, type JobStatus } from '@/types'

interface JobStatusBadgeProps {
  status: JobStatus
  className?: string
}

export default function JobStatusBadge({ status, className }: JobStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        JOB_STATUS_COLORS[status],
        className
      )}
    >
      {JOB_STATUS_LABELS[status]}
    </span>
  )
}
