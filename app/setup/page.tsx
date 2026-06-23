'use client'

import { useState, useEffect } from 'react'

type Step = 'shop' | 'env' | 'database' | 'test' | 'done'

interface HealthCheck {
  status: string
  checks: Record<string, { ok: boolean; detail?: string }>
}

const STEPS: { key: Step; label: string }[] = [
  { key: 'shop',     label: 'Shop'     },
  { key: 'env',      label: 'Config'   },
  { key: 'database', label: 'Database' },
  { key: 'test',     label: 'Test'     },
  { key: 'done',     label: 'Done'     },
]

const SQL_MIGRATIONS = [
  { file: 'schema.sql',                          label: 'Core schema (jobs, customers, inventory…)', required: true  },
  { file: 'support-schema.sql',                  label: 'Support tickets',                           required: true  },
  { file: 'additions.sql',                       label: 'Additions (warranty, checklist…)',          required: true  },
  { file: 'ticket-email-schema.sql',             label: 'Email / ticket settings',                  required: true  },
  { file: 'technicians-sla-schema.sql',          label: 'Technicians & SLA',                         required: false },
  { file: 'phone-check-schema.sql',              label: 'Phone check / IMEI',                       required: false },
  { file: 'hardware-info-migration.sql',         label: 'Hardware info fields',                     required: false },
  { file: 'job-approval-migration.sql',          label: 'Job approval flow',                        required: false },
  { file: 'intake-fields-migration.sql',         label: 'Intake / custody fields',                  required: false },
  { file: 'custody-notes-migration.sql',         label: 'Chain of custody & job notes',             required: false },
  { file: 'feature-batch-migration.sql',         label: 'POS, audit log, app settings',             required: false },
  { file: 'timelog-and-repair-summary.sql',      label: 'Time tracking & repair summary',           required: false },
  { file: 'performance-indexes.sql',             label: 'Performance indexes',                      required: false },
  { file: 'business-tasks-migration.sql',        label: 'Business board / kanban',                  required: false },
  { file: 'quotes-delete-policy.sql',            label: 'Quote RLS policies',                       required: false },
  { file: 'fix-appointments-quote-fk.sql',       label: 'Fix appointments FK',                      required: false },
]

const ENV_VARS = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL',      label: 'Supabase URL',          description: 'Your Supabase project URL',                         example: 'https://xxxx.supabase.co',        required: true,  link: 'https://supabase.com/dashboard/project/_/settings/api' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Supabase Anon Key',     description: 'Public anon key from Supabase',                    example: 'eyJhbGci…',                       required: true,  link: 'https://supabase.com/dashboard/project/_/settings/api' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY',     label: 'Supabase Service Key',  description: 'Secret service role key — keep private',           example: 'eyJhbGci…',                       required: true,  link: 'https://supabase.com/dashboard/project/_/settings/api' },
  { key: 'RESEND_API_KEY',                label: 'Resend API Key',         description: 'From your Resend dashboard',                       example: 're_xxxx',                         required: true,  link: 'https://resend.com/api-keys' },
  { key: 'RESEND_FROM_EMAIL',             label: 'From Email',            description: 'Must be on a verified Resend domain',              example: 'repairs@yourshop.co.uk',          required: true  },
  { key: 'RESEND_FROM_NAME',              label: 'From Name',             description: 'Displayed sender name in emails',                  example: 'Cardiff Repairs',                 required: true  },
  { key: 'NEXT_PUBLIC_APP_NAME',          label: 'Shop Name',             description: 'Your shop name — shown everywhere in the app',     example: 'Cardiff Repairs',                 required: true  },
  { key: 'NEXT_PUBLIC_APP_URL',           label: 'App URL',               description: 'Your full Netlify/deployment URL',                 example: 'https://myshop.netlify.app',      required: true  },
  { key: 'OWNER_EMAIL',                   label: 'Owner Email',           description: 'Where new booking / enquiry alerts are sent',      example: 'you@yourshop.co.uk',              required: true  },
  { key: 'NEXT_PUBLIC_SHOP_PHONE',        label: 'Shop Phone',            description: 'Displayed on customer-facing pages',               example: '02920 123456',                    required: false },
  { key: 'STRIPE_SECRET_KEY',             label: 'Stripe Secret Key',     description: 'For quote payment links (optional)',                example: 'sk_live_…',                       required: false, link: 'https://dashboard.stripe.com/apikeys' },
  { key: 'STRIPE_WEBHOOK_SECRET',         label: 'Stripe Webhook Secret', description: 'Register webhook: yoururl/api/stripe/webhook',     example: 'whsec_…',                         required: false },
]

