import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPurchaseOrder } from '@/lib/resend'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()

  try {
    const { supplier, supplierEmail, items } = await request.json()

    if (!supplier || !supplierEmail || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'supplier, supplierEmail, and items required' }, { status: 400 })
    }

    const poRef = `PO-${Date.now()}`

    // Persist to DB first
    const { data: po, error: dbError } = await supabase
      .from('purchase_orders')
      .insert({ po_ref: poRef, supplier, supplier_email: supplierEmail, items, status: 'sent' })
      .select()
      .single()

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

    // Send email
    const sent = await sendPurchaseOrder(poRef, supplier, supplierEmail, items)
    if (!sent) {
      // Don't fail — PO is saved, email just didn't go
      return NextResponse.json({ sent: false, poRef, po, warning: 'PO saved but email failed to send' })
    }

    return NextResponse.json({ sent: true, poRef, po })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
