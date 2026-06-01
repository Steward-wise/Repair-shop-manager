import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('job_templates')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    const { name, device_type, device_make, device_model, reported_fault, quoted_price, warranty_days, checklist } =
      await request.json()

    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const { data, error } = await supabase
      .from('job_templates')
      .insert({
        name,
        device_type: device_type ?? 'phone',
        device_make: device_make ?? null,
        device_model: device_model ?? null,
        reported_fault: reported_fault ?? null,
        quoted_price: quoted_price ?? null,
        warranty_days: warranty_days ?? 90,
        checklist: checklist ?? [],
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ template: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
