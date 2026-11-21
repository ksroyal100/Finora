import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { orchestrator } from '@/lib/agents/orchestrator'

// GET /api/admin/cc/security — security overview
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const section = url.searchParams.get('section') ?? 'overview'
  const severity = url.searchParams.get('severity') ?? ''
  const resolved = url.searchParams.get('resolved')
  const db = createAdminClient()

  if (section === 'audit') {
    let query = db
      .from('audit_logs')
      .select(`*, user:profiles!user_id(display_name, email, role)`, { count: 'exact' })
      .order('created_at', { ascending: false })

    const action = url.searchParams.get('action') ?? ''
    const resourceType = url.searchParams.get('resource_type') ?? ''
    if (action) query = query.eq('action', action)
    if (resourceType) query = query.eq('resource_type', resourceType)

    const { data, count, error } = await query.range(from, to)
    if (error) return apiError(error.message, 500)
    return apiSuccess({ logs: data ?? [], total: count ?? 0, page, per_page: perPage })
  }

  if (section === 'events') {
    let query = db
      .from('security_events')
      .select(`*, user:profiles!user_id(display_name, email)`, { count: 'exact' })
      .order('created_at', { ascending: false })

    if (severity) query = query.eq('severity', severity)
    if (resolved === 'true') query = query.eq('is_resolved', true)
    if (resolved === 'false') query = query.eq('is_resolved', false)

    const { data, count, error } = await query.range(from, to)
    if (error) return apiError(error.message, 500)
    return apiSuccess({ events: data ?? [], total: count ?? 0, page, per_page: perPage })
  }

  // Default: overview dashboard
  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    { data: unresolvedCritical },
    { count: eventsToday },
    { count: failedLogins24h },
    { data: recentEvents },
    { count: bannedUsers },
    { data: topEventTypes },
  ] = await Promise.all([
    db.from('security_events').select('*').eq('is_resolved', false).in('severity', ['high', 'critical']).order('created_at', { ascending: false }).limit(20),
    db.from('security_events').select('*', { count: 'exact', head: true }).gte('created_at', last24h.toISOString()),
    db.from('security_events').select('*', { count: 'exact', head: true }).eq('event_type', 'failed_login').gte('created_at', last24h.toISOString()),
    db.from('security_events').select('*').order('created_at', { ascending: false }).limit(10),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true),
    db.from('security_events').select('event_type').gte('created_at', last7d.toISOString()),
  ])

  // Aggregate event types
  const eventTypeCounts = (topEventTypes ?? []).reduce((acc, e) => {
    acc[e.event_type] = (acc[e.event_type] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const threatScore = Math.min(100, (unresolvedCritical?.length ?? 0) * 20 + (failedLogins24h ?? 0) * 2)

  return apiSuccess({
    overview: {
      threat_score: threatScore,
      threat_level: threatScore > 80 ? 'critical' : threatScore > 50 ? 'high' : threatScore > 20 ? 'medium' : 'low',
      unresolved_critical: unresolvedCritical?.length ?? 0,
      events_today: eventsToday ?? 0,
      failed_logins_24h: failedLogins24h ?? 0,
      banned_users: bannedUsers ?? 0,
    },
    unresolved_critical: unresolvedCritical ?? [],
    recent_events: recentEvents ?? [],
    event_type_breakdown: eventTypeCounts,
  })
})

// POST /api/admin/cc/security — resolve event or ask SENTINEL
export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json()

  if (body.action === 'resolve_event') {
    const { event_id } = body
    if (!event_id) return apiError('Event ID required', 400)
    const db = createAdminClient()
    await db.from('security_events').update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    }).eq('id', event_id)
    return apiSuccess({ resolved: true })
  }

  if (body.action === 'ban_user') {
    const { user_id, reason } = body
    if (!user_id) return apiError('User ID required', 400)
    const db = createAdminClient()
    await db.from('profiles').update({
      is_banned: true,
      banned_at: new Date().toISOString(),
      banned_reason: reason ?? 'Policy violation',
    }).eq('id', user_id)

    const { createAuditLog } = await import('@/lib/security/rbac')
    await createAuditLog({ adminId: userId, action: 'user_banned', resourceType: 'user', resourceId: user_id, newData: { reason } })
    return apiSuccess({ banned: true })
  }

  if (body.action === 'sentinel_analyze') {
    const { question, include_events } = body
    if (!question) return apiError('Question required', 400)

    let context: Record<string, unknown> = {}
    if (include_events) {
      const db = createAdminClient()
      const { data: events } = await db.from('security_events').select('*').eq('is_resolved', false).in('severity', ['high', 'critical']).limit(20)
      context.unresolved_events = events
    }

    const result = await orchestrator.delegateToSentinel(question, context)
    return apiSuccess({ agent: 'sentinel', analysis: result.content, tokens_used: result.tokensUsed })
  }

  return apiError('Invalid action', 400)
})
