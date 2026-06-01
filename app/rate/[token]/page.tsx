import { createAdminClient } from '@/lib/supabase/server'
import RatingForm from './RatingForm'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function RatePage({ params }: PageProps) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: ratingRecord, error } = await supabase
    .from('job_ratings')
    .select('*, job:jobs(ticket_number, device_make, device_model)')
    .eq('token', token)
    .single()

  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Repair Shop'

  if (error || !ratingRecord) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full text-center">
          <p className="text-gray-500">This rating link is invalid or has expired.</p>
        </div>
      </div>
    )
  }

  const job = ratingRecord.job as { ticket_number: number; device_make: string; device_model: string } | null
  const alreadySubmitted = !!ratingRecord.submitted_at

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        </div>
        <h1 className="text-lg font-bold text-gray-900">{shopName}</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full">
        {job && (
          <div className="mb-6 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Your repair</p>
            <p className="font-semibold text-gray-900">{job.device_make} {job.device_model}</p>
            <p className="text-sm text-gray-500">Ticket #{job.ticket_number}</p>
          </div>
        )}

        {alreadySubmitted ? (
          <div className="text-center space-y-3">
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <span key={s} className={`text-3xl ${s <= (ratingRecord.rating ?? 0) ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
              ))}
            </div>
            <h2 className="text-xl font-bold text-gray-900">Thank you for your feedback!</h2>
            {ratingRecord.comment && (
              <p className="text-gray-600 text-sm italic">&ldquo;{ratingRecord.comment}&rdquo;</p>
            )}
            <p className="text-gray-500 text-sm">Your review has already been submitted.</p>
            {(ratingRecord.rating ?? 0) >= 4 && (
              <div className="pt-2">
                <p className="text-sm text-gray-600 mb-3">Would you also like to leave us a Google review?</p>
                <a
                  href="https://g.page/r/CZLQS7Su3gboEAE/review"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-800 font-semibold py-2.5 px-5 rounded-lg text-sm hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Leave a Google Review
                </a>
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">How was your repair?</h2>
            <p className="text-sm text-gray-500 text-center mb-6">Your feedback helps us improve our service.</p>
            <RatingForm token={token} />
          </>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-6">Powered by {shopName}</p>
    </div>
  )
}
