import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendNewQuoteAlert } from '@/lib/resend'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = supabase.from('quotes').select('*').order('created_at', { ascending: false }).limit(200)
  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quotes: data })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    const body = await request.json()
    const { first_name, last_name, email, phone, device_type, device_make_model, problem_description } = body
    if (!first_name || !last_name || !email || !problem_description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const matched = await autoMatch(supabase, device_type, device_make_model, problem_description)

    const { data, error } = await supabase.from('quotes').insert({
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      device_type: device_type || null,
      device_make_model: device_make_model?.trim() || null,
      problem_description: problem_description.trim(),
      suggested_price: matched?.min_price ?? null,
      matched_rule_id: matched?.id ?? null,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS })

    // Notify shop owner by email
    sendNewQuoteAlert(data).catch(console.error)

    return NextResponse.json({ quote: data }, { status: 201, headers: CORS })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function autoMatch(supabase: any, deviceType: string | null, deviceModel: string | null, problem: string) {
  const { data: rules } = await supabase.from('quote_rules').select('*').eq('is_active', true).order('sort_order')
  if (!rules?.length) return null
  const text = `${problem} ${deviceModel ?? ''}`.toLowerCase()
  const dtype = deviceType?.toLowerCase() ?? ''
  let best = null, bestScore = 0
  for (const rule of rules) {
    let score = 0
    if (rule.device_type) {
      if (rule.device_type.toLowerCase() === dtype) score += 10
      else continue
    }
    for (const kw of rule.keywords.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean)) {
      if (text.includes(kw)) score += 5
    }
    if (score > bestScore) { bestScore = score; best = rule }
  }
  return bestScore > 0 ? best : null
}
