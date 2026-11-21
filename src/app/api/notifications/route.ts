import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { z } from 'zod'

const prefsSchema = z.object({
  email_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
  billing_notifications: z.boolean().optional(),
  community_notifications: z.boolean().optional(),
  marketplace_notifications: z.boolean().optional(),
  learning_notifications: z.boolean().optional(),
  research_notifications: z.boolean().optional(),
  goal_notifications: z.boolean().optional(),
  portfolio_notifications: z.boolean().optional(),
  ai_coach_notifications: z.boolean().optional(),
  security_notifications: z.boolean().optional(),
  marketing_emails: z.boolean().optional(),
  weekly_digest: z.boolean().optional(),
})

// GET /api/notifications
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req, 30)
  const unreadOnly = url.searchParams.get('unread') === 'true'
  const db = createAdminClient()

  let query = db
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('channel', 'in_app')
    .order('created_at', { ascending: false })

  if (unreadOnly) query = query.eq('is_read', false)

  const { data, count, error } = await query.range(from, to)
  if (error) return apiError(error.message, 500)

  const { count: unreadCount } = await db
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .eq('channel', 'in_app')

  return apiSuccess({ notifications: data ?? [], total: count ?? 0, unread_count: unreadCount ?? 0, page, per_page: perPage })
})

// PATCH /api/notifications — mark as read
export const PATCH = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const { id, mark_all } = body
  const db = createAdminClient()

  if (mark_all) {
    await db.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', userId).eq('is_read', false)
    return apiSuccess({ marked: 'all' })
  }

  if (!id) return apiError('Notification ID required', 400)
  await db.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
  return apiSuccess({ marked: id })
})

// DELETE /api/notifications?id=xxx or ?all=true
export const DELETE = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const all = url.searchParams.get('all') === 'true'
  const db = createAdminClient()

  if (all) {
    await db.from('notifications').delete().eq('user_id', userId).eq('is_read', true)
    return apiSuccess({ deleted: 'read' })
  }
  if (!id) return apiError('Notification ID required', 400)
  await db.from('notifications').delete().eq('id', id).eq('user_id', userId)
  return apiSuccess({ deleted: id })
})
