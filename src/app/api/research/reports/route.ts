import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, requirePlan, apiSuccess, apiError, getPagination, sanitizeFilterInput } from '@/lib/security/rbac'
import { z } from 'zod'

const watchlistSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  symbols: z.array(z.string().toUpperCase()).max(50).default([]),
  is_public: z.boolean().default(false),
})

// GET /api/research/reports — list research reports (pro+ required)
export const GET = requirePlan('pro', async (req, { userId, plan }) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const search = url.searchParams.get('search') ?? ''
  const type = url.searchParams.get('type') ?? ''
  const featured = url.searchParams.get('featured') === 'true'
  const saved = url.searchParams.get('saved') === 'true'
  const db = createAdminClient()

  if (saved) {
    const { data: savedReports } = await db
      .from('saved_research')
      .select('report_id')
      .eq('user_id', userId)
    const ids = savedReports?.map(s => s.report_id) ?? []
    if (!ids.length) return apiSuccess({ reports: [], total: 0 })

    const { data, count } = await db
      .from('research_reports')
      .select('*, author:profiles!author_id(display_name, avatar_url)', { count: 'exact' })
      .in('id', ids)
      .eq('is_published', true)
      .range(from, to)

    return apiSuccess({ reports: data?.map(r => ({ ...r, is_saved: true })) ?? [], total: count ?? 0, page, per_page: perPage })
  }

  let query = db
    .from('research_reports')
    .select(`*, author:profiles!author_id(display_name, avatar_url)`, { count: 'exact' })
    .eq('is_published', true)

  if (search) query = query.or(`title.ilike.%${sanitizeFilterInput(search)}%,summary.ilike.%${sanitizeFilterInput(search)}%`)
  if (type) query = query.eq('report_type', type)
  if (featured) query = query.eq('is_featured', true)

  const { data, count, error } = await query
    .order('published_at', { ascending: false })
    .range(from, to)

  if (error) return apiError(error.message, 500)

  const reports = data ?? []
  const reportIds = reports.map(r => r.id)

  const { data: savedItems } = await db
    .from('saved_research')
    .select('report_id')
    .eq('user_id', userId)
    .in('report_id', reportIds)

  const savedSet = new Set(savedItems?.map(s => s.report_id))

  return apiSuccess({
    reports: reports.map(r => ({ ...r, is_saved: savedSet.has(r.id) })),
    total: count ?? 0,
    page,
    per_page: perPage,
  })
})
