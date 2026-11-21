import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { orchestrator } from '@/lib/agents/orchestrator'
import { z } from 'zod'

const roadmapSchema = z.object({
  title: z.string().min(3).max(300),
  description: z.string().max(3000).optional(),
  category: z.enum(['feature', 'improvement', 'bug_fix', 'integration', 'infrastructure']).default('feature'),
  status: z.enum(['idea', 'planned', 'in_progress', 'in_review', 'completed', 'canceled']).default('planned'),
  priority: z.enum(['low', 'medium', 'high', 'critical', 'urgent']).default('medium'),
  effort_estimate: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).default('md'),
  impact_score: z.number().min(1).max(10).default(5),
  assigned_agent: z.enum(['jarvis', 'athena', 'orion', 'titan', 'phoenix', 'merlin', 'sentinel']).optional(),
  target_release: z.string().optional(),
  planned_date: z.string().optional(),
  tags: z.array(z.string()).max(10).default([]),
})

// GET /api/admin/cc/roadmap
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const status = url.searchParams.get('status') ?? ''
  const category = url.searchParams.get('category') ?? ''
  const priority = url.searchParams.get('priority') ?? ''
  const db = createAdminClient()

  let query = db
    .from('roadmap_items')
    .select('*', { count: 'exact' })
    .order('priority', { ascending: false })
    .order('impact_score', { ascending: false })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (category) query = query.eq('category', category)
  if (priority) query = query.eq('priority', priority)

  const { data, count, error } = await query.range(from, to)
  if (error) return apiError(error.message, 500)

  // Stats by status
  const { data: statusStats } = await db
    .from('roadmap_items')
    .select('status')

  const statusCounts = (statusStats ?? []).reduce((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return apiSuccess({
    items: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
    status_counts: statusCounts,
  })
})

// POST /api/admin/cc/roadmap
export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json()

  if (body.action === 'ai_suggest') {
    // ORION generates roadmap suggestions based on user feedback / metrics
    const prompt = `Based on Finora as a wealth creation platform, suggest 10 high-impact product features or improvements. 
    Consider: user retention, competitive advantages, revenue growth, user requests.
    Context: ${JSON.stringify(body.context ?? {})}
    
    Return JSON array: [{"title": string, "description": string, "category": string, "priority": string, "impact_score": number, "effort_estimate": string, "rationale": string}]`

    const result = await orchestrator.delegateToOrion(prompt)
    return apiSuccess({ suggestions: result.content, agent: 'orion' })
  }

  const parsed = roadmapSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()
  const { data, error } = await db.from('roadmap_items').insert({
    ...parsed.data,
    created_by: userId,
  }).select().single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data, 201)
})

// PATCH /api/admin/cc/roadmap
export const PATCH = withAdmin(async (req) => {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return apiError('Item ID required', 400)

  const db = createAdminClient()
  const updateData: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }
  if (updates.status === 'completed') updateData.completed_date = new Date().toISOString().split('T')[0]

  const { data, error } = await db.from('roadmap_items').update(updateData).eq('id', id).select().single()
  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

// DELETE /api/admin/cc/roadmap?id=xxx
export const DELETE = withAdmin(async (req) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return apiError('Item ID required', 400)
  const db = createAdminClient()
  await db.from('roadmap_items').delete().eq('id', id)
  return apiSuccess({ deleted: true })
})
