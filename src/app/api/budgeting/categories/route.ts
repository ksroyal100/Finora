import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { PLAN_LIMITS, getUserPlan } from '@/services/subscription.service'
import { z } from 'zod'

const categorySchema = z.object({
  budget_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  icon: z.string().max(10).optional(),
  color: z.string().max(20).optional(),
  budgeted_amount: z.number().min(0).default(0),
  is_income: z.boolean().default(false),
  sort_order: z.number().default(0),
})

export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const budgetId = url.searchParams.get('budget_id')
  if (!budgetId) return apiError('budget_id required', 400)
  const db = createAdminClient()
  const { data, error } = await db
    .from('budget_categories')
    .select('*')
    .eq('budget_id', budgetId)
    .eq('user_id', userId)
    .order('is_income', { ascending: false })
    .order('sort_order')
  if (error) return apiError(error.message, 500)
  return apiSuccess(data ?? [])
})

export const POST = withAuth(async (req, { userId }) => {
  const plan = await getUserPlan(userId)
  const body = await req.json()
  const parsed = categorySchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()

  // Plan limit check
  const limit = PLAN_LIMITS[plan].budget_categories
  if (limit !== -1) {
    const { count } = await db.from('budget_categories').select('*', { count: 'exact', head: true }).eq('budget_id', parsed.data.budget_id).eq('user_id', userId).eq('is_income', false)
    if ((count ?? 0) >= limit) return apiError(`Category limit reached (${limit}). Upgrade to Pro for unlimited categories.`, 403, 'PLAN_REQUIRED')
  }

  // Verify budget ownership
  const { data: budget } = await db.from('budgets').select('id').eq('id', parsed.data.budget_id).eq('user_id', userId).single()
  if (!budget) return apiError('Budget not found', 404)

  const { data, error } = await db.from('budget_categories').insert({ user_id: userId, ...parsed.data }).select().single()
  if (error) return apiError(error.message, 500)
  return apiSuccess(data, 201)
})

export const PATCH = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return apiError('Category ID required', 400)
  const db = createAdminClient()
  const { data, error } = await db.from('budget_categories').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId).select().single()
  if (error) return apiError(error.message, 500)
  if (!data) return apiError('Category not found', 404)
  return apiSuccess(data)
})

export const DELETE = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return apiError('Category ID required', 400)
  const db = createAdminClient()
  // Delete all transactions first
  await db.from('budget_transactions').delete().eq('category_id', id).eq('user_id', userId)
  await db.from('budget_categories').delete().eq('id', id).eq('user_id', userId)
  return apiSuccess({ deleted: true })
})
