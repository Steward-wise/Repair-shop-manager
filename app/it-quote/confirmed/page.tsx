const SHOP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'

export default function ITQuoteConfirmedPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-green-900/30 border-2 border-green-600 flex items-center justify-center mb-6">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-white mb-3">Quote Accepted!</h1>
      <p className="text-zinc-400 text-base max-w-md">
        Thank you for accepting the quote. A member of our team will be in touch shortly to arrange next steps.
      </p>
      <p className="mt-8 text-xs text-zinc-600">&copy; {new Date().getFullYear()} {SHOP_NAME}</p>
    </div>
  )
}
