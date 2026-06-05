import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { sendJobQuoteApproval } from '@/lib/resend'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  // Load job
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*, customer:customers(id,name,email,phone)')
    .eq('id', id)
    .single()

  if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!job.final_price || job.final_price <= 0)
    return NextResponse.json({ error: 'Set a final price before sending for approval' }, { status: 400 })
  if (!job.customer?.email)
    return NextResponse.json({ error: 'Customer has no email address on file' }, { status: 400 })

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.404fixed.co.uk'
  const shopName = process.env.NEXT_PUBLIC_APP_NAME ?? ''

  const stripe = new Stripe(stripeKey)

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: job.customer.email,
    line_items: [{
      price_data: {
        currency: 'gbp',
        unit_amount: Math.round(job.final_price * 100),
        product_data: {
          name: `Repair: ${job.device_make} ${job.device_model}`,
          description: job.reported_fault ?? undefined,
        },
      },
      quantity: 1,
    }],
    metadata: {
      job_id: id,
      ticket_number: String(job.ticket_number),
      customer_name: job.customer.name ?? '',
    },
    success_url: `${appUrl}/track/${job.ticket_number}?payment=success`,
    cancel_url:  `${appUrl}/track/${job.ticket_number}?payment=cancelled`,
  })

  // Update job: status → awaiting_approval, save session info
  await supabase.from('jobs').update({
    status: 'awaiting_approval',
    approval_sent_at: new Date().toISOString(),
    approval_price: job.final_price,
    stripe_checkout_session_id: session.id,
    stripe_payment_link: session.url,
  }).eq('id', id)

  // Email customer
  await sendJobQuoteApproval({
    to: job.customer.email,
    customerName: job.customer.name ?? 'Customer',
    deviceInfo: `${job.device_make} ${job.device_model}`,
    fault: job.reported_fault ?? '',
    price: job.final_price,
    paymentUrl: session.url!,
    ticketNumber: job.ticket_number,
    shopName,
  })

  // Log to timeline
  await supabase.from('job_notes').insert([
    { job_id: id, content: `Quote for £${job.final_price.toFixed(2)} sent to customer for approval`, note_type: 'status_change', meta: { status: 'awaiting_approval', price: job.final_price } },
  ])

  return NextResponse.json({ ok: true, payment_url: session.url })
}
