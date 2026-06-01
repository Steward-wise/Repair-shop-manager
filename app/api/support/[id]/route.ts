import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendTechnicianAssignment } from '@/lib/resend'
import { formatTicketRef } from '@/types'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*, client:support_clients(*), technician:technicians(*)')
    .eq('id', id)
    .single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ticket: data })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await request.json()
  const allowed = ['title', 'description', 'status', 'priority', 'assigned_to', 'technician_id',
    'contact_name', 'contact_email', 'contact_phone', 'client_id', 'resolved_at', 'closed_at']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) { if (key in body) updates[key] = body[key] }

  // Fetch current for timeline + email logic
  const { data: current } = await supabase
    .from('support_tickets')
    .select('status, priority, assigned_to, technician_id, ticket_type, ticket_number, title, contact_name, contact_email, client_id')
    .eq('id', id)
    .single()

  // If client_id changed and client has SLA, set sla_due_at
  if ('client_id' in updates && updates.client_id) {
    const { data: client } = await supabase
      .from('support_clients')
      .select('sla_hours')
      .eq('id', updates.client_id as string)
      .single()
    if (client?.sla_hours) {
      const due = new Date()
      due.setHours(due.getHours() + client.sla_hours)
      updates.sla_due_at = due.toISOString()
    }
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .update(updates)
    .eq('id', id)
    .select('*, client:support_clients(*), technician:technicians(*)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Timeline events
  if (current) {
    if (updates.status && updates.status !== current.status) {
      await supabase.from('ticket_timeline').insert({
        ticket_id: id, event_type: 'status_changed',
        description: `Status changed to ${updates.status}`,
      })
    }
    if (updates.priority && updates.priority !== current.priority) {
      await supabase.from('ticket_timeline').insert({
        ticket_id: id, event_type: 'priority_changed',
        description: `Priority set to ${updates.priority}`,
      })
    }
    // Technician assignment
    if ('technician_id' in updates && updates.technician_id !== current.technician_id) {
      if (updates.technician_id) {
        const { data: tech } = await supabase
          .from('technicians')
          .select('name, email')
          .eq('id', updates.technician_id as string)
          .single()
        if (tech) {
          await supabase.from('ticket_timeline').insert({
            ticket_id: id, event_type: 'assigned',
            description: `Assigned to ${tech.name}`,
          })
          // Email the technician
          if (tech.email) {
            const ticketRef = formatTicketRef(current.ticket_type as 'service_desk' | 'incident', current.ticket_number)
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
            await sendTechnicianAssignment(
              tech.email, tech.name, ticketRef, current.title,
              `${appUrl}/support/${id}`, current.priority, current.contact_name,
            )
          }
        }
      } else {
        await supabase.from('ticket_timeline').insert({
          ticket_id: id, event_type: 'assigned',
          description: 'Technician unassigned',
        })
      }
    }
    // Legacy text assigned_to
    if ('assigned_to' in updates && updates.assigned_to !== current.assigned_to && !('technician_id' in updates)) {
      await supabase.from('ticket_timeline').insert({
        ticket_id: id, event_type: 'assigned',
        description: updates.assigned_to ? `Assigned to ${updates.assigned_to}` : 'Unassigned',
      })
    }
  }

  return NextResponse.json({ ticket: data })
}
