import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const BUCKET = 'repair-media'
const MAX_SIZE = 25 * 1024 * 1024 // 25 MB

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('ticket_attachments')
    .select('*')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attachments: data ?? [] })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const messageId = formData.get('message_id') as string | null
    const uploadedBy = formData.get('uploaded_by') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 400 })

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `tickets/${id}/${Date.now()}_${safeName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: file.type || 'application/octet-stream', upsert: false })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

    const { data, error } = await supabase
      .from('ticket_attachments')
      .insert({
        ticket_id: id,
        message_id: messageId || null,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: uploadedBy || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ attachment: data }, { status: 201 })
  } catch (e) {
    console.error('Ticket attachment upload error:', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
