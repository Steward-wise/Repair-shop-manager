'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const CATEGORIES = ['general','operations','technical','customer_service','hr','finance','it_support']
const CATEGORY_LABELS: Record<string, string> = {
  general: 'General', operations: 'Operations', technical: 'Technical',
  customer_service: 'Customer Service', hr: 'HR', finance: 'Finance', it_support: 'IT Support',
}

export default function NewArticlePage() {
  const router = useRouter()
  const [form, setForm] = useState({ title: '', content: '', category: 'general', author: '', is_published: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setF(field: string, val: unknown) { setForm(f => ({ ...f, [field]: val })) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) { setError('Title and content are required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, author: form.author || null }) })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to save'); return }
      router.push(`/knowledge/${json.article.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/knowledge" className="text-zinc-400 hover:text-fg transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <h1 className="text-2xl font-bold text-fg">New Article</h1>
      </div>

      <form onSubmit={save} className="card space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Title <span className="text-red-500">*</span></label>
          <input type="text" value={form.title} onChange={e => setF('title', e.target.value)} placeholder="e.g. How to Handle a Customer Complaint" className="w-full input" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Category</label>
            <select value={form.category} onChange={e => setF('category', e.target.value)} className="w-full input">
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Author</label>
            <input type="text" value={form.author} onChange={e => setF('author', e.target.value)} placeholder="Your name" className="w-full input" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
            Content <span className="text-red-500">*</span>
            <span className="ml-2 text-zinc-600 font-normal normal-case">Markdown or plain text</span>
          </label>
          <textarea
            value={form.content}
            onChange={e => setF('content', e.target.value)}
            placeholder={`# Section Heading\n\nWrite your article content here...\n\n## Steps\n1. First step\n2. Second step`}
            rows={18}
            className="w-full input font-mono text-sm"
            style={{ resize: 'vertical' }}
            required
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
          <input type="checkbox" checked={form.is_published} onChange={e => setF('is_published', e.target.checked)} />
          Publish immediately
        </label>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save Article'}</button>
          <Link href="/knowledge" className="btn-secondary text-sm">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
