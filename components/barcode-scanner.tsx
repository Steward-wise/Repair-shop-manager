'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Global USB barcode scanner listener.
 * USB scanners act as keyboards — they emit characters very quickly (< 50ms apart),
 * then send an Enter key when the barcode is complete.
 *
 * When a scan is detected that looks like a ticket number (all digits),
 * we navigate to /jobs?scan=[number] which filters to that ticket.
 */
export default function BarcodeScanner() {
  const router = useRouter()
  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore keypresses when user is typing in an input/textarea/select
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return
      }

      const now = Date.now()
      const timeSinceLast = now - lastKeyTimeRef.current
      lastKeyTimeRef.current = now

      // If more than 100ms since last key, treat as a new scan (reset buffer)
      if (timeSinceLast > 100 && bufferRef.current.length > 0) {
        bufferRef.current = ''
      }

      // Clear any pending reset timeout
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      if (e.key === 'Enter') {
        const scanned = bufferRef.current.trim()
        bufferRef.current = ''

        if (scanned.length > 0 && /^\d+$/.test(scanned)) {
          // Looks like a ticket number — navigate to jobs filtered by this scan
          router.push(`/jobs?scan=${scanned}`)
        }
        return
      }

      // Only accumulate printable single characters
      if (e.key.length === 1) {
        bufferRef.current += e.key

        // Auto-reset buffer after 500ms of inactivity (in case Enter never comes)
        timeoutRef.current = setTimeout(() => {
          bufferRef.current = ''
        }, 500)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [router])

  // This component renders nothing — it's a pure side-effect listener
  return null
}
