import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, requirePlan, apiSuccess, apiError } from '@/lib/security/rbac'

// POST /api/research/saved — save or unsave a research report
export const POST = requirePlan('pro', async (req, { userId }) => {
  const body = await req.json()
  const { report_id } = body
  if (!report_id) return apiError('report_id required', 400)

  const db = createAdminClient()
  const { data: existing } = await db.from('saved_research').select('id').eq('user_id', userId).eq('report_id', report_id).single()

  if (existing) {
    await db.from('saved_research').delete().eq('id', existing.id)
    await db.from('research_reports').update({ save_count: db.rpc('decrement', { x: 1 }) as unknown as number }).eq('id', report_id)
    return apiSuccess({ saved: false })
  }

  await db.from('saved_research').insert({ user_id: userId, report_id })
  await db.from('research_reports').update({ save_count: db.rpc('increment', { x: 1 }) as unknown as number }).eq('id', report_id)
  return apiSuccess({ saved: true })
})

// GET /api/research/saved — list saved reports
export const GET = requirePlan('pro', async (req, { userId }) => {
  const db = createAdminClient()
  const { data, error } = await db
    .from('saved_research')
    .select('*, report:research_reports!report_id(*, author:profiles!author_id(display_name, avatar_url))')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false })
  if (error) return apiError(error.message, 500)
  return apiSuccess(data?.map(s => ({ ...s.report, is_saved: true })) ?? [])
})
