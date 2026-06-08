import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatTicketNumber, formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Reviews' }

interface ReviewRow {
  id: string
  job_id: string
  rating: number
  comment: string | null
  submitted_at: string | null
  created_at: string
  job: {
    ticket_number: number
    device_make: string
    device_model: string
    technician_name: string | null
    customer: { id: string; name: string; email: string | null } | null
  } | null
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill={s <= rating ? '#eab308' : 'none'} stroke={s <= rating ? '#eab308' : '#3f3f46'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </div>
  )
}

export default async function ReviewsPage() {
  const supabase = createAdminClient()

  const { data: ratings } = await supabase
    .from('job_ratings')
    .select('*, job:jobs(ticket_number, device_make, device_model, technician_name, customer:customers(id, name, email))')
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(200)

  const reviews = (ratings ?? []) as ReviewRow[]

  // Summary stats
  const total = reviews.length
  const avg = total > 0
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10
    : null
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }))

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">Customer Reviews</h1>
          <p className="text-muted text-sm mt-0.5">{total} submitted review{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Summary card */}
      {total > 0 && (
        <div className="card">
          <div className="flex items-center gap-8 flex-wrap">
            <div className="text-center">
              <p className="text-5xl font-bold text-fg">{avg}</p>
              <Stars rating={Math.round(avg ?? 0)} />
              <p className="text-xs text-muted mt-1">{total} reviews</p>
            </div>
            <div className="flex-1 space-y-1.5 min-w-[200px]">
              {dist.map(({ star, count }) => (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="text-muted w-4 text-right">{star}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 rounded-full"
                      style={{ width: total > 0 ? `${Math.round((count / total) * 100)}%` : '0%' }}
                    />
                  </div>
                  <span className="text-muted w-6">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-muted">No reviews submitted yet.</p>
          <p className="text-xs text-muted mt-2">Send rating requests from the job detail page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  {/* Star rating */}
                  <Stars rating={review.rating} />
                  <span className={`text-sm font-bold ${
                    review.rating >= 4 ? 'text-green-400' :
                    review.rating === 3 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {review.rating}/5
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {review.submitted_at ? formatDateTime(review.submitted_at) : '—'}
                </p>
              </div>

              {review.comment && (
                <blockquote className="text-sm text-fg leading-relaxed border-l-2 border-primary pl-3 italic">
                  &ldquo;{review.comment}&rdquo;
                </blockquote>
              )}

              <div className="flex items-center gap-4 flex-wrap text-xs text-muted border-t border-border pt-2">
                {review.job?.customer ? (
                  <Link href={`/customers/${review.job.customer.id}`} className="flex items-center gap-1.5 hover:text-fg transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span className="font-medium text-fg">{review.job.customer.name}</span>
                    {review.job.customer.email && <span className="text-muted">({review.job.customer.email})</span>}
                  </Link>
                ) : (
                  <span>Walk-in customer</span>
                )}

                {review.job && (
                  <Link href={`/jobs/${review.job_id}`} className="flex items-center gap-1.5 hover:text-fg transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                    </svg>
                    {formatTicketNumber(review.job.ticket_number)} — {review.job.device_make} {review.job.device_model}
                  </Link>
                )}

                {review.job?.technician_name && (
                  <span className="flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                    </svg>
                    {review.job.technician_name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
