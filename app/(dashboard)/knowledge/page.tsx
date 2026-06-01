'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Article { id: string; title: string; category: string; tags: string[]; author: string | null; updated_at: string; is_published: boolean }

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-zinc-800 text-zinc-400 border-zinc-600',
  operations: 'bg-blue-900/40 text-blue-300 border-blue-700',
  technical: 'bg-purple-900/40 text-purple-300 border-purple-700',
  customer_service: 'bg-green-900/40 text-green-300 border-green-700',
  hr: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  finance: 'bg-orange-900/40 text-orange-300 border-orange-700',
  it_support: 'bg-red-900/40 text-red-300 border-red-700',
}

const CATEGORIES = ['general', 'operations', 'technical', 'customer_service', 'hr', 'finance', 'it_support']
const CATEGORY_LABELS: Record<string, string> = {
  general: 'General', operations: 'Operations', technical: 'Technical',
  customer_service: 'Customer Service', hr: 'HR', finance: 'Finance', it_support: 'IT Support',
}

export default function KnowledgePage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (category) params.set('category', category)
    const res = await fetch(`/api/knowledge?${params}`)
    const json = await res.json()
    setArticles(json.articles ?? [])
    setLoading(false)
  }, [q, category])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-fg">Knowledge Base</h1>
          <p className="text-muted text-sm mt-0.5">Company docs, SOPs, and how-to guides</p>
        </div>
        <Link href="/knowledge/new" className="btn-primary flex items-center gap-2 text-sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"/><path d="M12 5v14"/>
          </svg>
          New Article
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Search articles…" value={q} onChange={e => setQ(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-fg placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-red-600" />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-fg focus:outline-none focus:ring-1 focus:ring-red-600">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">Loading…</div>
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <p className="text-sm">No articles yet</p>
          <Link href="/knowledge/new" className="btn-primary text-sm">Write First Article</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {articles.map(a => (
            <Link key={a.id} href={`/knowledge/${a.id}`} className="card hover:border-zinc-600 transition-colors block space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${CATEGORY_COLORS[a.category] ?? CATEGORY_COLORS.general}`}>
                  {CATEGORY_LABELS[a.category] ?? a.category}
                </span>
                {!a.is_published && <span className="text-xs text-zinc-500 border border-zinc-700 rounded-full px-2 py-0.5">Draft</span>}
              </div>
              <h3 className="font-semibold text-fg leading-snug">{a.title}</h3>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{a.author ?? 'Unknown'}</span>
                <span>{new Date(a.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
