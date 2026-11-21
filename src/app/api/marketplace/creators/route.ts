import { NextRequest } from 'next/server'
import { withAuth, requirePlan, apiSuccess, apiError } from '@/lib/security/rbac'
import {
  createCreatorStore, getCreatorOnboardingLink,
  getCreatorDashboard
} from '@/services/marketplace.service'
import { getUserPlan } from '@/services/subscription.service'
import { z } from 'zod'

const storeSchema = z.object({
  store_name: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  tagline: z.string().max(200).optional(),
})

// GET /api/marketplace/creators — get own store or creator dashboard
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const section = url.searchParams.get('section') ?? 'store'

  if (section === 'dashboard') {
    const plan = await getUserPlan(userId)
    if (!['plus', 'elite'].includes(plan)) {
      return apiError('Creator dashboard requires Plus or Elite plan', 403, 'PLAN_REQUIRED')
    }
    const dashboard = await getCreatorDashboard(userId)
    return apiSuccess(dashboard)
  }

  if (section === 'onboarding') {
    const url = await getCreatorOnboardingLink(userId)
    return apiSuccess({ url })
  }

  const { createAdminClient } = await import('@/lib/supabase/server')
  const db = createAdminClient()
  const { data, error } = await db
    .from('creator_stores')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) return apiError('Store not found', 404)
  return apiSuccess(data)
})

// POST /api/marketplace/creators — create creator store
export const POST = requirePlan('plus', async (req, { userId }) => {
  const body = await req.json()
  const parsed = storeSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)
  const store = await createCreatorStore(userId, parsed.data)
  return apiSuccess(store, 201)
})

// PATCH /api/marketplace/creators — update store profile
export const PATCH = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const { createAdminClient } = await import('@/lib/supabase/server')
  const db = createAdminClient()
  const { data, error } = await db
    .from('creator_stores')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single()
  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})
