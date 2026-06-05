import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// PATCH /api/inventory/purchase-order/[id] — mark as received, update stock
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  try {
    const { status, notes, received_items } = await request.json()
    // received_items: optional array of { inventory_id, quantity_received } for partial receives

    // Load PO
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .single()

    if (poError || !po) return NextResponse.json({ error: 'PO not found' }, { status: 404 })
    if (po.status === 'received') return NextResponse.json({ error: 'PO already marked as received' }, { status: 400 })

    const newStatus = status ?? 'received'
    const isFullReceive = newStatus === 'received'

    // Update inventory quantities
    const itemsToProcess = received_items ?? po.items
    const stockUpdates: Promise<unknown>[] = []

    for (const item of itemsToProcess) {
      const qty = item.quantity_received ?? item.quantity_to_order
      if (!qty || qty <= 0) continue

      if (item.inventory_id) {
        // Update by inventory ID
        stockUpdates.push(
          (async () => {
            // Fallback: manual increment
            const { data: inv } = await supabase.from('inventory').select('quantity').eq('id', item.inventory_id).single()
            if (inv) {
              await supabase.from('inventory').update({ quantity: (inv as { quantity: number }).quantity + qty }).eq('id', item.inventory_id)
            }
          })()
        )
      } else if (item.sku) {
        // Find by SKU
        stockUpdates.push(
          (async () => {
            const { data: inv } = await supabase.from('inventory').select('id, quantity').eq('sku', item.sku).single()
            if (inv) await supabase.from('inventory').update({ quantity: (inv as { id: string; quantity: number }).quantity + qty }).eq('id', (inv as { id: string }).id)
          })()
        )
      } else if (item.part_name) {
        // Find by part name (best effort)
        stockUpdates.push(
          (async () => {
            const { data: inv } = await supabase.from('inventory').select('id, quantity').ilike('part_name', item.part_name).limit(1).single()
            if (inv) await supabase.from('inventory').update({ quantity: (inv as { id: string; quantity: number }).quantity + qty }).eq('id', (inv as { id: string }).id)
          })()
        )
      }
    }

    await Promise.allSettled(stockUpdates)

    // Update PO record
    const { data: updated, error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        status: newStatus,
        received_at: isFullReceive ? new Date().toISOString() : null,
        notes: notes ?? po.notes,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ po: updated, stock_updated: itemsToProcess.length })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
