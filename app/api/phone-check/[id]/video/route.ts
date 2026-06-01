import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const formData = await request.formData()
  const file = formData.get('video') as File | null
  if (!file) return NextResponse.json({ error: 'No video file' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const ext = file.name.endsWith('.mp4') ? 'mp4' : 'webm'
  const path = `phone-checks/${id}/recording.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('repair-media')
    .upload(path, buffer, {
      contentType: file.type || `video/${ext}`,
      upsert: true,
    })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('repair-media').getPublicUrl(path)

  await supabase
    .from('phone_checks')
    .update({ video_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ url: publicUrl }, { status: 201 })
}
