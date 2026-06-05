'use client'

import { useEffect, useState } from 'react'

function fmt(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Isolated timer counter — has its own state and interval so the parent
 * component does NOT re-render every second.
 */
export default function TimerCounter({ startedAtMs }: { startedAtMs: number }) {
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
  )

  useEffect(() => {
    // Sync immediately in case of stale initial value
    setElapsed(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)))
    const interval = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAtMs])

  return <span className="font-mono text-xl font-bold text-primary tabular-nums">{fmt(elapsed)}</span>
}
