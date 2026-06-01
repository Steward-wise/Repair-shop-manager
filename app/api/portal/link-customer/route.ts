import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()

  try {
    const { customerId, email } = await request.json()
    if (!customerId || !email) {
      return NextResponse.json({ error: 'customerId and email required' }, { status: 400 })
    }

    // Update customer email so portal lookup works
    const { error } = await supabase
      .from('customers')
      .update({ email })
      .eq('id', customerId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ linked: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
