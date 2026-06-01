import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendReorderAlert } from '@/lib/resend'

export async function POST() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('inventory')
    .select('part_name,sku,quantity,reorder_threshold,supplier')
    .filter('quantity', 'lte', 'reorder_threshold')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lowItems = (data ?? []).filter((i: { quantity: number; reorder_threshold: number }) => i.quantity <= i.reorder_threshold)

  if (lowItems.length === 0) {
    return NextResponse.json({ sent: false, message: 'No low stock items' })
  }

  const sent = await sendReorderAlert(lowItems)
  return NextResponse.json({ sent, count: lowItems.length })
}
