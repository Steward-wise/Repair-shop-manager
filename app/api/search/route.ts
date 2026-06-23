import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getApiUserRole } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const { role } = await getApiUserRole()
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''

  if (q.length < 2) return NextResponse.json({ results: [] })

  const supabase = createAdminClient()

  // Search jobs (ticket number, device, fault) + customer name via join
  const [jobsRes, customersRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, ticket_number, device_make, device_model, status, reported_fault, customer:customers(id,name,email,phone)')
      .or(
        `device_make.ilike.%${q}%,device_model.ilike.%${q}%,reported_fault.ilike.%${q}%,imei.ilike.%${q}%`
      )
      .order('created_at', { ascending: false })
      .limit(6),

    supabase
      .from('customers')
      .select('id, name, email, phone')
      .or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
      .is('deleted_at', null)
      .limit(6),
  ])

  // Also search jobs by ticket number if q is numeric
  const ticketNum = parseInt(q, 10)
  let ticketJob = null
  if (!isNaN(ticketNum)) {
    const { data } = await supabase
      .from('jobs')
      .select('id, ticket_number, device_make, device_model, status, reported_fault, customer:customers(id,name,email,phone)')
      .eq('ticket_number', ticketNum)
      .single()
    ticketJob = data
  }

  // Also search jobs where customer name matches
  const customerIds = (customersRes.data ?? []).map((c: { id: string }) => c.id)
  let customerJobs: typeof jobsRes.data = []
  if (customerIds.length > 0) {
    const { data } = await supabase
      .from('jobs')
      .select('id, ticket_number, device_make, device_model, status, reported_fault, customer:customers(id,name,email,phone)')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false })
      .limit(4)
    customerJobs = data ?? []
  }

  type Result = { type: 'job' | 'customer'; id: string; label: string; sub: string; href: string; status?: string }

  const results: Result[] = []
  const seenJobIds = new Set<string>()

  // Ticket number match first
  if (ticketJob && !seenJobIds.has(ticketJob.id)) {
    seenJobIds.add(ticketJob.id)
    const cust = ticketJob.customer as { name: string } | null
    results.push({
      type: 'job',
      id: ticketJob.id,
      label: `#${String(ticketJob.ticket_number).padStart(5, '0')} — ${ticketJob.device_make} ${ticketJob.device_model}`,
      sub: cust?.name ?? 'Walk-in',
      href: `/jobs/${ticketJob.id}`,
      status: ticketJob.status,
    })
  }

  // Customer matches
  for (const c of customersRes.data ?? []) {
    results.push({
      type: 'customer',
      id: c.id,
      label: c.name,
      sub: [c.email, c.phone].filter(Boolean).join(' · '),
      href: `/customers/${c.id}`,
    })
  }

  // Jobs matching device/fault
  for (const job of jobsRes.data ?? []) {
    if (seenJobIds.has(job.id)) continue
    seenJobIds.add(job.id)
    const cust = job.customer as { name: string } | null
    results.push({
      type: 'job',
      id: job.id,
      label: `#${String(job.ticket_number).padStart(5, '0')} — ${job.device_make} ${job.device_model}`,
      sub: cust?.name ?? 'Walk-in',
      href: `/jobs/${job.id}`,
      status: job.status,
    })
  }

  // Jobs for matched customers
  for (const job of customerJobs ?? []) {
    if (seenJobIds.has(job.id)) continue
    seenJobIds.add(job.id)
    const cust = job.customer as { name: string } | null
    results.push({
      type: 'job',
      id: job.id,
      label: `#${String(job.ticket_number).padStart(5, '0')} — ${job.device_make} ${job.device_model}`,
      sub: cust?.name ?? 'Walk-in',
      href: `/jobs/${job.id}`,
      status: job.status,
    })
  }

  return NextResponse.json({ results: results.slice(0, 10) })
}
