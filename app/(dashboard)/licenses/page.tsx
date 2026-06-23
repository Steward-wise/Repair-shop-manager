'use client'

import { useEffect, useState, useCallback } from 'react'
import toast, { Toaster } from 'react-hot-toast'

interface License {
  id: string
  key: string
  customer_email: string | null
  customer_name: string | null
  plan: string
  status: string
  activations: number
  max_activations: number
  notes: string | null
  activated_domains: string[]
  created_at: string
  expires_at: string | null
}

const STATUS_COLOURS: Record<string, string> = {
  active:  'bg-green-500/15 text-green-400 border-green-800',
  revoked: 'bg-red-500/15 text-red-400 border-red-800',
  expired: 'bg-zinc-500/15 text-muted border-zinc-700',
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ customer_name: '', customer_email: '', plan: 'standard', max_activations: '3', notes: '', expires_at: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/license/generate')
    const data = await res.json()
    setLicenses(data.licenses ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createLicense() {
    setSaving(true)
    const res = await fetch('/api/license/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        max_activations: parseInt(form.max_activations) || 3,
        expires_at: form.expires_at || null,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
    toast.success(`License created: ${data.license.key}`)
    setShowForm(false)
    setForm({ customer_name: '', customer_email: '', plan: 'standard', max_activations: '3', notes: '', expires_at: '' })
    load()
  }

  async function setStatus(id: string, status: string) {
    const res = await fetch('/api/license/generate', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (res.ok) { toast.success(`License ${status}`); load() }
    else toast.error('Failed to update')
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key)
    toast.success('Key copied to clipboard')
  }

  const active = licenses.filter(l => l.status === 'active').length

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46' } }} />
      <div className="space-y-6 max-w-5xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-fg">License Keys</h1>
            <p className="text-muted text-sm mt-0.5">{active} active · {licenses.length} total</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            Generate Key
          </button>
        </div>

        {/* Info banner */}
        <div className="card border-primary/30 bg-primary/5 text-sm text-muted space-y-1">
          <p className="text-fg font-medium">How licensing works</p>
          <p>Each key lets a shop owner activate up to the configured number of deployments. They enter the key during the setup wizard at <code className="text-primary text-xs bg-surface px-1 py-0.5 rounded">/setup</code>. Your validation endpoint is <code className="text-primary text-xs bg-surface px-1 py-0.5 rounded">https://app.404fixed.co.uk/api/license/validate</code>.</p>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="card space-y-4">
            <h2 className="text-base font-semibold text-fg">New License Key</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Customer Name</label>
                <input className="input w-full" placeholder="Shop owner's name" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Customer Email</label>
                <input className="input w-full" type="email" placeholder="their@email.com" value={form.customer_email} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Plan</label>
                <select className="input w-full" value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                  <option value="standard">Standard</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Max Deployments</label>
                <input className="input w-full" type="number" min="1" max="10" value={form.max_activations} onChange={e => setForm(f => ({ ...f, max_activations: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Expires (optional)</label>
                <input className="input w-full" type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Notes</label>
                <input className="input w-full" placeholder="e.g. Gumroad order #123" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={createLicense} disabled={saving} className="btn-primary text-sm">
                {saving ? 'Generating…' : 'Generate License Key'}
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : licenses.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-muted">No licenses yet. Generate your first key above.</p>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="text-left p-3 text-muted font-medium">Key</th>
                  <th className="text-left p-3 text-muted font-medium hidden sm:table-cell">Customer</th>
                  <th className="text-left p-3 text-muted font-medium hidden md:table-cell">Plan</th>
                  <th className="text-left p-3 text-muted font-medium">Uses</th>
                  <th className="text-left p-3 text-muted font-medium">Status</th>
                  <th className="text-left p-3 text-muted font-medium hidden lg:table-cell">Created</th>
                  <th className="w-24 p-3" />
                </tr>
              </thead>
              <tbody>
                {licenses.map(lic => (
                  <tr key={lic.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs text-primary">{lic.key}</code>
                        <button onClick={() => copyKey(lic.key)} title="Copy" className="text-muted hover:text-primary transition-colors">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                          </svg>
                        </button>
                      </div>
                      {lic.notes && <p className="text-xs text-muted mt-0.5">{lic.notes}</p>}
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <p className="text-fg text-sm">{lic.customer_name ?? <span className="text-muted">—</span>}</p>
                      {lic.customer_email && <p className="text-xs text-muted">{lic.customer_email}</p>}
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <span className="text-xs capitalize text-muted">{lic.plan}</span>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs font-medium ${lic.activations >= lic.max_activations ? 'text-orange-400' : 'text-muted'}`}>
                        {lic.activations} / {lic.max_activations}
                      </span>
                      {lic.activated_domains?.length > 0 && (
                        <p className="text-[10px] text-muted mt-0.5 hidden lg:block">{lic.activated_domains.join(', ')}</p>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOURS[lic.status] ?? ''}`}>
                        {lic.status}
                      </span>
                    </td>
                    <td className="p-3 text-muted text-xs hidden lg:table-cell whitespace-nowrap">
                      {new Date(lic.created_at).toLocaleDateString('en-GB')}
                      {lic.expires_at && <p className="text-[10px]">Exp: {new Date(lic.expires_at).toLocaleDateString('en-GB')}</p>}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        {lic.status === 'active' ? (
                          <button onClick={() => setStatus(lic.id, 'revoked')} className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded border border-red-900 hover:bg-red-950">
                            Revoke
                          </button>
                        ) : (
                          <button onClick={() => setStatus(lic.id, 'active')} className="text-xs text-green-400 hover:text-green-300 transition-colors px-2 py-1 rounded border border-green-900 hover:bg-green-950">
                            Re-activate
                          </button>
                        )}
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
