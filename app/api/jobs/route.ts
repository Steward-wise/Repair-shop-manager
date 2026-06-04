import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const q = searchParams.get('q')
  const scan = searchParams.get('scan')
  const limit = parseInt(searchParams.get('limit') ?? '100', 10)

  let query = supabase
    .from('jobs')
    .select('*, customer:customers(id,name,phone,email)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)
  if (scan) {
    const ticketNum = parseInt(scan, 10)
    if (!isNaN(ticketNum)) query = query.eq('ticket_number', ticketNum)
  } else if (q) {
    // Search jobs by device/fault/imei fields, OR by customer name via a subquery
    const { data: matchedCustomers } = await supabase
      .from('customers')
      .select('id')
      .ilike('name', `%${q}%`)

    const customerIds = (matchedCustomers ?? []).map((c: { id: string }) => c.id)

    if (customerIds.length > 0) {
      query = query.or(
        `device_make.ilike.%${q}%,device_model.ilike.%${q}%,reported_fault.ilike.%${q}%,imei.ilike.%${q}%,customer_id.in.(${customerIds.join(',')})`
      )
    } else {
      query = query.or(`device_make.ilike.%${q}%,device_model.ilike.%${q}%,reported_fault.ilike.%${q}%,imei.ilike.%${q}%`)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ jobs: data })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()

  try {
    const body = await request.json()
    const {
      customer_id,
      device_type,
      device_make,
      device_model,
      imei,
      reported_fault,
      password,
      backup_required,
      technician_name,
      quoted_price,
      notes,
      photo_urls = [],
      warranty_days,
      checklist,
      intake_method,
      intake_date,
      alternate_contact,
    } = body

    if (!device_make || !device_model || !reported_fault) {
      return NextResponse.json({ error: 'device_make, device_model, and reported_fault are required' }, { status: 400 })
    }

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        customer_id: customer_id || null,
        device_type: device_type || 'other',
        device_make,
        device_model,
        imei: imei || null,
        reported_fault,
        password: password || null,
        backup_required: Boolean(backup_required),
        technician_name: technician_name || null,
        quoted_price: quoted_price || null,
        notes: notes || null,
        status: 'intake',
        warranty_days: warranty_days ?? 90,
        checklist: checklist ?? [],
        intake_method: intake_method || 'drop_off',
        intake_date: intake_date || null,
        alternate_contact: alternate_contact || null,
      })
      .select()
      .single()

    if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 })

    // Attach photos if provided
    if (photo_urls.length > 0) {
      const photoInserts = photo_urls.map((url: string, idx: number) => ({
        job_id: job.id,
        url,
        photo_type: idx === 0 ? 'intake' : 'damage',
      }))
      await supabase.from('job_photos').insert(photoInserts)
    }

    // Warranty check: does this customer have a recent warranty still active for same device?
    let warranty_warning: string | null = null
    if (customer_id && device_make && device_model) {
      const { data: warrantyJobs } = await supabase
        .from('jobs')
        .select('id, warranty_expires_at')
        .eq('customer_id', customer_id)
        .eq('device_make', device_make)
        .eq('device_model', device_model)
        .eq('status', 'collected')
        .gt('warranty_expires_at', new Date().toISOString())
        .neq('id', job.id)
        .limit(1)

      if (warrantyJobs && warrantyJobs.length > 0) {
        warranty_warning = `This customer had a recent repair on this device that may still be under warranty (expires ${new Date(warrantyJobs[0].warranty_expires_at).toLocaleDateString('en-GB')}).`
      }
    }

    return NextResponse.json({ job, warranty_warning }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
