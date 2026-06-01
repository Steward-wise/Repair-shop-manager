'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import type { InventoryItem } from '@/types'

type FormData = Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>

const EMPTY_FORM: FormData = {
  part_name: '',
  sku: null,
  description: null,
  quantity: 0,
  reorder_threshold: 5,
  cost_price: null,
  sell_price: null,
  supplier: null,
  supplier_email: null as string | null,
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    const res = await fetch('/api/inventory')
    const data = await res.json()
    setItems(data.items ?? [])
    setLoading(false)
  }

  function startEdit(item: InventoryItem) {
    setEditingId(item.id)
    setForm({
      part_name: item.part_name,
      sku: item.sku,
      description: item.description,
      quantity: item.quantity,
      reorder_threshold: item.reorder_threshold,
      cost_price: item.cost_price,
      sell_price: item.sell_price,
      supplier: item.supplier,
      supplier_email: item.supplier_email,
    })
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function saveItem() {
    if (!form.part_name.trim()) { toast.error('Part name is required'); return }
    setSaving(true)

    const body = {
      part_name: form.part_name.trim(),
      sku: form.sku?.trim() || null,
      description: form.description?.trim() || null,
      quantity: Number(form.quantity) || 0,
      reorder_threshold: Number(form.reorder_threshold) || 5,
      cost_price: form.cost_price ? Number(form.cost_price) : null,
      sell_price: form.sell_price ? Number(form.sell_price) : null,
      supplier: form.supplier?.trim() || null,
      supplier_email: form.supplier_email?.trim() || null,
    }

    const url = editingId ? `/api/inventory/${editingId}` : '/api/inventory'
    const method = editingId ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    if (!res.ok) { toast.error(data.error ?? 'Save failed'); setSaving(false); return }

    toast.success(editingId ? 'Part updated' : 'Part added')
    cancelForm()
    loadItems()
    setSaving(false)
  }

  async function adjustStock(id: string, delta: number) {
    const item = items.find((i) => i.id === id)
    if (!item) return
    const newQty = Math.max(0, item.quantity + delta)
    const res = await fetch(`/api/inventory/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: newQty }),
    })
    if (res.ok) {
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: newQty } : i))
    }
  }

  const filtered = items.filter((i) =>
    i.part_name.toLowerCase().includes(search.toLowerCase()) ||
    (i.sku ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (i.supplier ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const lowStock = items.filter((i) => i.quantity <= i.reorder_threshold)

  async function checkReorderStock() {
    const res = await fetch('/api/inventory/reorder-check', { method: 'POST' })
    const data = await res.json()
    if (data.sent) toast.success(`Reorder alert sent for ${data.count} item${data.count > 1 ? 's' : ''}`)
    else toast.success('All stock levels OK — no alert needed')
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46' } }} />

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-fg">Inventory</h1>
            <p className="text-muted text-sm">{items.length} parts · {lowStock.length} low stock</p>
          </div>
          {lowStock.length > 0 && (
            <Link href="/inventory/purchase-order" className="btn-secondary flex items-center gap-2 text-sm">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M9 12h6"/><path d="M9 16h6"/>
              </svg>
              Purchase Order
            </Link>
          )}
          <Link href="/inventory/import" className="btn-secondary flex items-center gap-2 text-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
            </svg>
            Import CSV
          </Link>
          <button onClick={checkReorderStock} className="btn-secondary flex items-center gap-2 text-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.1a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"/>
            </svg>
            Email Reorder Alert
          </button>
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }} className="btn-primary flex items-center gap-2 text-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            Add Part
          </button>
        </div>

        {/* Low stock alert */}
        {lowStock.length > 0 && (
          <div className="p-4 bg-yellow-900/20 border border-yellow-900/40 rounded-xl flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning flex-shrink-0 mt-0.5">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
            </svg>
            <div>
              <p className="text-sm font-medium text-warning">Low stock alert</p>
              <p className="text-xs text-muted mt-0.5">
                {lowStock.map((i) => `${i.part_name} (${i.quantity} left)`).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Add/Edit form */}
        {showForm && (
          <div className="card border-primary/30 border-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-fg">{editingId ? 'Edit Part' : 'Add New Part'}</h2>
              <button onClick={cancelForm} className="text-muted hover:text-fg transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Part name *</label>
                <input type="text" className="input" placeholder="e.g. iPhone 15 Screen" value={form.part_name} onChange={(e) => setForm({ ...form, part_name: e.target.value })} />
              </div>
              <div>
                <label className="label">SKU / Part number</label>
                <input type="text" className="input" placeholder="e.g. IP15-SCR-001" value={form.sku ?? ''} onChange={(e) => setForm({ ...form, sku: e.target.value || null })} />
              </div>
              <div>
                <label className="label">Quantity in stock</label>
                <input type="number" className="input" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="label">Reorder threshold</label>
                <input type="number" className="input" min="0" value={form.reorder_threshold} onChange={(e) => setForm({ ...form, reorder_threshold: parseInt(e.target.value) || 5 })} />
              </div>
              <div>
                <label className="label">Cost price (£)</label>
                <input type="number" className="input" min="0" step="0.01" placeholder="0.00" value={form.cost_price ?? ''} onChange={(e) => setForm({ ...form, cost_price: e.target.value ? parseFloat(e.target.value) : null })} />
              </div>
              <div>
                <label className="label">Sell price (£)</label>
                <input type="number" className="input" min="0" step="0.01" placeholder="0.00" value={form.sell_price ?? ''} onChange={(e) => setForm({ ...form, sell_price: e.target.value ? parseFloat(e.target.value) : null })} />
              </div>
              <div>
                <label className="label">Supplier</label>
                <input type="text" className="input" placeholder="Supplier name" value={form.supplier ?? ''} onChange={(e) => setForm({ ...form, supplier: e.target.value || null })} />
              </div>
              <div>
                <label className="label">Supplier Email</label>
                <input type="email" className="input" placeholder="orders@supplier.com" value={form.supplier_email ?? ''} onChange={(e) => setForm({ ...form, supplier_email: e.target.value || null })} />
              </div>
              <div>
                <label className="label">Description</label>
                <input type="text" className="input" placeholder="Brief description" value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value || null })} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={cancelForm} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveItem} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : editingId ? 'Update Part' : 'Add Part'}
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <input
          type="search"
          className="input max-w-sm"
          placeholder="Search parts, SKU, supplier…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted">
              <p>No parts found. {!search && 'Add your first part above.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2">
                    <th className="text-left text-muted font-medium py-3 px-4">Part</th>
                    <th className="text-left text-muted font-medium py-3 px-4 hidden sm:table-cell">SKU</th>
                    <th className="text-center text-muted font-medium py-3 px-4">Stock</th>
                    <th className="text-right text-muted font-medium py-3 px-4 hidden md:table-cell">Cost</th>
                    <th className="text-right text-muted font-medium py-3 px-4 hidden md:table-cell">Sell</th>
                    <th className="text-right text-muted font-medium py-3 px-4 hidden lg:table-cell">Supplier</th>
                    <th className="text-right text-muted font-medium py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((item) => {
                    const isLow = item.quantity <= item.reorder_threshold
                    return (
                      <tr key={item.id} className="hover:bg-surface-2/50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-fg">{item.part_name}</p>
                          {item.description && <p className="text-xs text-muted">{item.description}</p>}
                        </td>
                        <td className="py-3 px-4 hidden sm:table-cell text-muted font-mono text-xs">{item.sku ?? '—'}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => adjustStock(item.id, -1)}
                              disabled={item.quantity === 0}
                              className="w-6 h-6 rounded bg-surface-2 hover:bg-border text-muted hover:text-fg flex items-center justify-center transition-colors disabled:opacity-30"
                            >−</button>
                            <span className={`font-bold min-w-[2rem] text-center ${isLow ? 'text-warning' : 'text-fg'}`}>
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => adjustStock(item.id, 1)}
                              className="w-6 h-6 rounded bg-surface-2 hover:bg-border text-muted hover:text-fg flex items-center justify-center transition-colors"
                            >+</button>
                          </div>
                          {isLow && <p className="text-xs text-warning text-center mt-0.5">Low stock</p>}
                        </td>
                        <td className="py-3 px-4 text-right text-muted hidden md:table-cell">{formatCurrency(item.cost_price)}</td>
                        <td className="py-3 px-4 text-right text-fg hidden md:table-cell">{formatCurrency(item.sell_price)}</td>
                        <td className="py-3 px-4 text-right text-muted text-xs hidden lg:table-cell">{item.supplier ?? '—'}</td>
                        <td className="py-3 px-4 text-right">
                          <button onClick={() => startEdit(item)} className="text-xs text-primary hover:underline">Edit</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
