import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const BUCKET = 'repair-media'
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const jobId = formData.get('jobId') as string | null
    const photoType = (formData.get('photoType') as string) || 'intake'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
    }

    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
      'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'jpg',
      'image/heif': 'jpg',
    }
    const extFromMime = mimeToExt[file.type]
    const extFromName = file.name.includes('.') ? file.name.split('.').pop() : undefined
    const heicLike = extFromName && ['heic', 'heif'].includes(extFromName.toLowerCase())
    const ext = heicLike ? 'jpg' : (extFromMime ?? extFromName ?? 'jpg')
    const folder = jobId ? `jobs/${jobId}` : 'misc'
    const fileName = `${folder}/${photoType}_${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(fileName)

    // If we have a job ID, insert into job_photos
    if (jobId && photoType !== 'signature') {
      await supabase.from('job_photos').insert({
        job_id: jobId,
        url: publicUrl,
        photo_type: photoType,
      })
    }

    return NextResponse.json({ url: publicUrl })
  } catch (e) {
    console.error('Upload error:', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
