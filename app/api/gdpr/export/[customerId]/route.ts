import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getApiUserRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(_: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params
  const { email: actorEmail, role } = await getApiUserRole()
  if (role !== 'manager') return NextResponse.json({ error: 'Manager access required' }, { status: 403 })

  const supabase = createAdminClient()

  const [
    { data: customer },
    { data: jobs },
    { data: notes },
    { data: photos },
    { data: custodyEvents },
    { data: consentAudit },
  ] = await Promise.all([
    supabase.from('customers').select('*').eq('id', customerId).single(),
    supabase.from('jobs').select('id,ticket_number,device_type,device_make,device_model,imei,reported_fault,status,quoted_price,final_price,payment_status,created_at,collected_at,technician_name,notes,warranty_days,intake_method,intake_date').eq('customer_id', customerId).order('created_at', { ascending: false }),
    supabase.from('job_notes').select('content,note_type,source,created_at').in('job_id', ((await supabase.from('jobs').select('id').eq('customer_id', customerId)).data ?? []).map((j: { id: string }) => j.id)),
    supabase.from('job_photos').select('url,photo_type,created_at').in('job_id', ((await supabase.from('jobs').select('id').eq('customer_id', customerId)).data ?? []).map((j: { id: string }) => j.id)),
    supabase.from('job_custody_events').select('event_type,direction,event_date,person_name,notes,created_at').in('job_id', ((await supabase.from('jobs').select('id').eq('customer_id', customerId)).data ?? []).map((j: { id: string }) => j.id)),
    supabase.from('consent_audit').select('consent_type,granted,method,created_at').eq('customer_id', customerId),
  ])

  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const exportData = {
    exported_at: new Date().toISOString(),
    exported_by: actorEmail,
    data_subject: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      marketing_consent: customer.marketing_consent,
      created_at: customer.created_at,
      notes: customer.notes,
    },
    repairs: jobs ?? [],
    job_notes: notes ?? [],
    photos: (photos ?? []).map((p: { url: string; photo_type: string; created_at: string }) => ({ photo_type: p.photo_type, created_at: p.created_at, url: p.url })),
    custody_events: custodyEvents ?? [],
    consent_history: consentAudit ?? [],
  }

  await logAudit({
    action: 'customer.anonymised', // reuse closest action — logs export event
    entity: 'customer',
    entityId: customerId,
    userEmail: actorEmail,
    description: `GDPR data export generated for customer ${customer.name} (${customer.email ?? 'no email'})`,
  })

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="gdpr-export-${customerId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
