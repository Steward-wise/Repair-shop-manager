import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createAdminClient()

  try {
    const { rating, comment } = await request.json()

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating must be between 1 and 5' }, { status: 400 })
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('job_ratings')
      .select('id, submitted_at')
      .eq('token', token)
      .single()

    if (fetchErr || !existing) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

    if (existing.submitted_at) {
      return NextResponse.json({ error: 'Rating already submitted' }, { status: 400 })
    }

    const { data, error: updateErr } = await supabase
      .from('job_ratings')
      .update({
        rating,
        comment: comment ?? null,
        submitted_at: new Date().toISOString(),
      })
      .eq('token', token)
      .select()
      .single()

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, rating: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
