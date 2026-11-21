import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerUser } from '@/lib/supabase/server'

// ── Types ─────────────────────────────────────────────────────
export type UserRole = 'user' | 'creator' | 'moderator' | 'admin' | 'super_admin' | 'founder'

// ── Admin Supabase client (service role — bypasses RLS) ───────
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Standard API response helpers ─────────────────────────────
export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function apiError(message: string, status = 400, code?: string) {
  return NextResponse.json({ success: false, error: message, code }, { status })
}

// ── PostgREST filter-string sanitizer ──────────────────────────
// PostgREST's .or()/.filter() methods parse a raw string DSL where `,`
// separates conditions and `(` `)` group them. Interpolating user input
// directly (e.g. a search box value) into that string lets a crafted value
// inject additional filter clauses PostgREST will honor as real conditions
// (Engineering Audit H-2). This strips the characters that have special
// meaning in that DSL — safe for search-box text, where a literal comma or
// parenthesis in a name search isn't a meaningful use case to preserve.
export function sanitizeFilterInput(value: string): string {
  return value.replace(/[,()]/g, '')
}

// ── Pagination helper ──────────────────────────────────────────
// Reads `page` and `per_page` (or `perPage`) query params off the request
// and returns the offsets Supabase's `.range(from, to)` expects.
export function getPagination(req: NextRequest, defaultPerPage = 20) {
  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const perPage = Math.max(
    1,
    parseInt(url.searchParams.get('per_page') ?? url.searchParams.get('perPage') ?? String(defaultPerPage), 10) ||
      defaultPerPage
  )
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  return { page, perPage, from, to }
}

// ── Paginated success response helper ──────────────────────────
export function apiPaginated(data: unknown[], total: number, page: number, perPage: number, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      total,
      page,
      per_page: perPage,
      total_pages: perPage > 0 ? Math.ceil(total / perPage) : 0,
    },
    { status }
  )
}

// ── Audit log writer ────────────────────────────────────────────
// Fire-and-forget insert into audit_logs. Never throws — a logging
// failure should never break the admin action that triggered it.
export async function createAuditLog(params: {
  adminId?: string
  userId?: string
  action: string
  resourceType?: string
  resourceId?: string
  oldData?: unknown
  newData?: unknown
  metadata?: Record<string, unknown>
}) {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('audit_logs').insert({
      admin_id: params.adminId ?? null,
      user_id: params.userId ?? null,
      action: params.action,
      resource_type: params.resourceType ?? null,
      resource_id: params.resourceId ?? null,
      old_data: params.oldData ?? null,
      new_data: params.newData ?? null,
      metadata: params.metadata ?? {},
    })
    if (error) console.error('[createAuditLog] insert error:', error.message)
  } catch (err) {
    console.error('[createAuditLog] failed:', err)
  }
}

// ── Rate limiter (simple in-memory) ──────────────────────────
const rateLimits = new Map<string, { count: number; reset: number }>()

export function checkRateLimit(ip: string, key: string, limit = 60, windowMs = 60_000) {
  const id  = `${key}:${ip}`
  const now = Date.now()
  const hit = rateLimits.get(id)
  if (!hit || now > hit.reset) {
    rateLimits.set(id, { count: 1, reset: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }
  if (hit.count >= limit) return { allowed: false, remaining: 0 }
  hit.count++
  return { allowed: true, remaining: limit - hit.count }
}

export function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

// ── getUserFromRequest ────────────────────────────────────────
// Tries Bearer token first (for any external caller, e.g. a separate
// admin panel or mobile app), then falls back to cookie-based session
// (the normal path for this app's own same-origin requests).

export async function getUserFromRequest(req: NextRequest) {
  // 1. Bearer token from Authorization header
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token) {
      // Use service-role client to verify the JWT — it can validate any user's token
      const admin = createAdminClient()
      const { data: { user }, error } = await admin.auth.getUser(token)
      if (user && !error) return user
    }
  }

  // 2. Cookie session (same-origin requests)
  try {
    return await getServerUser()
  } catch {
    return null
  }
}

// ── withAuth ──────────────────────────────────────────────────
export function withAuth(
  handler: (req: NextRequest, ctx: { userId: string; role: UserRole }) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      const ip        = getClientIP(req)
      const rateLimit = checkRateLimit(ip, 'api')
      if (!rateLimit.allowed) return apiError('Rate limit exceeded', 429, 'RATE_LIMITED')

      const user = await getUserFromRequest(req)
      if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

      const admin = createAdminClient()
      const { data: profile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      return handler(req, {
        userId: user.id,
        role:   (profile?.role ?? 'user') as UserRole,
      })
    } catch (err) {
      console.error('[withAuth] error:', err)
      return apiError('Internal server error', 500, 'INTERNAL_ERROR')
    }
  }
}

