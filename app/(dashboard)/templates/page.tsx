'use client'

import { useEffect, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import { DEVICE_TYPE_LABELS, type DeviceType } from '@/types'

const DEVICE_TYPES = Object.entries(DEVICE_TYPE_LABELS) as [DeviceType, string][]

interface ChecklistItem {
  label: string
  checked: boolean
}

interface Template {
  id: string
  name: string
  device_type: string
  device_make: string | null
  device_model: string | null
  reported_fault: string | null
  quoted_price: number | null
  warranty_days: number
  checklist: ChecklistItem[]
  created_at: string
}

const emptyForm = {
  name: '',
  device_type: 'phone' as DeviceType,
  device_make: '',
  device_model: '',
  reported_fault: '',
  quoted_price: '',
  warranty_days: '90',
  checklist: [] as ChecklistItem[],
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [newCheckItem, setNewCheckItem] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadTemplates() }, [])

  async function loadTemplates() {
    const res = await fetch('/api/templates')
    const data = await res.json()
    setTemplates(data.templates ?? [])
    setLoading(false)
  }

  function openNew() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(t: Template) {
    setForm({
      name: t.name,
      device_type: t.device_type as DeviceType,
      device_make: t.device_make ?? '',
      device_model: t.device_model ?? '',
      reported_fault: t.reported_fault ?? '',
      quoted_price: t.quoted_price?.toString() ?? '',
      warranty_days: t.warranty_days.toString(),
      checklist: t.checklist ?? [],
    })
    setEditingId(t.id)
    setShowForm(true)
  }

  function addCheckItem() {
    if (!newCheckItem.trim()) return
    setForm((f) => ({ ...f, checklist: [...f.checklist, { label: newCheckItem.trim(), checked: false }] }))
    setNewCheckItem('')
  }

  function removeCheckItem(idx: number) {
    setForm((f) => ({ ...f, checklist: f.checklist.filter((_, i) => i !== idx) }))
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Template name is required'); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      device_type: form.device_type,
      device_make: form.device_make.trim() || null,
      device_model: form.device_model.trim() || null,
      reported_fault: form.reported_fault.trim() || null,
      quoted_price: form.quoted_price ? parseFloat(form.quoted_price) : null,
      warranty_days: parseInt(form.warranty_days) || 90,
      checklist: form.checklist,
    }

    const url = editingId ? `/api/templates/${editingId}` : '/api/templates'
    const method = editingId ? 'PATCH' : 'POST'

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to save'); setSaving(false); return }

    toast.success(editingId ? 'Template updated' : 'Template created')
    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    loadTemplates()
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete'); return }
    toast.success('Template deleted')
    setTemplates((ts) => ts.filter((t) => t.id !== id))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46' } }} />

      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-fg">Job Templates</h1>
            <p className="text-muted text-sm mt-0.5">Pre-fill new jobs with common repair types</p>
          </div>
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            New Template
          </button>
        </div>

        {/* Inline Form */}
        {showForm && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-fg">{editingId ? 'Edit Template' : 'New Template'}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Template name *</label>
                <input type="text" className="input" placeholder="e.g. iPhone Screen Replacement" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Device type</label>
                <select className="input" value={form.device_type} onChange={(e) => setForm((f) => ({ ...f, device_type: e.target.value as DeviceType }))}>
                  {DEVICE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Make / Brand</label>
                <input type="text" className="input" placeholder="e.g. Apple" value={form.device_make} onChange={(e) => setForm((f) => ({ ...f, device_make: e.target.value }))} />
              </div>
              <div>
                <label className="label">Model</label>
                <input type="text" className="input" placeholder="e.g. iPhone 15 Pro" value={form.device_model} onChange={(e) => setForm((f) => ({ ...f, device_model: e.target.value }))} />
              </div>
              <div>
                <label className="label">Quoted price (£)</label>
                <input type="number" className="input" placeholder="0.00" min="0" step="0.01" value={form.quoted_price} onChange={(e) => setForm((f) => ({ ...f, quoted_price: e.target.value }))} />
              </div>
              <div>
                <label className="label">Warranty days</label>
                <input type="number" className="input" placeholder="90" min="0" value={form.warranty_days} onChange={(e) => setForm((f) => ({ ...f, warranty_days: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Reported fault</label>
                <textarea className="input resize-none" rows={2} placeholder="Describe the typical fault…" value={form.reported_fault} onChange={(e) => setForm((f) => ({ ...f, reported_fault: e.target.value }))} />
              </div>
            </div>

            {/* Checklist editor */}
            <div>
              <label className="label">Repair checklist</label>
              <div className="space-y-1 mb-2">
                {form.checklist.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-surface-2 rounded-lg px-3 py-2">
                    <span className="text-sm text-fg flex-1">{item.label}</span>
                    <button type="button" onClick={() => removeCheckItem(idx)} className="text-muted hover:text-red-400 transition-colors text-xs">Remove</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1 text-sm"
                  placeholder="Add checklist item…"
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem() } }}
                />
                <button type="button" onClick={addCheckItem} className="btn-secondary text-sm px-3">Add</button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Template'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* Templates table */}
        {templates.length === 0 ? (
          <div className="card text-center py-12">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-muted opacity-40">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <p className="text-muted">No templates yet. Create your first template to speed up job intake.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted font-medium pb-3 pr-4">Name</th>
                  <th className="text-left text-muted font-medium pb-3 pr-4 hidden sm:table-cell">Device</th>
                  <th className="text-left text-muted font-medium pb-3 pr-4 hidden md:table-cell">Price</th>
                  <th className="text-left text-muted font-medium pb-3 hidden md:table-cell">Checklist</th>
                  <th className="text-right text-muted font-medium pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-2 transition-colors">
                    <td className="py-3 pr-4 font-medium text-fg">{t.name}</td>
                    <td className="py-3 pr-4 hidden sm:table-cell text-muted">
                      {t.device_make} {t.device_model}
                      {!t.device_make && !t.device_model && (DEVICE_TYPE_LABELS[t.device_type as DeviceType] ?? t.device_type)}
                    </td>
                    <td className="py-3 pr-4 hidden md:table-cell text-muted">{formatCurrency(t.quoted_price)}</td>
                    <td className="py-3 hidden md:table-cell text-muted">{t.checklist?.length ?? 0} items</td>
                    <td className="py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(t)} className="text-xs text-primary hover:underline">Edit</button>
                        <button onClick={() => handleDelete(t.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
