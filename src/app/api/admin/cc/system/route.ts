import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, withFounder, apiSuccess, apiError } from '@/lib/security/rbac'
import { orchestrator } from '@/lib/agents/orchestrator'
import { z } from 'zod'

const flagSchema = z.object({
  key: z.string().min(3).max(100).regex(/^[a-z0-9_]+$/),
  name: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  is_enabled: z.boolean().default(false),
  rollout_percentage: z.number().min(0).max(100).default(0),
  allowed_plans: z.array(z.string()).default([]),
  allowed_user_ids: z.array(z.string().uuid()).default([]),
})

const configSchema = z.object({
  key: z.string().min(3).max(200),
  value: z.unknown(),
  description: z.string().max(500).optional(),
  is_public: z.boolean().default(false),
})

// GET /api/admin/cc/system
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const section = url.searchParams.get('section') ?? 'overview'
  const db = createAdminClient()

  if (section === 'flags') {
    const { data, error } = await db.from('feature_flags').select('*').order('created_at', { ascending: false })
    if (error) return apiError(error.message, 500)
    return apiSuccess(data ?? [])
  }

  if (section === 'config') {
    const { data, error } = await db.from('system_config').select('*').order('key')
    if (error) return apiError(error.message, 500)
    return apiSuccess(data ?? [])
  }

  if (section === 'health') {
    // Aggregate system health metrics
    const { data: recentMetrics } = await db
      .from('infrastructure_metrics')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(100)

    const now = new Date()

    // Compute health indicators
    const latestByType = (recentMetrics ?? []).reduce((acc, m) => {
      if (!acc[m.metric_type] || new Date(m.recorded_at) > new Date(acc[m.metric_type].recorded_at)) {
        acc[m.metric_type] = m
      }
      return acc
    }, {} as Record<string, any>)

    // DB stats
    const [
      { count: totalUsers },
      { count: activeSubscriptions },
      { count: totalProducts },
      { count: totalOrders },
      { count: totalPosts },
    ] = await Promise.all([
      db.from('profiles').select('*', { count: 'exact', head: true }),
      db.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('marketplace_products').select('*', { count: 'exact', head: true }).eq('status', 'published'),
      db.from('marketplace_orders').select('*', { count: 'exact', head: true }),
      db.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    ])

    return apiSuccess({
      metrics: latestByType,
      platform_counts: {
        users: totalUsers ?? 0,
        active_subscriptions: activeSubscriptions ?? 0,
        marketplace_products: totalProducts ?? 0,
        marketplace_orders: totalOrders ?? 0,
        community_posts: totalPosts ?? 0,
      },
      status: 'operational',
      last_checked: now.toISOString(),
    })
  }

  if (section === 'titan_report') {
    const result = await orchestrator.delegateToTitan(
      'Analyze Finora system health and provide an infrastructure report with recommendations.',
      {}
    )
    return apiSuccess({ agent: 'titan', report: result.content })
  }

  // Overview: all sections condensed
  const [{ data: flags }, { data: configs }] = await Promise.all([
    db.from('feature_flags').select('key, name, is_enabled, rollout_percentage').limit(20),
    db.from('system_config').select('key, value, is_public').eq('is_public', true),
  ])

  return apiSuccess({ flags: flags ?? [], public_config: configs ?? [] })
})

// POST /api/admin/cc/system — create feature flag or config
export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const db = createAdminClient()

  if (body.type === 'flag') {
    const parsed = flagSchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed', 400)
    const { data, error } = await db.from('feature_flags').insert({ ...parsed.data, created_by: userId }).select().single()
    if (error) return apiError(error.message === 'duplicate key' ? 'Flag key already exists' : error.message, error.message.includes('duplicate') ? 409 : 500)
    return apiSuccess(data, 201)
  }

  if (body.type === 'config') {
    const parsed = configSchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed', 400)
    const { data, error } = await db.from('system_config').upsert({ ...parsed.data, updated_by: userId }, { onConflict: 'key' }).select().single()
    if (error) return apiError(error.message, 500)
    return apiSuccess(data, 201)
  }

  if (body.type === 'metric') {
    const { metric_type, value, unit, host, service } = body
    if (!metric_type || value === undefined) return apiError('metric_type and value required', 400)
    const { data, error } = await db.from('infrastructure_metrics').insert({ metric_type, value, unit, host, service, environment: process.env.NODE_ENV }).select().single()
    if (error) return apiError(error.message, 500)
    return apiSuccess(data, 201)
  }

  return apiError('type must be flag, config, or metric', 400)
})

// PATCH /api/admin/cc/system — toggle flag, update config
export const PATCH = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const db = createAdminClient()

  if (body.type === 'flag') {
    const { id, ...updates } = body
    if (!id) return apiError('Flag ID required', 400)
    const { data, error } = await db.from('feature_flags').update(updates).eq('id', id).select().single()
    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  }

  if (body.type === 'config') {
    const { key, value, description, is_public } = body
    if (!key) return apiError('Config key required', 400)
    const { data, error } = await db.from('system_config').update({ value, description, is_public, updated_by: userId }).eq('key', key).select().single()
    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  }

  return apiError('type must be flag or config', 400)
})
