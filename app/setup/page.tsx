'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'license' | 'shop' | 'env' | 'database' | 'test' | 'done'

interface LicenseInfo {
  plan: string
  customer_name: string | null
  expires_at: string | null
}

interface HealthCheck {
  status: string
  checks: Record<string, { ok: boolean; detail?: string }>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LICENSE_API = 'https://app.404fixed.co.uk/api/license/validate'

const STEPS: { key: Step; label: string }[] = [
  { key: 'license',  label: 'License'   },
  { key: 'shop',     label: 'Shop'      },
  { key: 'env',      label: 'Config'    },
  { key: 'database', label: 'Database'  },
  { key: 'test',     label: 'Test'      },
  { key: 'done',     label: 'Done'      },
]

const SQL_MIGRATIONS = [
  { file: 'schema.sql',                        label: 'Core schema (jobs, customers, inventory…)',  required: true  },
  { file: 'support-schema.sql',                label: 'Support tickets',                            required: true  },
  { file: 'additions.sql',                     label: 'Additions (warranty, checklist…)',           required: true  },
  { file: 'ticket-email-schema.sql',           label: 'Email / ticket settings',                   required: true  },
  { file: 'technicians-sla-schema.sql',        label: 'Technicians & SLA',                          required: false },
  { file: 'phone-check-schema.sql',            label: 'Phone check / IMEI',                        required: false },
  { file: 'hardware-info-migration.sql',       label: 'Hardware info fields',                      required: false },
  { file: 'job-approval-migration.sql',        label: 'Job approval flow',                         required: false },
  { file: 'intake-fields-migration.sql',       label: 'Intake / custody fields',                   required: false },
  { file: 'custody-notes-migration.sql',       label: 'Chain of custody & job notes',              required: false },
  { file: 'feature-batch-migration.sql',       label: 'POS, audit log, app settings',              required: false },
  { file: 'timelog-and-repair-summary.sql',    label: 'Time tracking & repair summary',            required: false },
  { file: 'performance-indexes.sql',           label: 'Performance indexes',                       required: false },
  { file: 'business-tasks-migration.sql',      label: 'Business board / kanban',                   required: false },
  { file: 'quotes-delete-policy.sql',          label: 'Quote RLS policies',                        required: false },
  { file: 'fix-appointments-quote-fk.sql',     label: 'Fix appointments FK',                       required: false },
]

const ENV_VARS: { key: string; label: string; description: string; example: string; required: boolean; link?: string }[] = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL',    label: 'Supabase URL',           description: 'Your Supabase project URL',                    example: 'https://xxxx.supabase.co',         required: true,  link: 'https://supabase.com/dashboard/project/_/settings/api' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Supabase Anon Key',   description: 'Public anon key from Supabase',               example: 'eyJhbGci…',                        required: true,  link: 'https://supabase.com/dashboard/project/_/settings/api' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY',   label: 'Supabase Service Key',   description: 'Secret service role key — keep private',      example: 'eyJhbGci…',                        required: true,  link: 'https://supabase.com/dashboard/project/_/settings/api' },
  { key: 'RESEND_API_KEY',              label: 'Resend API Key',          description: 'From your Resend dashboard',                  example: 're_xxxx',                          required: true,  link: 'https://resend.com/api-keys' },
  { key: 'RESEND_FROM_EMAIL',           label: 'From Email',             description: 'Must be on a verified Resend domain',         example: 'repairs@yourshop.co.uk',           required: true  },
  { key: 'RESEND_FROM_NAME',            label: 'From Name',              description: 'Displayed sender name',                       example: 'Cardiff Repairs',                  required: true  },
  { key: 'NEXT_PUBLIC_APP_NAME',        label: 'Shop Name',              description: 'Your shop name — appears everywhere',         example: 'Cardiff Repairs',                  required: true  },
  { key: 'NEXT_PUBLIC_APP_URL',         label: 'App URL',                description: 'Your full Netlify URL',                       example: 'https://myshop.netlify.app',       required: true  },
  { key: 'OWNER_EMAIL',                 label: 'Owner Email',            description: 'Where new booking alerts are sent',           example: 'you@yourshop.co.uk',               required: true  },
  { key: 'NEXT_PUBLIC_SHOP_PHONE',      label: 'Shop Phone',             description: 'Displayed on customer-facing pages',          example: '02920 123456',                     required: false },
  { key: 'STRIPE_SECRET_KEY',           label: 'Stripe Secret Key',      description: 'For quote payment links (optional)',           example: 'sk_live_…',                        required: false, link: 'https://dashboard.stripe.com/apikeys' },
  { key: 'STRIPE_WEBHOOK_SECRET',       label: 'Stripe Webhook Secret',  description: 'For receiving payment confirmations',          example: 'whsec_…',                          required: false },
  { key: 'NEXT_PUBLIC_APP_URL',         label: 'Stripe Webhook URL',     description: 'Register in Stripe: yoururl/api/stripe/webhook', example: 'https://myshop.netlify.app/api/stripe/webhook', required: false },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CheckIcon({ ok }: { ok?: boolean }) {
  if (ok === undefined) return <div className="w-5 h-5 rounded-full border-2 border-zinc-600" />
  return ok
    ? <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
    : <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></div>
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// ─── Step Components ──────────────────────────────────────────────────────────

function StepLicense({ onNext }: { onNext: (key: string, info: LicenseInfo) => void }) {
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function validate() {
    if (!key.trim()) { setError('Please enter your license key'); return }
    setLoading(true)
    setError(null)
    try {
      const domain = window.location.hostname
      const res = await fetch(LICENSE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim().toUpperCase(), domain }),
      })
      const data = await res.json()
      if (!data.valid) { setError(data.error ?? 'Invalid license key'); setLoading(false); return }
      onNext(key.trim().toUpperCase(), data)
    } catch {
      setError('Could not reach the license server. Check your internet connection and try again.')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Enter your license key</h2>
        <p className="text-zinc-400 text-sm">You received this when you purchased Repair Shop. Keys look like <code className="text-zinc-300">RSP-XXXXX-XXXXX-XXXXX</code>.</p>
      </div>
      <div>
        <input
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white font-mono text-sm placeholder-zinc-600 focus:outline-none focus:border-red-600 uppercase tracking-widest"
          placeholder="RSP-XXXXX-XXXXX-XXXXX"
          value={key}
          onChange={e => setKey(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && validate()}
          autoFocus
        />
        {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}
      </div>
      <p className="text-zinc-500 text-xs">Don't have a key? Purchase one at <a href="https://404fixed.co.uk/repair-shop" target="_blank" rel="noopener" className="text-red-400 hover:underline">404fixed.co.uk/repair-shop</a></p>
      <button onClick={validate} disabled={loading} className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors">
        {loading ? 'Validating…' : 'Validate License →'}
      </button>
    </div>
  )
}

function StepShop({ onNext }: { onNext: (name: string) => void }) {
  const [name, setName] = useState('')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Tell us about your shop</h2>
        <p className="text-zinc-400 text-sm">You'll configure everything else through environment variables in the next step. Just give us your shop name to get started.</p>
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1.5">Shop Name *</label>
        <input
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-red-600"
          placeholder="e.g. Cardiff Phone Repairs"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
      </div>
      <button onClick={() => name.trim() && onNext(name.trim())} disabled={!name.trim()} className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors">
        Continue →
      </button>
    </div>
  )
}

