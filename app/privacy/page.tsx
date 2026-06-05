import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Notice' }

const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
const shopPhone = process.env.NEXT_PUBLIC_SHOP_PHONE ?? ''

export default function PrivacyPage() {
  const updated = '2025-01-01'

  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-fg">{shopName} — Privacy Notice</h1>
          <p className="text-muted text-sm mt-2">Last updated: {updated}</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">1. Who we are</h2>
          <p className="text-muted text-sm leading-relaxed">
            {shopName} is the data controller for the personal data we collect about you. If you have questions about how we handle your data, please contact us{shopPhone ? ` on ${shopPhone}` : ''} or at our shop premises.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">2. What data we collect and why</h2>
          <div className="space-y-3 text-sm text-muted leading-relaxed">
            <div className="p-3 bg-surface rounded-lg border border-border">
              <p className="font-medium text-fg mb-1">Contact details (name, phone, email)</p>
              <p>To create your repair ticket, contact you about your repair, and return your device. Legal basis: <strong>Contract performance</strong> (UK GDPR Art. 6(1)(b)).</p>
            </div>
            <div className="p-3 bg-surface rounded-lg border border-border">
              <p className="font-medium text-fg mb-1">Device details (make, model, IMEI, reported fault)</p>
              <p>To carry out the repair and maintain records for warranty purposes. Legal basis: <strong>Contract performance</strong> (UK GDPR Art. 6(1)(b)).</p>
            </div>
            <div className="p-3 bg-surface rounded-lg border border-border">
              <p className="font-medium text-fg mb-1">Device password / PIN</p>
              <p>Only collected when required to carry out the repair. Stored securely and deleted once the repair is complete. Legal basis: <strong>Contract performance</strong>.</p>
            </div>
            <div className="p-3 bg-surface rounded-lg border border-border">
              <p className="font-medium text-fg mb-1">Payment information</p>
              <p>Payment amounts and method recorded for financial records. Card payments are processed by Stripe — we do not store card numbers. Legal basis: <strong>Legal obligation</strong> (financial record-keeping).</p>
            </div>
            <div className="p-3 bg-surface rounded-lg border border-border">
              <p className="font-medium text-fg mb-1">Marketing communications (email/SMS)</p>
              <p>Only sent if you have given explicit consent. You can withdraw consent at any time by clicking &quot;Unsubscribe&quot; in any email or contacting us directly. Legal basis: <strong>Consent</strong> (UK GDPR Art. 6(1)(a), PECR Regulation 22).</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">3. Ready-for-collection notifications</h2>
          <p className="text-muted text-sm leading-relaxed">
            We will send you an email or SMS when your device is ready to collect. This is a transactional notification directly related to your repair service and does not require separate consent under PECR Regulation 22 (the &quot;soft opt-in&quot; rule).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">4. How long we keep your data</h2>
          <p className="text-muted text-sm leading-relaxed">
            We retain your repair records for <strong>7 years</strong> for financial and legal compliance purposes. After this period, your personal data is automatically anonymised — your name, email, and phone are removed while the repair record is retained for accounting purposes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">5. Who we share your data with</h2>
          <div className="text-sm text-muted space-y-2 leading-relaxed">
            <p>We use the following third-party processors. All are UK GDPR compliant:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Supabase</strong> — secure cloud database (EU data residency)</li>
              <li><strong>Stripe</strong> — payment processing (UK/EU)</li>
              <li><strong>Resend</strong> — transactional email delivery</li>
            </ul>
            <p>We do not sell your data to third parties.</p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">6. Your rights under UK GDPR</h2>
          <div className="text-sm text-muted space-y-2 leading-relaxed">
            <p>You have the following rights. To exercise any of them, contact us:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Right of access (Art. 15)</strong> — request a copy of all data we hold about you</li>
              <li><strong>Right to rectification (Art. 16)</strong> — ask us to correct inaccurate data</li>
              <li><strong>Right to erasure (Art. 17)</strong> — ask us to delete your personal data</li>
              <li><strong>Right to restrict processing (Art. 18)</strong> — ask us to limit how we use your data</li>
              <li><strong>Right to data portability (Art. 20)</strong> — receive your data in a machine-readable format</li>
              <li><strong>Right to object (Art. 21)</strong> — object to processing for marketing purposes</li>
              <li><strong>Right to withdraw consent</strong> — for any processing based on consent, at any time</li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">7. Complaints</h2>
          <p className="text-muted text-sm leading-relaxed">
            If you are unhappy with how we handle your data, you can complain to the <strong>Information Commissioner&apos;s Office (ICO)</strong> at{' '}
            <a href="https://ico.org.uk" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">ico.org.uk</a>{' '}
            or by calling 0303 123 1113.
          </p>
        </section>

        <div className="border-t border-border pt-6 text-xs text-muted">
          <p>This privacy notice was last reviewed on {updated} and applies to data processed by {shopName}.</p>
        </div>
      </div>
    </div>
  )
}
