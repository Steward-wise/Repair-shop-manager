import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

// Disable body parsing — Stripe needs the raw body for signature verification
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const stripeKey    = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const stripe = new Stripe(stripeKey)
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('Stripe webhook signature error:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const jobId   = session.metadata?.job_id

    if (!jobId) {
      console.error('No job_id in Stripe metadata')
      return NextResponse.json({ ok: true })
    }

    if (session.payment_status === 'paid') {
      const supabase = createAdminClient()

      const { data: updatedJob, error } = await supabase.from('jobs').update({
        status:         'awaiting_repair',
        payment_status: 'paid',
        payment_method: 'card (online)',
        updated_at:     new Date().toISOString(),
      }).eq('id', jobId).select('final_price').single()

      if (error) {
        console.error('Failed to update job after payment:', error)
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
      }

      const amount = session.amount_total
        ? `£${(session.amount_total / 100).toFixed(2)}`
        : updatedJob?.final_price ? `£${Number(updatedJob.final_price).toFixed(2)}` : ''

      await supabase.from('job_notes').insert([
        { job_id: jobId, content: `Payment received${amount ? ` — ${amount}` : ''} via card (online)`, note_type: 'payment', meta: { payment_status: 'paid', method: 'card (online)' } },
        { job_id: jobId, content: 'Status changed to Awaiting Repair', note_type: 'status_change', meta: { status: 'awaiting_repair' } },
      ])

      console.log(`✓ Job ${jobId} payment confirmed — moved to awaiting_repair`)
    }
  }

  return NextResponse.json({ ok: true })
}
