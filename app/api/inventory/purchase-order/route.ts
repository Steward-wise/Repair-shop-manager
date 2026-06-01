import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPurchaseOrder } from '@/lib/resend'

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()

  try {
    const { supplier, supplierEmail, items } = await request.json()

    if (!supplier || !supplierEmail || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'supplier, supplierEmail, and items required' }, { status: 400 })
    }

    const poRef = `PO-${Date.now()}`
    const sent = await sendPurchaseOrder(poRef, supplier, supplierEmail, items)

    if (!sent) return NextResponse.json({ error: 'Failed to send PO email' }, { status: 500 })

    return NextResponse.json({ sent: true, poRef })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
