'use client'

import { useEffect } from 'react'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-red-900/20 border border-red-800/40 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-fg">Something went wrong</h2>
        <p className="text-sm text-muted mt-1 max-w-sm">{error.message || 'An unexpected error occurred on this page.'}</p>
      </div>
      <button
        onClick={reset}
        className="btn-primary text-sm"
      >
        Try again
      </button>
    </div>
  )
}
