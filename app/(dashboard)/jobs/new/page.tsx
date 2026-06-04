'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PhotoUpload from '@/components/photo-upload'
import toast, { Toaster } from 'react-hot-toast'
import { DEVICE_TYPE_LABELS, type DeviceType } from '@/types'
import type { Customer } from '@/types'

const DEVICE_TYPES = Object.entries(DEVICE_TYPE_LABELS) as [DeviceType, string][]

interface ChecklistItem { label: string; checked: boolean }
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
}

export default function NewJobPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)

  // Customer state
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [isNewCustomer, setIsNewCustomer] = useState(false)

  // Device state
  const [deviceType, setDeviceType] = useState<DeviceType>('phone')
  const [deviceMake, setDeviceMake] = useState('')
  const [deviceModel, setDeviceModel] = useState('')
  const [imei, setImei] = useState('')
  const [reportedFault, setReportedFault] = useState('')
  const [password, setPassword] = useState('')
  const [backupRequired, setBackupRequired] = useState(false)
  const [technicianName, setTechnicianName] = useState('')
  const [quotedPrice, setQuotedPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [warrantyDays, setWarrantyDays] = useState('90')

  // Template state
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [warrantyWarning, setWarrantyWarning] = useState<string | null>(null)

  // Intake details
  const [intakeMethod, setIntakeMethod] = useState<'drop_off' | 'collection'>('drop_off')
  const [intakeDate, setIntakeDate] = useState(() => new Date().toISOString().split('T')[0])
  const [alternateContact, setAlternateContact] = useState('')

  // Communications consent
  const [marketingConsent, setMarketingConsent] = useState(false)

  // Photos
  const [intakePhotoUrl, setIntakePhotoUrl] = useState<string | null>(null)
  const [damagePhotoUrl, setDamagePhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/templates').then((r) => r.json()).then((d) => setTemplates(d.templates ?? []))
  }, [])

  function applyTemplate(id: string) {
    const t = templates.find((t) => t.id === id)
    if (!t) return
    setSelectedTemplate(id)
    if (t.device_type) setDeviceType(t.device_type as DeviceType)
    if (t.device_make) setDeviceMake(t.device_make)
    if (t.device_model) setDeviceModel(t.device_model)
    if (t.reported_fault) setReportedFault(t.reported_fault)
    if (t.quoted_price != null) setQuotedPrice(t.quoted_price.toString())
    if (t.warranty_days) setWarrantyDays(t.warranty_days.toString())
    toast.success(`Template "${t.name}" loaded`)
  }

  async function searchCustomers(q: string) {
    if (q.length < 2) { setCustomerResults([]); return }
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setCustomerResults(data.customers ?? [])
  }

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c)
    setCustomerSearch(c.name)
    setCustomerResults([])
    setIsNewCustomer(false)
  }

  async function handleSubmit() {
    setLoading(true)
    try {
      // Create or use customer
      let customerId: string | null = selectedCustomer?.id ?? null

      if (isNewCustomer && newCustomerName.trim()) {
        const res = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newCustomerName.trim(),
            phone: newCustomerPhone.trim() || null,
            email: newCustomerEmail.trim() || null,
            marketing_consent: marketingConsent,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to create customer')
        customerId = data.customer.id
      }

      // Create job
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          device_type: deviceType,
          device_make: deviceMake.trim(),
          device_model: deviceModel.trim(),
          imei: imei.trim() || null,
          reported_fault: reportedFault.trim(),
          password: password.trim() || null,
          backup_required: backupRequired,
          technician_name: technicianName.trim() || null,
          quoted_price: quotedPrice ? parseFloat(quotedPrice) : null,
          notes: notes.trim() || null,
          photo_urls: [intakePhotoUrl, damagePhotoUrl].filter(Boolean),
          warranty_days: parseInt(warrantyDays) || 90,
          intake_method: intakeMethod,
          intake_date: intakeDate || null,
          alternate_contact: alternateContact.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create job')

      if (data.warranty_warning) setWarrantyWarning(data.warranty_warning)

      toast.success(`Ticket ${data.job.ticket_number} created!`)
      router.push(`/jobs/${data.job.id}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error creating job'
      toast.error(msg)
      setLoading(false)
    }
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46' } }} />

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-muted hover:text-fg transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-fg">New Repair Ticket</h1>
            <p className="text-muted text-sm">Fill in the details below to create a ticket</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                s < step ? 'bg-success text-black' : s === step ? 'bg-primary text-white' : 'bg-surface-2 text-muted'
              }`}>
                {s < step ? '✓' : s}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${s === step ? 'text-fg' : 'text-muted'}`}>
                {s === 1 ? 'Customer' : s === 2 ? 'Device' : 'Photos & Notes'}
              </span>
              {s < 3 && <div className="flex-1 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1: Customer */}
        {step === 1 && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-fg">Customer Details</h2>

            {!isNewCustomer ? (
              <div className="relative">
                <label className="label">Search existing customer</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Name, phone, or email…"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value)
                    setSelectedCustomer(null)
                    searchCustomers(e.target.value)
                  }}
                />
                {customerResults.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl overflow-hidden">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-4 py-3 hover:bg-surface-2 transition-colors border-b border-border last:border-0"
                      >
                        <div className="font-medium text-fg text-sm">{c.name}</div>
                        <div className="text-xs text-muted">{c.phone ?? ''} {c.email ?? ''}</div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedCustomer && (
                  <div className="mt-2 p-3 bg-green-900/20 border border-green-900/40 rounded-lg">
                    <p className="text-sm text-green-400 font-medium">{selectedCustomer.name}</p>
                    <p className="text-xs text-muted">{selectedCustomer.phone} • {selectedCustomer.email}</p>
                  </div>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <hr className="flex-1 border-border" />
                  <span className="text-xs text-muted">or</span>
                  <hr className="flex-1 border-border" />
                </div>
                <button
                  type="button"
                  onClick={() => { setIsNewCustomer(true); setSelectedCustomer(null); setCustomerSearch('') }}
                  className="w-full mt-3 btn-secondary text-sm"
                >
                  + Add new customer
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="label">Customer name *</label>
                  <input type="text" className="input" placeholder="Full name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Phone</label>
                    <input type="tel" className="input" placeholder="07700 000000" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input" placeholder="name@email.com" value={newCustomerEmail} onChange={(e) => setNewCustomerEmail(e.target.value)} />
                  </div>
                </div>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-border accent-primary shrink-0"
                  />
                  <span className="text-sm text-muted leading-snug">
                    Customer consents to receive repair follow-ups and promotional messages by email and SMS
                  </span>
                </label>
                <button type="button" onClick={() => setIsNewCustomer(false)} className="text-sm text-muted hover:text-fg">
                  ← Search existing customers instead
                </button>
              </div>
            )}

            {/* Intake method */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div>
                <label className="label">How was the device received? *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['drop_off', 'collection'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setIntakeMethod(method)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                        intakeMethod === method
                          ? 'border-primary bg-primary-muted text-primary'
                          : 'border-border bg-surface-2 text-muted hover:text-fg'
                      }`}
                    >
                      {method === 'drop_off' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="M16.5 9.4 7.55 4.24"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/><circle cx="18.5" cy="15.5" r="2.5"/><path d="M20.27 17.27 22 19"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="1"/><path d="M9 15h14"/></svg>
                      )}
                      {method === 'drop_off' ? 'Customer Drop-off' : 'We Collected'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">{intakeMethod === 'drop_off' ? 'Drop-off date' : 'Collection date'}</label>
                <input
                  type="date"
                  className="input"
                  value={intakeDate}
                  onChange={(e) => setIntakeDate(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Alternate contact method</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. WhatsApp: 07700 000000, or email@example.com"
                  value={alternateContact}
                  onChange={(e) => setAlternateContact(e.target.value)}
                />
                <p className="text-xs text-muted mt-1">In addition to their phone number on file</p>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={isNewCustomer && !newCustomerName.trim()}
                className="btn-primary flex-1"
              >
                Continue →
              </button>
            </div>
            <p className="text-xs text-muted text-center">Customer is optional for walk-in jobs</p>
            <button type="button" onClick={() => setStep(2)} className="text-xs text-muted hover:text-fg w-full text-center">
              Skip — walk-in customer
            </button>
          </div>
        )}

        {/* Step 2: Device */}
        {step === 2 && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-fg">Device Details</h2>

            {/* Template loader */}
            {templates.length > 0 && (
              <div className="p-3 bg-surface-2 rounded-lg space-y-2">
                <label className="label text-xs">Load from template (optional)</label>
                <select
                  className="input text-sm"
                  value={selectedTemplate}
                  onChange={(e) => applyTemplate(e.target.value)}
                >
                  <option value="">Select a template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {selectedTemplate && (
                  <p className="text-xs text-muted">Template applied — you can still edit all fields below.</p>
                )}
              </div>
            )}

            {warrantyWarning && (
              <div className="p-3 bg-yellow-900/20 border border-yellow-700/40 rounded-lg flex gap-2">
                <span className="text-yellow-400 flex-shrink-0">⚠️</span>
                <p className="text-sm text-yellow-300">{warrantyWarning}</p>
              </div>
            )}

            <div>
              <label className="label">Device type *</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {DEVICE_TYPES.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDeviceType(value)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      deviceType === value
                        ? 'border-primary bg-primary-muted text-primary'
                        : 'border-border bg-surface-2 text-muted hover:text-fg'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Make / Brand *</label>
                <input type="text" className="input" placeholder="e.g. Apple, Samsung" value={deviceMake} onChange={(e) => setDeviceMake(e.target.value)} />
              </div>
              <div>
                <label className="label">Model *</label>
                <input type="text" className="input" placeholder="e.g. iPhone 15 Pro" value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} />
              </div>
            </div>

            {(deviceType === 'phone' || deviceType === 'tablet') && (
              <div>
                <label className="label">IMEI number</label>
                <input type="text" className="input font-mono" placeholder="15-digit IMEI" maxLength={15} value={imei} onChange={(e) => setImei(e.target.value.replace(/\D/g, ''))} />
                <p className="text-xs text-muted mt-1">Dial *#06# on the device to find the IMEI</p>
              </div>
            )}

            <div>
              <label className="label">Reported fault *</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Describe the problem the customer has reported…"
                value={reportedFault}
                onChange={(e) => setReportedFault(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Device password / PIN</label>
                <input type="text" className="input font-mono" placeholder="If needed for repair" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <label className="label">Quoted price (£)</label>
                <input type="number" className="input" placeholder="0.00" min="0" step="0.01" value={quotedPrice} onChange={(e) => setQuotedPrice(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg">
              <input
                id="backup"
                type="checkbox"
                checked={backupRequired}
                onChange={(e) => setBackupRequired(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <label htmlFor="backup" className="text-sm text-fg cursor-pointer">
                Customer has been advised to back up data
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Assign technician</label>
                <input type="text" className="input" placeholder="Technician name" value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} />
              </div>
              <div>
                <label className="label">Warranty (days)</label>
                <input type="number" className="input" placeholder="90" min="0" value={warrantyDays} onChange={(e) => setWarrantyDays(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!deviceMake.trim() || !deviceModel.trim() || !reportedFault.trim()}
                className="btn-primary flex-1"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Photos & Notes */}
        {step === 3 && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-fg">Photos & Notes</h2>

            <div className="grid grid-cols-2 gap-4">
              <PhotoUpload
                label="Device intake photo"
                photoType="intake"
                onUploaded={setIntakePhotoUrl}
              />
              <PhotoUpload
                label="Pre-existing damage"
                photoType="damage"
                onUploaded={setDamagePhotoUrl}
              />
            </div>

            <div>
              <label className="label">Additional notes (visible to customer)</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Any other info for the customer…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Summary */}
            <div className="p-4 bg-surface-2 rounded-xl space-y-2 text-sm">
              <h3 className="font-semibold text-fg mb-3">Confirm ticket details</h3>
              {(selectedCustomer || (isNewCustomer && newCustomerName)) && (
                <div className="flex justify-between">
                  <span className="text-muted">Customer</span>
                  <span className="text-fg font-medium">{selectedCustomer?.name ?? newCustomerName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">Received via</span>
                <span className="text-fg font-medium">{intakeMethod === 'drop_off' ? 'Customer Drop-off' : 'We Collected'}</span>
              </div>
              {intakeDate && (
                <div className="flex justify-between">
                  <span className="text-muted">{intakeMethod === 'drop_off' ? 'Drop-off date' : 'Collection date'}</span>
                  <span className="text-fg">{new Date(intakeDate + 'T00:00:00').toLocaleDateString('en-GB')}</span>
                </div>
              )}
              {alternateContact && (
                <div className="flex justify-between">
                  <span className="text-muted">Alt. contact</span>
                  <span className="text-fg text-right max-w-[60%]">{alternateContact}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">Device</span>
                <span className="text-fg font-medium">{deviceMake} {deviceModel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Type</span>
                <span className="text-fg">{DEVICE_TYPE_LABELS[deviceType]}</span>
              </div>
              {imei && (
                <div className="flex justify-between">
                  <span className="text-muted">IMEI</span>
                  <span className="text-fg font-mono text-xs">{imei}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">Fault</span>
                <span className="text-fg text-right max-w-[60%]">{reportedFault}</span>
              </div>
              {quotedPrice && (
                <div className="flex justify-between">
                  <span className="text-muted">Quote</span>
                  <span className="text-fg font-medium">£{parseFloat(quotedPrice).toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setStep(2)} className="btn-secondary flex-1">← Back</button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="btn-primary flex-1"
              >
                {loading ? 'Creating ticket…' : 'Create Ticket'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
