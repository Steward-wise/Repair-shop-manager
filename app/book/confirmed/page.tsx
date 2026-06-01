const SHOP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'
const SHOP_PHONE = process.env.NEXT_PUBLIC_SHOP_PHONE ?? ''

export default function BookingConfirmedPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-900/40 border border-green-700 rounded-full mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Appointment Confirmed!</h1>
        <p className="text-zinc-400 text-sm leading-relaxed mb-6">
          We&apos;ve sent a confirmation email with your appointment details. We look forward to seeing you!
        </p>
        {SHOP_PHONE && (
          <p className="text-zinc-500 text-sm">
            Questions? Call us on{' '}
            <a href={`tel:${SHOP_PHONE}`} className="text-red-400 hover:text-red-300">{SHOP_PHONE}</a>
          </p>
        )}
        <p className="text-zinc-600 text-xs mt-6">{SHOP_NAME}</p>
      </div>
    </div>
  )
}