// ── withAdmin ─────────────────────────────────────────────────
// Checks:
//   1. Valid auth (Bearer token OR cookie)
//   2. profiles.role in ('admin', 'super_admin', 'founder')
//   3. admin_users row exists and is_active = true

export function withAdmin(
  handler: (
    req: NextRequest,
    ctx: { userId: string; role: UserRole; adminRole: string; isFounder: boolean }
  ) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      const ip        = getClientIP(req)
      const rateLimit = checkRateLimit(ip, 'admin', 30, 60_000)
      if (!rateLimit.allowed) return apiError('Rate limit exceeded', 429, 'RATE_LIMITED')

      // ── Step 1: get user (Bearer token OR cookie) ───────────
      const user = await getUserFromRequest(req)
      if (!user) {
        return apiError('Unauthorized — no valid session or Bearer token', 401, 'UNAUTHORIZED')
      }

      const admin = createAdminClient()

      // ── Step 2: check profile role ──────────────────────────
      const { data: profile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || !['admin', 'super_admin', 'founder'].includes(profile.role ?? '')) {
        return apiError(
          'Forbidden — your account does not have admin privileges. ' +
          'Run admin_user_setup.sql in Supabase SQL Editor.',
          403,
          'FORBIDDEN'
        )
      }

      // ── Step 3: check admin_users table ─────────────────────
      const { data: adminUser } = await admin
        .from('admin_users')
        .select('admin_role, is_founder, is_active')
        .eq('id', user.id)
        .single()

      if (!adminUser) {
        return apiError(
          'Forbidden — no admin_users row found. Run admin_user_setup.sql.',
          403,
          'FORBIDDEN'
        )
      }

      if (!adminUser.is_active) {
        return apiError('Forbidden — admin account is deactivated.', 403, 'FORBIDDEN')
      }

      return handler(req, {
        userId:    user.id,
        role:      profile.role as UserRole,
        adminRole: adminUser.admin_role ?? 'admin',
        isFounder: adminUser.is_founder ?? false,
      })
    } catch (err) {
      console.error('[withAdmin] error:', err)
      return apiError('Internal server error', 500, 'INTERNAL_ERROR')
    }
  }
}

// ── Security event logger ───────────────────────────────────────
// Fire-and-forget insert into security_events. Never throws.
export async function logSecurityEvent(params: {
  userId?: string
  eventType: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  description?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}) {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('security_events').insert({
      user_id: params.userId ?? null,
      event_type: params.eventType,
      severity: params.severity ?? 'low',
      description: params.description ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      metadata: params.metadata ?? {},
    })
    if (error) console.error('[logSecurityEvent] insert error:', error.message)
  } catch (err) {
    console.error('[logSecurityEvent] failed:', err)
  }
}

// ── requirePlan ───────────────────────────────────────────────
// Gates a route behind a minimum subscription plan tier.
const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, plus: 2, elite: 3 }

export function requirePlan(
  minPlan: 'free' | 'pro' | 'plus' | 'elite',
  handler: (req: NextRequest, ctx: { userId: string; role: UserRole; plan: string }) => Promise<NextResponse>
) {
  return withAuth(async (req, { userId, role }) => {
    try {
      const admin = createAdminClient()
      const { data: sub } = await admin
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      const plan = sub?.plan ?? 'free'
      if ((PLAN_RANK[plan] ?? 0) < (PLAN_RANK[minPlan] ?? 0)) {
        return apiError(`This feature requires the ${minPlan} plan or higher.`, 403, 'PLAN_REQUIRED')
      }

      return handler(req, { userId, role, plan })
    } catch (err) {
      console.error('[requirePlan] error:', err)
      return apiError('Internal server error', 500, 'INTERNAL_ERROR')
    }
  })
}

// ── withFounder ───────────────────────────────────────────────
export function withFounder(
  handler: (req: NextRequest, ctx: { userId: string }) => Promise<NextResponse>
) {
  return withAdmin(async (req, ctx) => {
    if (!ctx.isFounder && ctx.adminRole !== 'super_admin') {
      return apiError('Founder-only endpoint', 403, 'FORBIDDEN')
    }
    return handler(req, { userId: ctx.userId })
  })
}
