import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { z } from 'zod'

const prefsSchema = z.object({
  email_enabled:            z.boolean().optional(),
  push_enabled:             z.boolean().optional(),
  in_app_enabled:           z.boolean().optional(),
  billing_notifications:    z.boolean().optional(),
  community_notifications:  z.boolean().optional(),
  marketplace_notifications:z.boolean().optional(),
  learning_notifications:   z.boolean().optional(),
  research_notifications:   z.boolean().optional(),
  goal_notifications:       z.boolean().optional(),
  portfolio_notifications:  z.boolean().optional(),
  ai_coach_notifications:   z.boolean().optional(),
  security_notifications:   z.boolean().optional(),
  marketing_emails:         z.boolean().optional(),
  weekly_digest:            z.boolean().optional(),
})

// GET /api/notifications/preferences
export const GET = withAuth(async (req, { userId }) => {
  const db = createAdminClient()
  const { data, error } = await db
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) return apiError('Preferences not found', 404)
  return apiSuccess(data)
})

// PATCH /api/notifications/preferences
export const PATCH = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = prefsSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()
  const { data, error } = await db
    .from('notification_preferences')
    .upsert({ user_id: userId, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})
