import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { z } from 'zod'

const updateSchema = z.object({
  display_name: z.string().min(2).max(100).optional(),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal('')),
  location: z.string().max(100).optional(),
  timezone: z.string().optional(),
  currency: z.string().length(3).optional(),
})

// GET /api/profiles — get own profile
export const GET = withAuth(async (req, { userId }) => {
  const db = createAdminClient()
  const { data, error } = await db
    .from('profiles')
    .select(`
      *, 
      subscriptions(plan, status, current_period_end, cancel_at),
      notification_preferences(*)
    `)
    .eq('id', userId)
    .single()

  if (error) return apiError('Profile not found', 404)

  // Follower / following counts
  const [{ count: followers }, { count: following }] = await Promise.all([
    db.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    db.from('user_follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ])

  return apiSuccess({ ...data, follower_count: followers ?? 0, following_count: following ?? 0 })
})

// PATCH /api/profiles — update own profile
export const PATCH = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Validation failed', 400)
  }

  const db = createAdminClient()

  // Check username uniqueness
  if (parsed.data.username) {
    const { data: existing } = await db
      .from('profiles')
      .select('id')
      .eq('username', parsed.data.username)
      .neq('id', userId)
      .single()
    if (existing) return apiError('Username already taken', 409)
  }

  const { data, error } = await db
    .from('profiles')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})
