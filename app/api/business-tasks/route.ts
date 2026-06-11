import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('business_tasks')
    .select('*')
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    const body = await request.json()
    const { title, description, status, priority, category, assigned_to, due_date, created_by } = body
    if (!title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    // Place at the end of the target column
    const { count } = await supabase
      .from('business_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', status ?? 'todo')

    const { data, error } = await supabase
      .from('business_tasks')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        status: status ?? 'todo',
        priority: priority ?? 'medium',
        category: category?.trim() || null,
        assigned_to: assigned_to?.trim() || null,
        due_date: due_date || null,
        created_by: created_by?.trim() || null,
        order_index: count ?? 0,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ task: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
