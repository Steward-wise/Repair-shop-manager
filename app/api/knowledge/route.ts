import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const category = searchParams.get('category')

  let query = supabase.from('knowledge_articles').select('id, title, category, tags, author, created_at, updated_at, is_published').order('updated_at', { ascending: false })
  if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ articles: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()
  const { title, content, category = 'general', tags = [], author, is_published = true } = body
  if (!title || !content) return NextResponse.json({ error: 'title and content required' }, { status: 400 })
  const { data, error } = await supabase.from('knowledge_articles').insert({ title, content, category, tags, author, is_published }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ article: data }, { status: 201 })
}