function StepEnv({ shopName, onNext }: { shopName: string; onNext: () => void }) {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-shop.netlify.app'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Set your environment variables</h2>
        <p className="text-zinc-400 text-sm">In your <strong className="text-white">Netlify dashboard → Site configuration → Environment variables</strong>, add each of these. Then trigger a redeploy.</p>
      </div>

      <div className="space-y-2">
        {ENV_VARS.filter((v, i, arr) => arr.findIndex(x => x.key === v.key) === i).map(v => (
          <div key={v.key} className="bg-zinc-800 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-red-400 text-xs font-bold">{v.key}</code>
                  {v.required && <span className="text-[10px] text-red-400 border border-red-800 px-1 rounded">required</span>}
                  {v.link && (
                    <a href={v.link} target="_blank" rel="noopener" className="text-[10px] text-zinc-400 hover:text-white underline">Get it here ↗</a>
                  )}
                </div>
                <p className="text-zinc-400 text-xs mt-0.5">{v.description}</p>
              </div>
              <CopyButton text={v.key === 'NEXT_PUBLIC_APP_NAME' ? shopName : v.key === 'NEXT_PUBLIC_APP_URL' ? appUrl : v.example} />
            </div>
            <code className="text-zinc-300 text-[11px] mt-1 block truncate">
              {v.key === 'NEXT_PUBLIC_APP_NAME' ? shopName : v.key === 'NEXT_PUBLIC_APP_URL' ? appUrl : v.example}
            </code>
          </div>
        ))}
      </div>

      <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-3 text-sm text-yellow-200">
        <strong>Important:</strong> After adding env vars in Netlify, you must <strong>trigger a redeploy</strong> (Deploys → Trigger deploy → Deploy site) for them to take effect. Then return here to continue.
      </div>

      <button onClick={onNext} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-colors">
        I've set the env vars and redeployed →
      </button>
    </div>
  )
}

