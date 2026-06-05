import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export interface SaleItem {
  inventory_id: string | null
  part_name: string
  sku: string | null
  quantity: number
  unit_price: number
  total: number
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    const {
      items,
      subtotal,
      discount = 0,
      total,
      payment_method,
      customer_name,
      customer_email,
      created_by,
    }: {
      items: SaleItem[]
      subtotal: number
      discount?: number
      total: number
      payment_method: string
      customer_name?: string
      customer_email?: string
      created_by?: string
    } = await request.json()

    if (!items?.length || !payment_method || total == null) {
      return NextResponse.json({ error: 'items, payment_method, and total are required' }, { status: 400 })
    }

    // Persist sale record
    const { data: sale, error: saleError } = await supabase
      .from('pos_sales')
      .insert({
        items,
        subtotal: Math.round(subtotal * 100) / 100,
        discount: Math.round((discount ?? 0) * 100) / 100,
        total: Math.round(total * 100) / 100,
        payment_method,
        customer_name: customer_name?.trim() || null,
        customer_email: customer_email?.trim() || null,
        created_by: created_by?.trim() || null,
      })
      .select()
      .single()

    if (saleError) return NextResponse.json({ error: saleError.message }, { status: 500 })

    // Decrement inventory for each item that has an inventory_id
    const stockUpdates = items
      .filter((i) => i.inventory_id && i.quantity > 0)
      .map(async (item) => {
        const { data: inv } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('id', item.inventory_id!)
          .single()
        if (inv) {
          await supabase
            .from('inventory')
            .update({ quantity: Math.max(0, inv.quantity - item.quantity) })
            .eq('id', item.inventory_id!)
        }
      })

    await Promise.allSettled(stockUpdates)

    return NextResponse.json({ sale }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
