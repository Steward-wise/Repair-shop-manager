'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Article { id: string; title: string; content: string; category: string; tags: string[]; author: string | null; is_published: boolean; created_at: string; updated_at: string }

const CATEGORIES = ['general','operations','technical','customer_service','hr','finance','it_support']
const CATEGORY_LABELS: Record<string, string> = {
  general: 'General', operations: 'Operations', technical: 'Technical',
  customer_service: 'Customer Service', hr: 'HR', finance: 'Finance', it_support: 'IT Support',
}

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState<Partial<Article>>({})

  useEffect(() => {
    fetch(`/api/knowledge/${id}`)
      .then(r => r.json())
      .then(j => { setArticle(j.article); setForm(j.article ?? {}); setLoading(false) })
  }, [id])

  function setF(field: string, val: unknown) { setForm(f => ({ ...f, [field]: val })) }

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/knowledge/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const json = await res.json()
    if (json.article) { setArticle(json.article); setEditing(false) }
    setSaving(false)
  }

  async function deleteArticle() {
    if (!confirm('Delete this article?')) return
    setDeleting(true)
    await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
    router.push('/knowledge')
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">Loading…</div>
  if (!article) return <div className="flex items-center justify-center h-64 text-red-400 text-sm">Article not found</div>

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/knowledge" className="text-zinc-400 hover:text-fg transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <div className="flex-1" />
        {!editing && (
          <>
            <button onClick={() => setEditing(true)} className="btn-primary text-sm">Edit</button>
            <button onClick={deleteArticle} disabled={deleting} className="text-sm text-zinc-500 hover:text-red-400 transition-colors">{deleting ? 'Deleting…' : 'Delete'}</button>
          </>
        )}
        {editing && (
          <>
            <button onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => { setEditing(false); setForm(article) }} className="btn-secondary text-sm">Cancel</button>
          </>
        )}
      </div>

      {editing ? (
        <div className="card space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Title</label>
            <input type="text" value={form.title ?? ''} onChange={e => setF('title', e.target.value)} className="w-full input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Category</label>
              <select value={form.category ?? 'general'} onChange={e => setF('category', e.target.value)} className="w-full input">
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Author</label>
              <input type="text" value={form.author ?? ''} onChange={e => setF('author', e.target.value)} className="w-full input" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Content (Markdown supported)</label>
            <textarea value={form.content ?? ''} onChange={e => setF('content', e.target.value)} rows={20} className="w-full input font-mono text-sm" style={{ resize: 'vertical' }} />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={form.is_published ?? true} onChange={e => setF('is_published', e.target.checked)} />
            Published
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 bg-zinc-800 border border-zinc-700 rounded-full px-2 py-0.5 capitalize">{CATEGORY_LABELS[article.category] ?? article.category}</span>
            {!article.is_published && <span className="text-xs text-zinc-500 border border-zinc-700 rounded-full px-2 py-0.5">Draft</span>}
            {article.author && <span className="text-xs text-zinc-500">by {article.author}</span>}
            <span className="text-xs text-zinc-600 ml-auto">Updated {new Date(article.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <h1 className="text-3xl font-bold text-fg">{article.title}</h1>
          <div className="card prose-sm max-w-none">
            <pre className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">{article.content}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
