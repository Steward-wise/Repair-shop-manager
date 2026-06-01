import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const { data, error } = await supabase
    .from('job_ratings')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ rating: data })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()

  try {
    const { token, rating, comment } = await request.json()

    if (!token || !rating) return NextResponse.json({ error: 'token and rating required' }, { status: 400 })
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating must be 1-5' }, { status: 400 })
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

    return NextResponse.json({ rating: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
