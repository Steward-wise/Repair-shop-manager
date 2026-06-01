'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { JOB_STATUS_LABELS, type JobStatus } from '@/types'

interface SearchResult {
  type: 'job' | 'customer'
  id: string
  label: string
  sub: string
  href: string
  status?: string
}

export default function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
        setResults([])
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(data.results ?? [])
        setActiveIndex(0)
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    search(v)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[activeIndex]) {
      navigate(results[activeIndex].href)
    }
  }

  function navigate(href: string) {
    router.push(href)
    setOpen(false)
    setQuery('')
    setResults([])
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-muted text-sm hover:border-primary/50 transition-colors w-full max-w-xs"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden sm:inline text-xs bg-surface px-1.5 py-0.5 rounded border border-border font-mono">⌘K</kbd>
      </button>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={() => { setOpen(false); setQuery(''); setResults([]) }}
      />

      {/* Modal */}
      <div className="fixed top-[10vh] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
        <div className="bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Input row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
            ) : (
              <svg className="text-muted flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Search jobs, customers, devices…"
              className="flex-1 bg-transparent text-fg placeholder:text-muted outline-none text-sm"
              autoComplete="off"
            />
            <kbd className="text-xs text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border font-mono">Esc</kbd>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <ul className="max-h-80 overflow-y-auto py-2">
              {results.map((r, i) => (
                <li key={`${r.type}-${r.id}`}>
                  <button
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === activeIndex ? 'bg-primary/10' : 'hover:bg-surface-2'
                    }`}
                    onClick={() => navigate(r.href)}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    {/* Icon */}
                    <span className="flex-shrink-0 w-7 h-7 rounded-md bg-surface-2 flex items-center justify-center">
                      {r.type === 'job' ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                      )}
                    </span>

                    {/* Text */}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-fg truncate">{r.label}</span>
                      <span className="block text-xs text-muted truncate">{r.sub}</span>
                    </span>

                    {/* Status badge for jobs */}
                    {r.type === 'job' && r.status && (
                      <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-surface-2 text-muted border border-border">
                        {JOB_STATUS_LABELS[r.status as JobStatus] ?? r.status}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Empty state */}
          {query.length >= 2 && !loading && results.length === 0 && (
            <div className="py-8 text-center text-sm text-muted">No results for &ldquo;{query}&rdquo;</div>
          )}

          {/* Hint */}
          {query.length === 0 && (
            <div className="px-4 py-3 text-xs text-muted flex items-center gap-4">
              <span><kbd className="font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono">↵</kbd> open</span>
              <span><kbd className="font-mono">Esc</kbd> close</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
