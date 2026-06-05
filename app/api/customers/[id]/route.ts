import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getApiUserRole } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase.from('customers').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  return NextResponse.json({ customer: data })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  try {
    const body = await request.json()
    const { name, phone, email, notes } = body

    const { data, error } = await supabase
      .from('customers')
      .update({ name, phone: phone || null, email: email || null, notes: notes || null })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ customer: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  // Block deletion if customer has open jobs
  const { data: openJobs } = await supabase
    .from('jobs')
    .select('id, status')
    .eq('customer_id', id)
    .not('status', 'in', '("collected","cancelled")')
    .limit(1)

  if (openJobs && openJobs.length > 0) {
    return NextResponse.json(
      { error: 'Cannot anonymise: customer has open jobs. Close or collect all jobs first.' },
      { status: 409 }
    )
  }

  // Load current data for audit record before anonymising
  const { data: existing } = await supabase.from('customers').select('name,email,phone').eq('id', id).single()

  // Anonymise — GDPR soft delete (UK GDPR Art.17 Right to Erasure)
  const { error } = await supabase
    .from('customers')
    .update({
      name: 'Anonymised Customer',
      email: null,
      phone: null,
      notes: null,
      anonymised_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { email: actorEmail } = await getApiUserRole()
  await logAudit({
    action: 'customer.anonymised',
    entity: 'customer',
    entityId: id,
    userEmail: actorEmail,
    description: `Customer anonymised under GDPR right to erasure (was: ${existing?.name ?? 'unknown'})`,
    oldValue: { name: existing?.name, email: existing?.email, phone: existing?.phone },
    newValue: { name: 'Anonymised Customer', email: null, phone: null },
  })

  return NextResponse.json({ anonymised: true })
}