// ─── Small helpers ────────────────────────────────────────────────────────────

function CheckIcon({ ok }: { ok?: boolean }) {
  if (ok === undefined) return <div className="w-5 h-5 rounded-full border-2 border-zinc-600 flex-shrink-0" />
  return ok
    ? <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
    : <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></div>
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors flex-shrink-0"
    >
      {copied ? '✓' : 'Copy'}
    </button>
  )
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function StepShop({ onNext }: { onNext: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Welcome to Repair Shop</h2>
        <p className="text-zinc-400 text-sm">Let's get your repair shop management system set up. This wizard will walk you through everything — should take about 10 minutes.</p>
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1.5">What's your shop called? *</label>
        <input
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-red-600"
          placeholder="e.g. Cardiff Phone Repairs"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onNext(name.trim())}
          autoFocus
        />
      </div>
      <button
        onClick={() => name.trim() && onNext(name.trim())}
        disabled={!name.trim()}
        className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
      >
        Let's go →
      </button>
    </div>
  )
}

function StepEnv({ shopName, onNext }: { shopName: string; onNext: () => void }) {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-shop.netlify.app'
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Configure environment variables</h2>
        <p className="text-zinc-400 text-sm">In <strong className="text-white">Netlify → Site configuration → Environment variables</strong>, add each of these. Then trigger a redeploy before continuing.</p>
      </div>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {ENV_VARS.map(v => (
          <div key={v.key} className="bg-zinc-800 rounded-lg p-3">
            <div className="flex items-start gap-2 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-red-400 text-xs font-bold">{v.key}</code>
                  {v.required
                    ? <span className="text-[10px] text-red-400 border border-red-800 px-1 rounded">required</span>
                    : <span className="text-[10px] text-zinc-500 border border-zinc-700 px-1 rounded">optional</span>}
                  {v.link && <a href={v.link} target="_blank" rel="noopener" className="text-[10px] text-zinc-400 hover:text-white underline">Get it ↗</a>}
                </div>
                <p className="text-zinc-400 text-xs mt-0.5">{v.description}</p>
              </div>
              <CopyButton text={
                v.key === 'NEXT_PUBLIC_APP_NAME' ? shopName :
                v.key === 'NEXT_PUBLIC_APP_URL' ? appUrl :
                v.key === 'RESEND_FROM_NAME' ? shopName :
                v.example
              } />
            </div>
            <code className="text-zinc-300 text-[11px] mt-1.5 block truncate">
              {v.key === 'NEXT_PUBLIC_APP_NAME' ? shopName :
               v.key === 'NEXT_PUBLIC_APP_URL' ? appUrl :
               v.key === 'RESEND_FROM_NAME' ? shopName :
               v.example}
            </code>
          </div>
        ))}
      </div>

      <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-3 text-sm text-yellow-200">
        After adding env vars, go to <strong>Deploys → Trigger deploy → Deploy site</strong> then return here.
      </div>

      <button onClick={onNext} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-colors">
        Done — I've redeployed →
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
        <p className="text-zinc-400 text-sm">Open <strong className="text-white">Supabase → SQL Editor</strong>, open each file from the <code className="text-zinc-300 text-xs">supabase/</code> folder in your repo, paste and run. Tick as you go.</p>
      </div>

      <div className="bg-zinc-800 rounded-lg p-3 text-xs text-zinc-400 space-y-1">
        <p className="text-white font-medium text-sm">How to run a migration:</p>
        <p>1. Open the file on GitHub (supabase/ folder)</p>
        <p>2. Copy all the SQL</p>
        <p>3. Supabase → SQL Editor → New query → Paste → Run</p>
      </div>

      <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1">
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Required</p>
          <div className="space-y-1.5">
            {required.map(m => (
              <label key={m.file} className="flex items-center gap-3 p-2.5 bg-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-700 transition-colors">
                <input type="checkbox" className="accent-red-600 w-4 h-4 flex-shrink-0" checked={!!checked[m.file]} onChange={e => setChecked(p => ({ ...p, [m.file]: e.target.checked }))} />
                <div>
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
                <input type="checkbox" className="accent-red-600 w-4 h-4 flex-shrink-0" checked={!!checked[m.file]} onChange={e => setChecked(p => ({ ...p, [m.file]: e.target.checked }))} />
                <div>
                  <p className="text-sm text-zinc-300">{m.label}</p>
                  <code className="text-[10px] text-zinc-500">{m.file}</code>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <button onClick={onNext} disabled={!allRequiredDone} className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors">
        {allRequiredDone ? 'Run the health check →' : 'Tick required migrations to continue'}
      </button>
    </div>
  )
}

function StepTest({ onNext }: { onNext: () => void }) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<HealthCheck | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  async function runTest() {
    setRunning(true); setFetchError(null); setResult(null)
    try {
      const res = await fetch('/api/health')
      setResult(await res.json())
    } catch {
      setFetchError('Could not reach /api/health — make sure the app redeployed after adding env vars.')
    }
    setRunning(false)
  }

  const allOk = result?.status === 'healthy'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Test your setup</h2>
        <p className="text-zinc-400 text-sm">A quick health check to make sure the database and email are connected.</p>
      </div>

      <button onClick={runTest} disabled={running} className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors">
        {running ? 'Running…' : 'Run health check'}
      </button>

      {fetchError && <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">{fetchError}</div>}

      {result && (
        <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${allOk ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className="font-semibold capitalize text-sm">{result.status}</span>
          </div>
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
      )}

      {result && !allOk && (
        <div className="bg-zinc-800 rounded-lg p-3 text-sm text-zinc-300">
          <p className="font-semibold text-white mb-1">Fix issues above, then:</p>
          <p className="text-zinc-400 text-xs">Update env vars in Netlify → trigger redeploy → run test again.</p>
        </div>
      )}

      {result && allOk && (
        <button onClick={onNext} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors">
          Everything's working — finish! →
        </button>
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
        <h2 className="text-2xl font-bold mb-2">{shopName} is ready!</h2>
        <p className="text-zinc-400">Your repair shop management system is set up and working.</p>
      </div>
      <div className="bg-zinc-800 rounded-xl p-4 text-left space-y-2">
        <p className="font-semibold text-white text-sm mb-3">Recommended next steps:</p>
        {[
          'Sign in at /login — create a user in Supabase → Authentication → Users first',
          'Go to Settings → configure your opening hours and availability slots',
          'Add service templates in Templates for quick checklist reuse',
          'Set up instant pricing rules in Quotes → Quote Rules',
          'Embed the booking widget on your website (snippet in Settings)',
          'Set up a free uptime monitor at uptimerobot.com pointing to /api/health',
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-zinc-300">
            <span className="text-red-400 font-bold flex-shrink-0 w-4">{i + 1}.</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
      <a href="/login" className="block w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-colors">
        Go to your dashboard →
      </a>
      <p className="text-zinc-500 text-xs">
        Open source — <a href="https://github.com/oddlywiredwebdesign/404fixed" target="_blank" rel="noopener" className="text-zinc-400 hover:text-white underline">GitHub</a>
      </p>
    </div>
  )
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const [step, setStep] = useState<Step>('shop')
  const [shopName, setShopName] = useState('')

  useEffect(() => {
    try {
      const s = localStorage.getItem('rsp_setup')
      if (s) { const p = JSON.parse(s); if (p.step) setStep(p.step); if (p.shopName) setShopName(p.shopName) }
    } catch { /* ignore */ }
  }, [])

  function go(s: Step, extras?: { shopName?: string }) {
    setStep(s)
    try { localStorage.setItem('rsp_setup', JSON.stringify({ step: s, shopName: extras?.shopName ?? shopName })) } catch { /* ignore */ }
  }

  const idx = STEPS.findIndex(s => s.key === step)

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 py-4 px-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        </div>
        <span className="font-bold text-white">Repair Shop</span>
        <span className="text-zinc-500 text-sm">· Setup</span>
      </header>

      {/* Step indicator */}
      <div className="border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-1 max-w-md">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-colors
                ${i < idx ? 'bg-green-500 text-white' : i === idx ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                {i < idx
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : i + 1}
              </div>
              <span className={`text-[11px] hidden sm:block ${i === idx ? 'text-white' : 'text-zinc-600'}`}>{s.label}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-1 ${i < idx ? 'bg-green-500' : 'bg-zinc-700'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          {step === 'shop'     && <StepShop onNext={n => { setShopName(n); go('env', { shopName: n }) }} />}
          {step === 'env'      && <StepEnv shopName={shopName} onNext={() => go('database')} />}
          {step === 'database' && <StepDatabase onNext={() => go('test')} />}
          {step === 'test'     && <StepTest onNext={() => go('done')} />}
          {step === 'done'     && <StepDone shopName={shopName} />}
        </div>
      </div>
    </div>
  )
}
