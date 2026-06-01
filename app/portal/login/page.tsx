'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PortalLoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/portal`

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    if (authError) {
      setError(authError.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </div>
          <span className="text-xl font-bold text-fg">{shopName}</span>
        </div>

        <div className="card">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-fg mb-2">Check your email</h2>
              <p className="text-sm text-muted">We sent a login link to <span className="text-fg">{email}</span>. Click it to access your repairs.</p>
              <button onClick={() => setSent(false)} className="text-sm text-primary hover:underline mt-4 block mx-auto">
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-fg mb-1">Customer Portal</h2>
              <p className="text-sm text-muted mb-6">Enter your email to view your repair history.</p>

              <form onSubmit={sendMagicLink} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button type="submit" disabled={loading || !email} className="btn-primary w-full">
                  {loading ? 'Sending…' : 'Send login link'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted mt-6">
          Staff login? <a href="/login" className="text-primary hover:underline">Sign in here</a>
        </p>
      </div>
    </div>
  )
}
