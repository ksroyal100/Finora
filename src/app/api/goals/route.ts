import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { PLAN_LIMITS, getUserPlan } from '@/services/subscription.service'
import { z } from 'zod'

const goalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.enum(['emergency_fund', 'retirement', 'home', 'education', 'vacation', 'business', 'investment', 'debt_payoff', 'other']).default('other'),
  target_amount: z.number().positive(),
  current_amount: z.number().min(0).default(0),
  currency: z.string().length(3).default('USD'),
  target_date: z.string().optional(),
  monthly_contribution: z.number().min(0).optional(),
  priority: z.number().min(1).max(5).default(3),
  icon: z.string().optional(),
  color: z.string().optional(),
  is_public: z.boolean().default(false),
})

const progressSchema = z.object({
  amount: z.number(),
  notes: z.string().max(500).optional(),
})

// GET /api/goals
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? 'active'
  const db = createAdminClient()

  const { data, error } = await db
    .from('goals')
    .select(`*, goal_milestones(*)`)
    .eq('user_id', userId)
    .eq('status', status)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return apiError(error.message, 500)

  // Summary stats
  const goals = data ?? []
  const onTrack = goals.filter(g => {
    if (!g.target_date) return true
    const targetDate = new Date(g.target_date)
    const monthsLeft = (targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)
    const required = g.monthly_contribution ?? (g.target_amount - g.current_amount) / Math.max(1, monthsLeft)
    return g.monthly_contribution ? g.monthly_contribution >= required : true
  }).length

  return apiSuccess({ goals, stats: { total: goals.length, on_track: onTrack } })
})

// POST /api/goals
export const POST = withAuth(async (req, { userId }) => {
  const plan = await getUserPlan(userId)
  const db = createAdminClient()
  const body = await req.json()

  // Plan limit check
  const limit = PLAN_LIMITS[plan].goals
  if (limit !== -1) {
    const { count } = await db.from('goals').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active')
    if ((count ?? 0) >= limit) {
      return apiError(`Goal limit reached (${limit}). Upgrade to Pro for unlimited goals.`, 403, 'PLAN_REQUIRED')
    }
  }

  const parsed = goalSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const { data, error } = await db
    .from('goals')
    .insert({ user_id: userId, ...parsed.data })
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data, 201)
})

// PATCH /api/goals — update goal
export const PATCH = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return apiError('Goal ID required', 400)

  const db = createAdminClient()
  const { data, error } = await db
    .from('goals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  if (!data) return apiError('Goal not found', 404)

  // Check milestones
  if (data.progress_pct >= 100 && data.status === 'active') {
    await db.from('goals').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id)
    await db.from('notifications').insert({
      user_id: userId, type: 'goal', channel: 'in_app',
      title: `🎯 Goal Achieved: ${data.title}`,
      body: `Congratulations! You've reached your goal of $${data.target_amount.toLocaleString()}!`,
    })
  }

  return apiSuccess(data)
})

// DELETE /api/goals?id=xxx
export const DELETE = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return apiError('Goal ID required', 400)

  const db = createAdminClient()
  const { error } = await db.from('goals').delete().eq('id', id).eq('user_id', userId)
  if (error) return apiError(error.message, 500)
  return apiSuccess({ deleted: true })
})