function StepDatabase({ onNext }: { onNext: () => void }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const required = SQL_MIGRATIONS.filter(m => m.required)
  const optional = SQL_MIGRATIONS.filter(m => !m.required)

  const allRequiredDone = required.every(m => checked[m.file])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Run SQL migrations</h2>
        <p className="text-zinc-400 text-sm">Open your <strong className="text-white">Supabase dashboard → SQL Editor</strong> and run each migration file from the <code className="text-zinc-300">supabase/</code> folder in your repository. Tick each one as you go.</p>
      </div>

      <div className="bg-zinc-800 rounded-lg p-3 text-sm">
        <p className="text-zinc-400 mb-2">How to run a migration:</p>
        <ol className="text-zinc-300 space-y-1 text-xs list-decimal list-inside">
          <li>Open your repository on GitHub</li>
          <li>Navigate to the <code>supabase/</code> folder and open the file</li>
          <li>Copy the entire SQL contents</li>
          <li>In Supabase: SQL Editor → New query → paste → Run</li>
        </ol>
      </div>

      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Required</p>
        <div className="space-y-1.5">
          {required.map(m => (
            <label key={m.file} className="flex items-center gap-3 p-2.5 bg-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-700 transition-colors">
              <input type="checkbox" className="accent-red-600 w-4 h-4 flex-shrink-0" checked={!!checked[m.file]} onChange={e => setChecked(prev => ({ ...prev, [m.file]: e.target.checked }))} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{m.label}</p>
                <code className="text-[10px] text-zinc-500">{m.file}</code>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Optional features</p>
        <div className="space-y-1.5">
          {optional.map(m => (
            <label key={m.file} className="flex items-center gap-3 p-2.5 bg-zinc-800/60 rounded-lg cursor-pointer hover:bg-zinc-700 transition-colors">
              <input type="checkbox" className="accent-red-600 w-4 h-4 flex-shrink-0" checked={!!checked[m.file]} onChange={e => setChecked(prev => ({ ...prev, [m.file]: e.target.checked }))} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-300">{m.label}</p>
                <code className="text-[10px] text-zinc-500">{m.file}</code>
              </div>
            </label>
          ))}
        </div>
      </div>

      <button onClick={onNext} disabled={!allRequiredDone} className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors">
        {allRequiredDone ? 'All done — test my setup →' : `Tick all required migrations to continue`}
      </button>
    </div>
  )
}

function StepTest({ onNext }: { onNext: () => void }) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<HealthCheck | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runTest() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/health')
      const data = await res.json()
      setResult(data)
    } catch {
      setError('Could not reach /api/health. Make sure the app has been redeployed after setting env vars.')
    }
    setRunning(false)
  }

  const allOk = result?.status === 'healthy'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Test your setup</h2>
        <p className="text-zinc-400 text-sm">We'll run a quick health check to make sure everything is connected properly.</p>
      </div>

      <button onClick={runTest} disabled={running} className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors">
        {running ? 'Running tests…' : 'Run health check'}
      </button>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">{error}</div>
      )}

      {result && (
        <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${allOk ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className="font-semibold capitalize">{result.status}</span>
          </div>
          <div className="space-y-2">
            {Object.entries(result.checks).map(([name, check]) => (
              <div key={name} className="flex items-start gap-2.5">
                <CheckIcon ok={check.ok} />
                <div>
                  <p className="text-sm text-white capitalize">{name.replace(/_/g, ' ')}</p>
                  {check.detail && <p className="text-xs text-zinc-400">{check.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && allOk && (
        <button onClick={onNext} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors">
          Everything looks great — finish setup →
        </button>
      )}

      {result && !allOk && (
        <div className="bg-zinc-800 rounded-lg p-3 text-sm text-zinc-300">
          <p className="font-semibold text-white mb-1">Fix the issues above, then:</p>
          <ol className="list-decimal list-inside space-y-1 text-zinc-400">
            <li>Update the relevant env vars in Netlify</li>
            <li>Trigger a redeploy</li>
            <li>Return here and run the test again</li>
          </ol>
        </div>
      )}
    </div>
  )
}

function StepDone({ shopName }: { shopName: string }) {
  return (
    <div className="space-y-6 text-center">
      <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-2">You're all set, {shopName}!</h2>
        <p className="text-zinc-400">Your repair shop management system is ready to use.</p>
      </div>

      <div className="bg-zinc-800 rounded-xl p-4 text-left space-y-3">
        <p className="font-semibold text-white text-sm">What to do next:</p>
        <ul className="space-y-2 text-sm text-zinc-300">
          {[
            'Sign in at /login with your Supabase admin email',
            'Go to Settings to configure opening hours and availability',
            'Add your service templates in Templates',
            'Set up your quote rules for instant pricing',
            'Embed the booking form on your website using the snippet in Settings',
            'Set up UptimeRobot to monitor /api/health every 5 mins',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-red-400 font-bold flex-shrink-0">{i + 1}.</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <a href="/login" className="block w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-colors">
        Go to your dashboard →
      </a>

      <p className="text-zinc-500 text-xs">Need help? Documentation and support at <a href="https://404fixed.co.uk/repair-shop" target="_blank" rel="noopener" className="text-red-400 hover:underline">404fixed.co.uk/repair-shop</a></p>
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function SetupPage() {
  const [step, setStep] = useState<Step>('license')
  const [licenseKey, setLicenseKey] = useState('')
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null)
  const [shopName, setShopName] = useState('')

  // Persist progress across page reloads
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rsp_setup')
      if (saved) {
        const { step: s, licenseKey: k, licenseInfo: li, shopName: sn } = JSON.parse(saved)
        if (s) setStep(s)
        if (k) setLicenseKey(k)
        if (li) setLicenseInfo(li)
        if (sn) setShopName(sn)
      }
    } catch { /* ignore */ }
  }, [])

  function save(updates: Partial<{ step: Step; licenseKey: string; licenseInfo: LicenseInfo; shopName: string }>) {
    try {
      const current = JSON.parse(localStorage.getItem('rsp_setup') ?? '{}')
      localStorage.setItem('rsp_setup', JSON.stringify({ ...current, ...updates }))
    } catch { /* ignore */ }
  }

  function goTo(s: Step) { setStep(s); save({ step: s }) }

  const currentIndex = STEPS.findIndex(s => s.key === step)

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Top bar */}
      <header className="border-b border-zinc-800 py-4 px-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        </div>
        <div>
          <span className="font-bold text-white">Repair Shop</span>
          <span className="text-zinc-500 text-sm ml-2">Setup Wizard</span>
        </div>
        {licenseInfo && (
          <span className="ml-auto text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full capitalize">
            {licenseInfo.plan} licence
          </span>
        )}
      </header>

      {/* Step progress */}
      <div className="border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-1 max-w-lg">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1 flex-1">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold transition-colors flex-shrink-0
                ${i < currentIndex ? 'bg-green-500 text-white' : i === currentIndex ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                {i < currentIndex
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : i + 1}
              </div>
              <span className={`text-[11px] hidden sm:block ${i === currentIndex ? 'text-white' : 'text-zinc-500'}`}>{s.label}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-1 ${i < currentIndex ? 'bg-green-500' : 'bg-zinc-700'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          {step === 'license' && (
            <StepLicense onNext={(k, info) => {
              setLicenseKey(k); setLicenseInfo(info)
              save({ licenseKey: k, licenseInfo: info })
              goTo('shop')
            }} />
          )}
          {step === 'shop' && (
            <StepShop onNext={(name) => {
              setShopName(name); save({ shopName: name }); goTo('env')
            }} />
          )}
          {step === 'env' && <StepEnv shopName={shopName} onNext={() => goTo('database')} />}
          {step === 'database' && <StepDatabase onNext={() => goTo('test')} />}
          {step === 'test' && <StepTest onNext={() => goTo('done')} />}
          {step === 'done' && <StepDone shopName={shopName} />}
        </div>
      </div>
    </div>
  )
}
