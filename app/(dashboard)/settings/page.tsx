'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast, { Toaster } from 'react-hot-toast'
import { type QuoteRule, type Availability, type AvailabilityBlock, DAY_NAMES, type Technician } from '@/types'

function useAction(endpoint: string, method = 'POST') {
  const [loading, setLoading] = useState(false)
  const run = async () => {
    setLoading(true)
    try {
      const res = await fetch(endpoint, { method })
      const data = await res.json()
      return data
    } finally {
      setLoading(false)
    }
  }
  return { loading, run }
}

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const [qbConnected, setQbConnected] = useState<boolean | null>(null)
  const [qbRealmId, setQbRealmId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Quote rules
  const [rules, setRules] = useState<QuoteRule[]>([])
  const [newRule, setNewRule] = useState({ name: '', device_type: '', keywords: '', min_price: '', max_price: '', notes: '' })
  const [addingRule, setAddingRule] = useState(false)
  const [savingRule, setSavingRule] = useState(false)

  // Technicians
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [addingTech, setAddingTech] = useState(false)
  const [savingTech, setSavingTech] = useState(false)
  const [newTech, setNewTech] = useState({ name: '', email: '', phone: '' })

  // Availability
  const [availability, setAvailability] = useState<Availability[]>([])
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([])
  const [savingAvail, setSavingAvail] = useState(false)
  const [newBlock, setNewBlock] = useState({ block_date: '', reason: '' })
  const followup = useAction('/api/jobs/followup')
  const digest = useAction('/api/digest')

  // Staff accounts
  const [staffUsers, setStaffUsers] = useState<{ id: string; email: string; role: string; last_sign_in_at: string | null }[]>([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)

  // App settings (ready reminder days)
  const [reminderDays, setReminderDays] = useState('3')
  const [savingReminder, setSavingReminder] = useState(false)

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const shopPhone = process.env.NEXT_PUBLIC_SHOP_PHONE ?? ''

  useEffect(() => {
    const qbStatus = searchParams.get('qb')
    if (qbStatus === 'connected') toast.success('QuickBooks connected!')
    if (qbStatus === 'error') toast.error('QuickBooks connection failed. Check your credentials.')

    // Load app settings
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.settings?.ready_reminder_days) setReminderDays(d.settings.ready_reminder_days)
    })

    // Load staff accounts
    setLoadingStaff(true)
    fetch('/api/staff').then(r => r.json()).then(d => {
      setStaffUsers(d.users ?? [])
      setLoadingStaff(false)
    }).catch(() => setLoadingStaff(false))

    // Load technicians
    fetch('/api/technicians').then(r => r.json()).then(d => setTechnicians(d.technicians ?? []))
    // Load quote rules
    fetch('/api/quote-rules').then(r => r.json()).then(d => setRules(d.rules ?? []))
    // Load availability
    fetch('/api/availability').then(r => r.json()).then(d => {
      if (d.availability) {
        // Fill in all 7 days
        const map = Object.fromEntries(d.availability.map((a: Availability) => [a.day_of_week, a]))
        setAvailability(Array.from({ length: 7 }, (_, i) => map[i] ?? { day_of_week: i, start_time: '09:00', end_time: '18:00', slot_duration_mins: 60, is_active: false, id: '' }))
      }
    })
    fetch('/api/availability/blocks').then(r => r.json()).then(d => setBlocks(d.blocks ?? []))

    // Check QB connection status via Supabase
    const supabase = createClient()
    supabase
      .from('quickbooks_tokens')
      .select('realm_id')
      .limit(1)
      .single()
      .then(({ data }) => {
        setQbConnected(!!data)
        setQbRealmId(data?.realm_id ?? null)
        setLoading(false)
      })
  }, [searchParams])

  async function disconnectQuickBooks() {
    const supabase = createClient()
    await supabase.from('quickbooks_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000') // delete all
    setQbConnected(false)
    setQbRealmId(null)
    toast.success('QuickBooks disconnected')
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46' } }} />

      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-fg">Settings</h1>
          <p className="text-muted text-sm mt-0.5">App configuration and integrations</p>
        </div>

        {/* App info */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-fg">App Info</h2>
          <dl className="space-y-2 text-sm">
            {[
              { label: 'Shop Name', value: appName },
              { label: 'App URL', value: appUrl },
              { label: 'Phone', value: shopPhone || '—' },
            ].map((row) => (
              <div key={row.label} className="flex justify-between">
                <dt className="text-muted">{row.label}</dt>
                <dd className="text-fg font-mono text-xs">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted border-t border-border pt-3">
            To change these values, edit your <code className="bg-surface-2 px-1 rounded">.env.local</code> file and restart the dev server.
          </p>
        </div>

        {/* QuickBooks */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-fg">QuickBooks Online</h2>
              <p className="text-xs text-muted mt-0.5">Automatically create invoices when jobs are marked as paid</p>
            </div>
            {!loading && (
              <span className={`text-xs px-2 py-1 rounded-full border font-medium ${
                qbConnected
                  ? 'bg-green-900/40 text-green-300 border-green-700'
                  : 'bg-surface-2 text-muted border-border'
              }`}>
                {qbConnected ? 'Connected' : 'Not connected'}
              </span>
            )}
          </div>

          {loading ? (
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : qbConnected ? (
            <div className="space-y-3">
              <p className="text-xs text-muted">Company ID (Realm): <span className="font-mono text-fg">{qbRealmId}</span></p>
              <button onClick={disconnectQuickBooks} className="btn-secondary text-sm text-red-400 border-red-800 hover:bg-red-900/30">
                Disconnect QuickBooks
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Connect your QuickBooks Online account to automatically push invoices when repairs are marked as paid.
              </p>
              {!process.env.NEXT_PUBLIC_SUPABASE_URL ? null : (
                <div className="text-xs text-muted bg-surface-2 rounded-lg p-3 space-y-1">
                  <p className="font-medium text-fg">Setup required:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Create an app at <a href="https://developer.intuit.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">developer.intuit.com</a></li>
                    <li>Add <code>QUICKBOOKS_CLIENT_ID</code> and <code>QUICKBOOKS_CLIENT_SECRET</code> to <code>.env.local</code></li>
                    <li>Set redirect URI to <code>{appUrl}/api/quickbooks/callback</code></li>
                  </ol>
                </div>
              )}
              <a
                href="/api/quickbooks/connect"
                className="btn-primary text-sm inline-flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Connect QuickBooks
              </a>
            </div>
          )}
        </div>

        {/* Technicians */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-fg">Technicians</h2>
              <p className="text-xs text-muted mt-0.5">Manage staff who can be assigned to support tickets</p>
            </div>
            <button onClick={() => setAddingTech(t => !t)} className="btn-secondary text-sm py-1.5 px-3">
              {addingTech ? 'Cancel' : '+ Add'}
            </button>
          </div>

          {addingTech && (
            <div className="border border-border rounded-xl p-4 space-y-3 bg-surface-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label text-xs">Name *</label>
                  <input className="input text-sm" placeholder="Full name" value={newTech.name} onChange={e => setNewTech(t => ({ ...t, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">Email</label>
                  <input type="email" className="input text-sm" placeholder="tech@example.com" value={newTech.email} onChange={e => setNewTech(t => ({ ...t, email: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">Phone</label>
                  <input type="tel" className="input text-sm" placeholder="07700 000000" value={newTech.phone} onChange={e => setNewTech(t => ({ ...t, phone: e.target.value }))} />
                </div>
              </div>
              <p className="text-xs text-muted">If an email is set, the technician will be notified when assigned to a ticket.</p>
              <button
                disabled={savingTech || !newTech.name.trim()}
                onClick={async () => {
                  setSavingTech(true)
                  const res = await fetch('/api/technicians', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTech) })
                  const data = await res.json()
                  setSavingTech(false)
                  if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
                  setTechnicians(t => [...t, data.technician])
                  setNewTech({ name: '', email: '', phone: '' })
                  setAddingTech(false)
                  toast.success('Technician added')
                }}
                className="btn-primary text-sm"
              >
                {savingTech ? 'Saving…' : 'Add Technician'}
              </button>
            </div>
          )}

          {technicians.length === 0 ? (
            <p className="text-sm text-muted">No technicians yet. Add one to enable ticket assignment.</p>
          ) : (
            <div className="space-y-2">
              {technicians.map(tech => (
                <div key={tech.id} className="flex items-center justify-between gap-3 bg-surface-2 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold text-xs">{tech.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg truncate">{tech.name}</p>
                      {tech.email && <p className="text-xs text-muted truncate">{tech.email}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Active toggle */}
                    <label className="relative cursor-pointer" title={tech.active ? 'Active' : 'Inactive'}>
                      <input type="checkbox" className="sr-only peer" checked={tech.active}
                        onChange={async (e) => {
                          const res = await fetch(`/api/technicians/${tech.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: e.target.checked }) })
                          if (res.ok) setTechnicians(ts => ts.map(t => t.id === tech.id ? { ...t, active: e.target.checked } : t))
                        }} />
                      <div className="w-9 h-5 bg-surface rounded-full peer-checked:bg-primary transition-colors border border-border" />
                      <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                    </label>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete ${tech.name}?`)) return
                        const res = await fetch(`/api/technicians/${tech.id}`, { method: 'DELETE' })
                        if (res.ok) { setTechnicians(ts => ts.filter(t => t.id !== tech.id)); toast.success('Technician removed') }
                        else toast.error('Failed to delete')
                      }}
                      className="text-muted hover:text-red-400 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Follow-up Reminders */}
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-fg">Follow-up Reminders</h2>
            <p className="text-xs text-muted mt-0.5">Automatically remind customers when their device has been ready to collect for N days. This is a transactional notification — sent regardless of marketing consent.</p>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <label className="label text-xs">Send reminder after (days)</label>
              <input
                type="number"
                min="1"
                max="30"
                className="input"
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
              />
            </div>
            <button
              onClick={async () => {
                setSavingReminder(true)
                const res = await fetch('/api/settings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ key: 'ready_reminder_days', value: reminderDays }),
                })
                setSavingReminder(false)
                if (res.ok) toast.success('Reminder days saved')
                else toast.error('Failed to save')
              }}
              disabled={savingReminder}
              className="btn-secondary text-sm"
            >
              {savingReminder ? 'Saving…' : 'Save'}
            </button>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={async () => {
                const data = await followup.run()
                if (data?.sent !== undefined) toast.success(`Reminder sent to ${data.sent} customer(s)`)
                else toast.error('Failed to send reminders')
              }}
              disabled={followup.loading}
              className="btn-primary text-sm"
            >
              {followup.loading ? 'Sending…' : 'Send Reminders Now'}
            </button>
            <button
              onClick={async () => {
                const res = await fetch('/api/jobs/followup?dry_run=true', { method: 'POST' })
                const data = await res.json()
                if (data?.would_send !== undefined) toast.success(`Dry run: would send to ${data.would_send} customer(s) (after ${data.reminder_days} days)`)
              }}
              className="btn-secondary text-sm"
            >
              Dry Run
            </button>
          </div>
        </div>

        {/* Daily Digest */}
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-fg">Daily Digest Email</h2>
            <p className="text-xs text-muted mt-0.5">
              Sends to <code className="bg-surface-2 px-1 rounded">DIGEST_EMAIL</code> env var
              (falls back to <code className="bg-surface-2 px-1 rounded">RESEND_FROM</code>).
              Set <code className="bg-surface-2 px-1 rounded">DIGEST_EMAIL</code> in <code className="bg-surface-2 px-1 rounded">.env.local</code> to customise.
            </p>
          </div>
          <button
            onClick={async () => {
              const data = await digest.run()
              if (data?.sent) toast.success('Daily digest sent!')
              else toast.error('Failed to send digest')
            }}
            disabled={digest.loading}
            className="btn-primary text-sm"
          >
            {digest.loading ? 'Sending…' : 'Send Digest Now'}
          </button>
        </div>

        {/* Portal info */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-fg">Customer Portal</h2>
          <p className="text-sm text-muted">
            Customers can log in at <a href="/portal" className="text-primary hover:underline">{appUrl}/portal</a> using a magic link sent to their email.
          </p>
          <p className="text-sm text-muted">
            Public job tracker: <a href="/track" className="text-primary hover:underline">{appUrl}/track/[ticket]</a> — share after setting a job to Ready.
          </p>
        </div>

        {/* Quote Rules */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-fg">Quote Rules</h2>
              <p className="text-xs text-muted mt-0.5">Auto-match incoming quote requests to a price based on keywords</p>
            </div>
            <button onClick={() => setAddingRule(r => !r)} className="btn-secondary text-sm py-1.5 px-3">
              {addingRule ? 'Cancel' : '+ Add Rule'}
            </button>
          </div>

          {addingRule && (
            <div className="border border-border rounded-xl p-4 space-y-3 bg-surface-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Rule name *</label>
                  <input className="input text-sm" placeholder="e.g. Screen Repair" value={newRule.name} onChange={e => setNewRule(r => ({ ...r, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">Device type</label>
                  <select className="input text-sm" value={newRule.device_type} onChange={e => setNewRule(r => ({ ...r, device_type: e.target.value }))}>
                    <option value="">Any device</option>
                    <option value="phone">Phone</option>
                    <option value="tablet">Tablet</option>
                    <option value="computer">Computer / Laptop</option>
                    <option value="console">Games Console</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label text-xs">Keywords (comma separated) *</label>
                <input className="input text-sm" placeholder="screen, cracked, display, smashed" value={newRule.keywords} onChange={e => setNewRule(r => ({ ...r, keywords: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Price (£) *</label>
                  <input type="number" className="input text-sm" placeholder="60.00" value={newRule.min_price} onChange={e => setNewRule(r => ({ ...r, min_price: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">Notes</label>
                  <input className="input text-sm" placeholder="e.g. parts included" value={newRule.notes} onChange={e => setNewRule(r => ({ ...r, notes: e.target.value }))} />
                </div>
              </div>
              <button
                disabled={savingRule || !newRule.name || !newRule.min_price || !newRule.keywords}
                onClick={async () => {
                  setSavingRule(true)
                  const res = await fetch('/api/quote-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newRule, min_price: parseFloat(newRule.min_price), sort_order: rules.length }) })
                  const data = await res.json()
                  setSavingRule(false)
                  if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
                  setRules(r => [...r, data.rule])
                  setNewRule({ name: '', device_type: '', keywords: '', min_price: '', max_price: '', notes: '' })
                  setAddingRule(false)
                  toast.success('Rule added')
                }}
                className="btn-primary text-sm"
              >
                {savingRule ? 'Saving…' : 'Save Rule'}
              </button>
            </div>
          )}

          {rules.length === 0 ? (
            <p className="text-sm text-muted">No rules yet. Add one to enable auto-quoting.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left pb-2 text-muted font-medium">Name</th>
                  <th className="text-left pb-2 text-muted font-medium hidden sm:table-cell">Device</th>
                  <th className="text-left pb-2 text-muted font-medium hidden md:table-cell">Keywords</th>
                  <th className="text-left pb-2 text-muted font-medium">Price</th>
                  <th className="w-8" />
                </tr></thead>
                <tbody>
                  {rules.map(rule => (
                    <tr key={rule.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 text-fg font-medium">{rule.name}</td>
                      <td className="py-2 pr-3 text-muted capitalize hidden sm:table-cell">{rule.device_type || 'Any'}</td>
                      <td className="py-2 pr-3 text-muted hidden md:table-cell max-w-xs truncate">{rule.keywords}</td>
                      <td className="py-2 pr-3 text-fg whitespace-nowrap">£{Number(rule.min_price).toFixed(2)}</td>
                      <td className="py-2">
                        <button onClick={async () => {
                          await fetch(`/api/quote-rules/${rule.id}`, { method: 'DELETE' })
                          setRules(r => r.filter(x => x.id !== rule.id))
                          toast.success('Rule deleted')
                        }} className="text-muted hover:text-red-400 transition-colors">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Availability */}
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-fg">Working Hours</h2>
            <p className="text-xs text-muted mt-0.5">Set when customers can book appointments from your quotes</p>
          </div>
          {availability.length > 0 && (
            <>
              <div className="space-y-2">
                {availability.map((day, i) => (
                  <div key={i} className="grid grid-cols-[100px_40px_1fr] sm:grid-cols-[120px_40px_1fr_1fr_120px] items-center gap-3">
                    <span className={`text-sm font-medium ${day.is_active ? 'text-fg' : 'text-muted'}`}>{DAY_NAMES[day.day_of_week]}</span>
                    <label className="relative cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={day.is_active}
                        onChange={e => setAvailability(prev => prev.map((d,j) => j===i ? { ...d, is_active: e.target.checked } : d))} />
                      <div className="w-9 h-5 bg-surface-2 rounded-full peer-checked:bg-primary transition-colors border border-border" />
                      <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                    </label>
                    {day.is_active ? (
                      <>
                        <input type="time" className="input text-sm py-1" value={day.start_time.substring(0,5)}
                          onChange={e => setAvailability(prev => prev.map((d,j) => j===i ? { ...d, start_time: e.target.value } : d))} />
                        <input type="time" className="input text-sm py-1" value={day.end_time.substring(0,5)}
                          onChange={e => setAvailability(prev => prev.map((d,j) => j===i ? { ...d, end_time: e.target.value } : d))} />
                        <div className="hidden sm:flex items-center gap-2">
                          <input type="number" min="15" max="240" step="15" className="input text-sm py-1 w-20" value={day.slot_duration_mins}
                            onChange={e => setAvailability(prev => prev.map((d,j) => j===i ? { ...d, slot_duration_mins: parseInt(e.target.value)||60 } : d))} />
                          <span className="text-xs text-muted whitespace-nowrap">min slots</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-muted col-span-3 sm:col-span-3">Closed</span>
                    )}
                  </div>
                ))}
              </div>
              <button disabled={savingAvail} onClick={async () => {
                setSavingAvail(true)
                const res = await fetch('/api/availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slots: availability }) })
                setSavingAvail(false)
                if (res.ok) toast.success('Hours saved')
                else toast.error('Failed to save')
              }} className="btn-primary text-sm">
                {savingAvail ? 'Saving…' : 'Save Hours'}
              </button>
            </>
          )}

          <div className="pt-2 border-t border-border">
            <h3 className="font-medium text-sm text-fg mb-3">Blocked Dates</h3>
            <div className="flex gap-2 mb-3">
              <input type="date" className="input text-sm py-1.5 flex-1" value={newBlock.block_date}
                onChange={e => setNewBlock(b => ({ ...b, block_date: e.target.value }))} />
              <input type="text" className="input text-sm py-1.5 flex-1" placeholder="Reason (optional)"
                value={newBlock.reason} onChange={e => setNewBlock(b => ({ ...b, reason: e.target.value }))} />
              <button onClick={async () => {
                if (!newBlock.block_date) return
                const res = await fetch('/api/availability/blocks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newBlock) })
                const data = await res.json()
                if (res.ok) { setBlocks(b => [...b, data.block]); setNewBlock({ block_date: '', reason: '' }); toast.success('Date blocked') }
                else toast.error('Failed')
              }} className="btn-secondary text-sm py-1.5 px-3 whitespace-nowrap">Block</button>
            </div>
            {blocks.length === 0 ? (
              <p className="text-xs text-muted">No blocked dates</p>
            ) : (
              <div className="space-y-1">
                {blocks.map(b => (
                  <div key={b.id} className="flex items-center justify-between text-sm bg-surface-2 rounded-lg px-3 py-2">
                    <span className="text-fg">{new Date(b.block_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {b.reason && <span className="text-muted text-xs">{b.reason}</span>}
                    <button onClick={async () => {
                      await fetch(`/api/availability/blocks/${b.id}`, { method: 'DELETE' })
                      setBlocks(prev => prev.filter(x => x.id !== b.id))
                      toast.success('Block removed')
                    }} className="text-muted hover:text-red-400 transition-colors ml-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Staff Accounts & Roles */}
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-fg">Staff Accounts &amp; Roles</h2>
            <p className="text-xs text-muted mt-0.5">
              Set each staff member&apos;s role. <strong>Managers</strong> have full access. <strong>Technicians</strong> can update job status and add notes but cannot delete records, access reports, or change settings.
            </p>
          </div>

          {loadingStaff ? (
            <div className="flex items-center gap-2 text-muted text-sm">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading staff accounts…
            </div>
          ) : staffUsers.length === 0 ? (
            <p className="text-muted text-sm">No staff accounts found. Staff accounts are created in your Supabase Auth dashboard.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-muted font-medium py-2 pr-4">Email</th>
                    <th className="text-left text-muted font-medium py-2 pr-4">Last sign in</th>
                    <th className="text-left text-muted font-medium py-2">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {staffUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 pr-4 text-fg">{u.email}</td>
                      <td className="py-2.5 pr-4 text-muted text-xs">
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('en-GB') : 'Never'}
                      </td>
                      <td className="py-2.5">
                        <select
                          value={u.role}
                          disabled={updatingRole === u.id}
                          onChange={async (e) => {
                            setUpdatingRole(u.id)
                            const res = await fetch(`/api/staff/${u.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ role: e.target.value }),
                            })
                            const data = await res.json()
                            if (res.ok) {
                              setStaffUsers(prev => prev.map(s => s.id === u.id ? { ...s, role: e.target.value } : s))
                              toast.success(`Role updated to ${e.target.value}`)
                            } else {
                              toast.error(data.error ?? 'Failed to update role')
                            }
                            setUpdatingRole(null)
                          }}
                          className="input text-sm py-1 w-32"
                        >
                          <option value="manager">Manager</option>
                          <option value="technician">Technician</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted border-t border-border pt-2">
            Role changes take effect on the staff member&apos;s next page load. All role changes are recorded in the audit log.
          </p>
        </div>

        {/* GDPR & Compliance */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-fg">GDPR &amp; UK Compliance</h2>
          <div className="space-y-2 text-sm text-muted">
            <div className="flex items-center justify-between py-1.5 border-b border-border">
              <span>Privacy notice (public)</span>
              <a href="/privacy" target="_blank" className="text-primary hover:underline text-xs">View →</a>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border">
              <span>Data retention</span>
              <span className="text-fg text-xs">{7} years (configurable in app_settings)</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border">
              <span>Marketing consent</span>
              <span className="text-fg text-xs">Recorded per customer at intake</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border">
              <span>Audit log</span>
              <a href="/audit" className="text-primary hover:underline text-xs">View →</a>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span>Data retention cron</span>
              <span className="text-xs text-muted">POST /api/cron/retention (requires CRON_SECRET)</span>
            </div>
          </div>
        </div>

        {/* Deployment info */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-fg">Deployment</h2>
          <p className="text-sm text-muted">
            See <code className="bg-surface-2 px-1 rounded text-xs">DEPLOY.md</code> in the project root for Raspberry Pi setup instructions (PM2 + nginx).
          </p>
          <p className="text-xs text-muted">
            For iPad access, connect to the same Wi-Fi network and open <code className="bg-surface-2 px-1 rounded">http://[pi-ip]:3000/pos</code>.
            Tap <em>Share → Add to Home Screen</em> for a native app feel.
          </p>
        </div>
      </div>
    </>
  )
}
