'use client'

import { useState } from 'react'

interface Props {
  token: string
}

export default function RatingForm({ token }: Props) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!rating) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/ratings/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to submit. Please try again.')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const GOOGLE_REVIEW_URL = 'https://g.page/r/CZLQS7Su3gboEAE/review'

  if (submitted) {
    return (
      <div className="text-center space-y-3 py-6">
        <div className="text-4xl">🎉</div>
        <h2 className="text-xl font-bold text-gray-900">Thank you for your feedback!</h2>
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s} className={`text-3xl ${s <= rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
          ))}
        </div>
        {comment && <p className="text-gray-600 text-sm italic">&ldquo;{comment}&rdquo;</p>}
        <p className="text-gray-500 text-sm">Your feedback helps us improve our service.</p>
        {rating >= 4 && (
          <div className="pt-2">
            <p className="text-sm text-gray-600 mb-3">Glad you had a great experience! Would you mind leaving us a quick Google review?</p>
            <a
              href={GOOGLE_REVIEW_URL}
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
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600 mb-2 font-medium">Your rating</p>
        <div className="flex gap-2 justify-center">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRating(s)}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(0)}
              className="text-4xl transition-transform hover:scale-110 focus:outline-none"
              aria-label={`Rate ${s} star${s !== 1 ? 's' : ''}`}
            >
              <span className={(hovered || rating) >= s ? 'text-yellow-400' : 'text-gray-300'}>★</span>
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-center text-sm text-gray-500 mt-1">
            {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Additional comments <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Tell us about your experience…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!rating || submitting}
        className="w-full bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
      >
        {submitting ? 'Submitting…' : 'Submit Review'}
      </button>
    </div>
  )
}
