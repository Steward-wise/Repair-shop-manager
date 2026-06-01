import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return format(new Date(date), 'dd MMM yyyy')
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), 'dd MMM yyyy, HH:mm')
}

export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatCurrency(amount: number | null) {
  if (amount === null) return '—'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount)
}

export function formatTicketNumber(num: number) {
  return `#${String(num).padStart(5, '0')}`
}

export function generateCollectionLink(jobId: string, baseUrl?: string) {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base}/collect/${jobId}`
}

export function generateTrackingLink(ticketNumber: number, baseUrl?: string) {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base}/track/${String(ticketNumber).padStart(5, '0')}`
}
