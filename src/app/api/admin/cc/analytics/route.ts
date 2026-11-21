// src/app/api/admin/cc/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Same allowlist already used correctly in src/middleware.ts — previously
// this reflected any Origin header verbatim while allowing credentials,
// a real CORS misconfiguration (Engineering Audit H-1).
const ALLOWED_ORIGINS = [process.env.NEXT_PUBLIC_ADMIN_URL, process.env.NEXT_PUBLIC_APP_URL].filter(
  (v): v is string => Boolean(v)
)

export async function GET(req: NextRequest) {
  const requestOrigin = req.headers.get('origin')
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : (ALLOWED_ORIGINS[0] ?? '')
  const cors = {
    'Access-Control-Allow-Origin':      origin,
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type':                     'application/json',
  }

  // ── STEP 1: Read Authorization header ──────────────────────
  const rawAuth = req.headers.get('authorization')
               ?? req.headers.get('Authorization')
               ?? ''

  if (!rawAuth.startsWith('Bearer ')) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'No Bearer token in Authorization header', step: 1 }),
      { status: 401, headers: cors }
    )
  }

  const token = rawAuth.slice(7).trim()

  // ── STEP 2: Check env vars ──────────────────────────────────
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  || ''
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl || !serviceKey) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Backend missing SUPABASE env vars', step: 2 }),
      { status: 401, headers: cors }
    )
  }

  // ── STEP 3: Verify JWT token with Supabase ──────────────────
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user }, error: authErr } = await db.auth.getUser(token)

  if (authErr || !user) {
    return new NextResponse(
      JSON.stringify({ success: false, error: `Token verification failed: ${authErr?.message}`, step: 3 }),
      { status: 401, headers: cors }
    )
  }

  // ── STEP 4: Check profiles.role ─────────────────────────────
  const { data: profile, error: profileErr } = await db
    .from('profiles').select('role').eq('id', user.id).single()

  if (profileErr || !profile) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Profile not found in database', step: 4 }),
      { status: 401, headers: cors }
    )
  }

  if (!['admin', 'super_admin', 'founder'].includes(profile.role ?? '')) {
    return new NextResponse(
      JSON.stringify({ success: false, error: `profiles.role="${profile.role}" — not an admin role. Run admin_user_setup.sql.`, step: 4 }),
      { status: 403, headers: cors }
    )
  }

  // ── STEP 5: Check admin_users table ─────────────────────────
  const { data: adminUser, error: adminErr } = await db
    .from('admin_users').select('admin_role, is_founder, is_active').eq('id', user.id).single()

  if (adminErr || !adminUser) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'No row in admin_users table. Run admin_user_setup.sql.', step: 5 }),
      { status: 403, headers: cors }
    )
  }

  if (!adminUser.is_active) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Admin account is deactivated (is_active=false)', step: 5 }),
      { status: 403, headers: cors }
    )
  }

  // ── Build dashboard payload ──────────────────────────────────
  const url = new URL(req.url)
  const periodDays = Math.max(1, parseInt(url.searchParams.get('period') ?? '30', 10) || 30)

  const now = new Date()
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
  const periodStart = new Date(now.getTime() - periodDays * 86_400_000)

  // Runs a query and returns { data, count }, swallowing errors so one bad
  // query never blanks out the whole dashboard.
  const safe = async (q: PromiseLike<{ data: any; count?: number | null; error?: any }>) => {
    try {
      const r = await q
      if (r.error) console.error('[CC ANALYTICS] query error:', r.error.message)
      return { data: r.data ?? null, count: r.count ?? null }
    } catch (err) {
      console.error('[CC ANALYTICS] query threw:', err)
      return { data: null, count: null }
    }
  }

  const [
    totalUsersRes,
    newUsersRes,
    activeTodayRes,
    subsRes,
    aiUsageRes,
    postsTodayRes,
    marketplaceRes,
    revenueHistoryRes,
    agentsRes,
    unresolvedSecRes,
    pendingDecisionsRes,
    activeWorkflowsRes,
    recentReportsRes,
    goalsRes,
    recentSignupsRes,
    recentSecurityEventsRes,
  ] = await Promise.all([
    safe(db.from('profiles').select('*', { count: 'exact', head: true })),
    safe(db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', periodStart.toISOString())),
    safe(db.from('profiles').select('*', { count: 'exact', head: true }).gte('last_active_at', startOfToday.toISOString())),
    safe(db.from('subscriptions').select('plan').eq('status', 'active')),
    safe(db.from('ai_usage_logs').select('query_count').gte('created_at', startOfToday.toISOString())),
    safe(db.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', startOfToday.toISOString())),
    safe(db.from('marketplace_orders').select('total').eq('status', 'completed').gte('created_at', periodStart.toISOString())),
    safe(db.from('revenue_metrics').select('date, mrr, arr').order('date', { ascending: false }).limit(periodDays)),
    safe(db.from('agents').select('name, status, total_tasks_completed, last_active_at').eq('is_active', true).order('name')),
    safe(db.from('security_events').select('*', { count: 'exact', head: true }).eq('is_resolved', false).in('severity', ['high', 'critical'])),
    safe(db.from('agent_decisions').select('*', { count: 'exact', head: true }).eq('requires_approval', true).is('approved_at', null).eq('is_executed', false)),
    safe(db.from('agent_workflows').select('*', { count: 'exact', head: true }).in('status', ['running', 'in_progress'])),
    safe(db.from('agent_reports').select('*', { count: 'exact', head: true }).gte('created_at', periodStart.toISOString())),
    safe(db.from('company_goals').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(10)),
    safe(db.from('profiles').select('id, email, display_name, username, avatar_url, created_at').order('created_at', { ascending: false }).limit(10)),
    safe(db.from('security_events').select('*').order('created_at', { ascending: false }).limit(10)),
  ])

  // ── Subscription plan breakdown ─────────────────────────────
  const subArr = (subsRes.data as any[]) ?? []
  const bd = {
    free:  subArr.filter((s: any) => s.plan === 'free').length,
    pro:   subArr.filter((s: any) => s.plan === 'pro').length,
    plus:  subArr.filter((s: any) => s.plan === 'plus').length,
    elite: subArr.filter((s: any) => s.plan === 'elite').length,
  }
  const activeSubscriptions = bd.pro + bd.plus + bd.elite
  const totalUsers = totalUsersRes.count ?? 0
  const freeUsers = Math.max(0, totalUsers - activeSubscriptions)

  // ── Revenue ──────────────────────────────────────────────────
  const revHistory = ((revenueHistoryRes.data as any[]) ?? []).slice().reverse()
  const latestMetric = revHistory[revHistory.length - 1]
  const oldestMetric = revHistory[0]
  const fallbackMrr = bd.pro * 19 + bd.plus * 39 + bd.elite * 79
  const mrr = latestMetric?.mrr ?? fallbackMrr
  const arr = latestMetric?.arr ?? mrr * 12
  const growthPct = oldestMetric?.mrr && oldestMetric.mrr > 0
    ? ((mrr - oldestMetric.mrr) / oldestMetric.mrr) * 100
    : 0

  const revenueHistory = revHistory.length > 0
    ? revHistory.map((r: any) => ({ date: r.date, mrr: r.mrr ?? 0, arr: r.arr ?? 0 }))
    : Array.from({ length: periodDays }, (_, i) => ({
        date: new Date(now.getTime() - (periodDays - 1 - i) * 86_400_000).toISOString(),
        mrr, arr,
      }))

  const marketplaceRevenuePeriod = ((marketplaceRes.data as any[]) ?? [])
    .reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0)

  const aiTotal = ((aiUsageRes.data as any[]) ?? [])
    .reduce((s: number, u: any) => s + (u.query_count ?? 0), 0)

  // ── Agents ───────────────────────────────────────────────────
  const AGENT_NAMES = ['jarvis', 'athena', 'orion', 'titan', 'phoenix', 'merlin', 'sentinel']
  const agentRows = (agentsRes.data as any[]) ?? []
  const agents = AGENT_NAMES.map(name => {
    const row = agentRows.find((a: any) => a.name === name)
    return {
      name,
      status: row?.status ?? 'offline',
      total_tasks_completed: row?.total_tasks_completed ?? 0,
      last_active_at: row?.last_active_at ?? null,
    }
  })

  return new NextResponse(JSON.stringify({
    success: true,
    data: {
      revenue: { mrr, arr, growth_pct: growthPct, marketplace_revenue: marketplaceRevenuePeriod },
      revenue_history: revenueHistory,
      subscription_metrics: bd,
      platform_stats: {
        total_users: totalUsers,
        new_users_period: newUsersRes.count ?? 0,
        active_users_today: activeTodayRes.count ?? 0,
        active_subscriptions: activeSubscriptions,
        free_users: freeUsers,
        pro_users: bd.pro,
        plus_users: bd.plus,
        elite_users: bd.elite,
        ai_queries_today: aiTotal,
        community_posts_today: postsTodayRes.count ?? 0,
        marketplace_revenue_period: marketplaceRevenuePeriod,
      },
      agents,
      pending_decisions: [],
      recent_reports: [],
      company_goals: goalsRes.data ?? [],
      recent_signups: recentSignupsRes.data ?? [],
      recent_security_events: recentSecurityEventsRes.data ?? [],
      system_health: {
        unresolved_security_events: unresolvedSecRes.count ?? 0,
        pending_decisions: pendingDecisionsRes.count ?? 0,
        active_workflows: activeWorkflowsRes.count ?? 0,
        recent_reports: recentReportsRes.count ?? 0,
        last_checked_at: new Date().toISOString(),
      },
    },
  }), { status: 200, headers: cors })
}

export async function OPTIONS(req: NextRequest) {
  const requestOrigin = req.headers.get('origin')
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : (ALLOWED_ORIGINS[0] ?? '')
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age':       '86400',
    },
  })
}
