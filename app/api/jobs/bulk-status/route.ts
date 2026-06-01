import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { JobStatus } from '@/types'

const VALID_STATUSES: JobStatus[] = ['intake', 'diagnosed', 'in_progress', 'waiting_parts', 'ready', 'collected']

export async function PATCH(request: NextRequest) {
  const supabase = createAdminClient()

  try {
    const { jobIds, status } = await request.json()

    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return NextResponse.json({ error: 'jobIds must be a non-empty array' }, { status: 400 })
    }
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { status }
    if (status === 'collected') updates.collected_at = new Date().toISOString()

    const { error } = await supabase
      .from('jobs')
      .update(updates)
      .in('id', jobIds)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ updated: jobIds.length })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
