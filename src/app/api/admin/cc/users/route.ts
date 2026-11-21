import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, getPagination, createAuditLog, sanitizeFilterInput } from '@/lib/security/rbac'
import { adminUpdateUserPlan } from '@/services/subscription.service'
import { z } from 'zod'

const banSchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().min(10).max(500),
  duration_days: z.number().min(1).optional(),
})

const planOverrideSchema = z.object({
  user_id: z.string().uuid(),
  plan: z.enum(['free', 'pro', 'plus', 'elite']),
})

// GET /api/admin/cc/users
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const search = url.searchParams.get('search') ?? ''
  const plan = url.searchParams.get('plan') ?? ''
  const role = url.searchParams.get('role') ?? ''
  const banned = url.searchParams.get('banned')
  const userId = url.searchParams.get('user_id')
  const db = createAdminClient()

  // Single user detail
  if (userId) {
    const { data: user, error } = await db
      .from('profiles')
      .select(`
        *,
        subscriptions(*),
        notification_preferences(*),
        creator_stores(id, store_name, is_active, total_revenue, total_sales)
      `)
      .eq('id', userId)
      .single()

    if (error || !user) return apiError('User not found', 404)

    const [
      { count: orderCount },
      { data: recentOrders },
      { count: postCount },
      { count: enrollments },
      { data: auditHistory },
    ] = await Promise.all([
      db.from('marketplace_orders').select('*', { count: 'exact', head: true }).eq('buyer_id', userId),
      db.from('marketplace_orders').select('order_number, total, status, created_at').eq('buyer_id', userId).order('created_at', { ascending: false }).limit(5),
      db.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      db.from('course_enrollments').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      db.from('audit_logs').select('action, created_at, metadata').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    ])

    return apiSuccess({
      ...user,
      stats: {
        orders: orderCount ?? 0,
        posts: postCount ?? 0,
        enrolled_courses: enrollments ?? 0,
      },
      recent_orders: recentOrders ?? [],
      audit_history: auditHistory ?? [],
    })
  }

  // List users
  let query = db
    .from('profiles')
    .select(`
      id, email, display_name, username, avatar_url, role, is_banned, is_creator,
      is_verified, created_at, last_active_at,
      subscriptions(plan, status)
    `, { count: 'exact' })

  if (search) {
    query = query.or(`email.ilike.%${sanitizeFilterInput(search)}%,display_name.ilike.%${sanitizeFilterInput(search)}%,username.ilike.%${sanitizeFilterInput(search)}%`)
  }
  if (role) query = query.eq('role', role)
  if (banned === 'true') query = query.eq('is_banned', true)
  if (banned === 'false') query = query.eq('is_banned', false)

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ users: data ?? [], total: count ?? 0, page, per_page: perPage })
})

// POST /api/admin/cc/users — ban, unban, plan override, role update
export const POST = withAdmin(async (req, { userId: adminId, adminRole }) => {
  const body = await req.json()
  const { action } = body
  const db = createAdminClient()

  if (action === 'ban') {
    const parsed = banSchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed', 400)

    await db.from('profiles').update({
      is_banned: true,
      banned_at: new Date().toISOString(),
      banned_reason: parsed.data.reason,
    }).eq('id', parsed.data.user_id)

    await createAuditLog({
      adminId,
      action: 'user_banned',
      resourceType: 'user',
      resourceId: parsed.data.user_id,
      newData: { reason: parsed.data.reason },
    })

    await db.from('notifications').insert({
      user_id: parsed.data.user_id,
      type: 'security',
      channel: 'in_app',
      title: 'Account Suspended',
      body: `Your account has been suspended. Reason: ${parsed.data.reason}`,
    })

    return apiSuccess({ banned: true })
  }

  if (action === 'unban') {
    const { user_id } = body
    if (!user_id) return apiError('User ID required', 400)

    await db.from('profiles').update({ is_banned: false, banned_at: null, banned_reason: null }).eq('id', user_id)
    await createAuditLog({ adminId, action: 'user_unbanned', resourceType: 'user', resourceId: user_id })

    await db.from('notifications').insert({
      user_id, type: 'security', channel: 'in_app',
      title: 'Account Reinstated',
      body: 'Your account has been reinstated. Welcome back!',
    })

    return apiSuccess({ unbanned: true })
  }

  if (action === 'update_plan') {
    const parsed = planOverrideSchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed', 400)
    await adminUpdateUserPlan(parsed.data.user_id, parsed.data.plan, adminId)
    return apiSuccess({ plan_updated: true, plan: parsed.data.plan })
  }

  if (action === 'update_role') {
    const { user_id, role } = body
    if (!user_id || !role) return apiError('user_id and role required', 400)

    const validRoles = ['user', 'creator', 'moderator', 'admin']
    if (adminRole !== 'founder' && adminRole !== 'super_admin') {
      return apiError('Insufficient permissions for role update', 403)
    }
    if (!validRoles.includes(role)) return apiError('Invalid role', 400)

    await db.from('profiles').update({ role }).eq('id', user_id)
    await createAuditLog({ adminId, action: 'user_role_updated', resourceType: 'user', resourceId: user_id, newData: { role } })
    return apiSuccess({ role_updated: true, role })
  }

  if (action === 'verify') {
    const { user_id } = body
    if (!user_id) return apiError('User ID required', 400)
    await db.from('profiles').update({ is_verified: true }).eq('id', user_id)
    await createAuditLog({ adminId, action: 'user_verified', resourceType: 'user', resourceId: user_id })
    return apiSuccess({ verified: true })
  }

  if (action === 'delete') {
    const { user_id } = body
    if (adminRole !== 'founder') return apiError('Only founders can delete users', 403)
    if (!user_id) return apiError('User ID required', 400)
    await db.auth.admin.deleteUser(user_id)
    await createAuditLog({ adminId, action: 'user_deleted', resourceType: 'user', resourceId: user_id })
    return apiSuccess({ deleted: true })
  }

  return apiError('Invalid action', 400)
})
