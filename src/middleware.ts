import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken } from '@/lib/security/bearer'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// ============================================================
// FINORA — Unified Middleware (merged frontend + backend)
// ============================================================
// This app used to be two separate Next.js apps (wealthos-ui on
// one port, wealthos backend on another) that talked to each
// other over HTTP/CORS. They are now one app, one origin, one
// session. This middleware merges both apps' previous middleware:
//   - wealthos-ui's setup guard + auth redirects
//   - wealthos backend's rate limiting, CORS (kept for any
//     external caller — e.g. a separate admin panel or mobile
//     app that still calls this API cross-origin), and
//     API-route auth gate.
// ============================================================

// ── PAGE ROUTES THAT REQUIRE A LOGGED-IN USER ────────────────
const PROTECTED_PAGE_PATHS = [
  '/dashboard', '/portfolio', '/goals', '/net-worth', '/budgeting', '/performance', '/simulator',
  '/ai-coach', '/learning', '/community', '/research',
  '/marketplace/checkout', '/library', '/creator', '/settings',
  '/billing', '/notifications', '/onboarding',
]

// ── API ROUTES THAT REQUIRE A LOGGED-IN USER ─────────────────
// (Everything else under /api is either public — auth, contact,
// webhooks — or checks auth itself, like /api/admin/*.)
const PROTECTED_API_PATHS = [
  '/api/users', '/api/profiles', '/api/subscriptions', '/api/billing',
  '/api/portfolio', '/api/goals', '/api/net-worth', '/api/budgeting',
  '/api/ai-coach', '/api/learning', '/api/community', '/api/research',
  '/api/marketplace/checkout', '/api/notifications', '/api/insights',
  '/api/financial-health', '/api/dashboard', '/api/library',
  '/api/settings', '/api/onboarding', '/api/analytics',
]

// /api/admin/* (including the founder-only /api/admin/cc/vault) does its
// own Bearer-token-or-cookie auth + role check inside each route handler
// via withAdmin()/withFounder() in src/lib/security/rbac.ts. It is
// intentionally NOT cookie-gated here, so it still works if ever called
// cross-origin from a separate admin panel.
const ADMIN_API_PATHS = ['/api/admin']

const AUTH_PAGE_PATHS = ['/signin', '/signup', '/reset-password']

// ── IN-MEMORY RATE LIMITER (per server instance) ─────────────
const ipHits = new Map<string, { count: number; resetAt: number }>()

function rateLimitCheck(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const hit = ipHits.get(ip)
  if (!hit || now > hit.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (hit.count >= limit) return false
  hit.count++
  return true
}

// ── CORS (kept for any external caller — same-origin requests from ──
// ── this app's own pages never need it, but a separate admin panel ──
// ── or mobile client hitting this API directly still will) ──────────
function getCorsHeaders(origin: string): Record<string, string> {
  const isDev = process.env.NODE_ENV !== 'production'
  const configured = [
    process.env.NEXT_PUBLIC_ADMIN_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean) as string[]
  const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
                      /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
  const isAllowed = configured.includes(origin) || (isDev && isLocalhost)
  const allowOrigin = isAllowed ? origin : (configured[0] ?? '')

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

// ── MAINTENANCE MODE ──────────────────────────────────────────
// Controlled from the founder app (System Config), stored as a
// system_config row with key 'maintenance_mode'. Cached briefly
// so normal traffic (maintenance mode off, the 99.9% case) never
// pays for an extra DB round-trip per request — only the rare
// window where maintenance is actually active does the extra
// per-user admin-role check.
let maintenanceCache: { enabled: boolean; message: string; checkedAt: number } | null = null
const MAINTENANCE_CACHE_TTL_MS = 20_000

async function getMaintenanceStatus(supabaseUrl: string, anonKey: string) {
  const now = Date.now()
  if (maintenanceCache && now - maintenanceCache.checkedAt < MAINTENANCE_CACHE_TTL_MS) {
    return maintenanceCache
  }
  try {
    // Reads via the anon key — safe because system_config's RLS policy
    // only exposes rows where is_public = true to non-admins, and the
    // maintenance_mode row is deliberately marked public for this reason.
    const res = await fetch(`${supabaseUrl}/rest/v1/system_config?key=eq.maintenance_mode&select=value`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(2000),
    })
    const rows = await res.json().catch(() => [])
    const value = rows?.[0]?.value ?? { enabled: false, message: '' }
    maintenanceCache = { enabled: !!value.enabled, message: value.message ?? '', checkedAt: now }
  } catch {
    // If the check itself fails, fail OPEN (site stays up) rather than
    // accidentally locking everyone out due to a transient network blip.
    maintenanceCache = { enabled: false, message: '', checkedAt: now }
  }
  return maintenanceCache
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next()
  }

  const origin = request.headers.get('origin') ?? ''
  const isApi = pathname.startsWith('/api/')

  // ── CORS preflight for API routes ──────────────────────────
  if (request.method === 'OPTIONS' && isApi) {
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) })
  }

  // ── Rate limiting for API routes ───────────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  if (isApi) {
    const isSensitive = pathname.startsWith('/api/auth') || pathname.startsWith('/api/webhooks')
    const allowed = isSensitive
      ? rateLimitCheck(ip, 30, 60_000)
      : rateLimitCheck(ip, 200, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', code: 'RATE_LIMITED' },
        { status: 429, headers: getCorsHeaders(origin) }
      )
    }
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // ── GUARD: if env vars aren't configured yet, redirect to a setup page ──
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY ||
      SUPABASE_URL === 'your-supabase-url' ||
      SUPABASE_URL.includes('your-project') ||
      SUPABASE_ANON_KEY === 'your-anon-key') {
    if (pathname === '/setup' || isApi) {
      return NextResponse.next()
    }
    const url = request.nextUrl.clone()
    url.pathname = '/setup'
    return NextResponse.redirect(url)
  }

  let response = NextResponse.next({ request })
  if (isApi) {
    const corsHeaders = getCorsHeaders(origin)
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v))
  }

  try {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          if (isApi) {
            const corsHeaders = getCorsHeaders(origin)
            Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v))
          }
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    })

    // Native/mobile and other external clients authenticate with a Bearer token and send no
    // cookies. For API requests that carry one, validate that token; otherwise use the cookie
    // session (the website's own same-origin requests). An invalid token is NOT silently
    // upgraded to a cookie session, so it is rejected like any other unauthenticated call.
    const bearerToken = isApi ? extractBearerToken(request.headers.get('authorization')) : null
    const { data: { user } } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser()

    // ── MAINTENANCE MODE ────────────────────────────────────
    // Admin API routes and the maintenance page itself are always
    // exempt (founders need working admin tools during an incident,
    // and the maintenance page can't redirect to itself).
    if (!ADMIN_API_PATHS.some(p => pathname.startsWith(p)) && pathname !== '/maintenance') {
      const maintenance = await getMaintenanceStatus(SUPABASE_URL, SUPABASE_ANON_KEY)
      if (maintenance.enabled) {
        let isAdmin = false
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
          isAdmin = ['admin', 'super_admin', 'founder'].includes(profile?.role ?? '')
        }
        if (!isAdmin) {
          if (isApi) {
            return NextResponse.json(
              { success: false, error: maintenance.message || 'Finora is temporarily down for maintenance.', code: 'MAINTENANCE_MODE' },
              { status: 503, headers: getCorsHeaders(origin) }
            )
          }
          const url = request.nextUrl.clone()
          url.pathname = '/maintenance'
          return NextResponse.redirect(url)
        }
      }
    }

    // Admin/founder API routes: pass through — the route handler itself
    // verifies the Bearer token or cookie session and checks the role.
    if (ADMIN_API_PATHS.some(p => pathname.startsWith(p))) {
      return response
    }

    const isProtectedPage = PROTECTED_PAGE_PATHS.some(p => pathname.startsWith(p))
    const isProtectedApi  = PROTECTED_API_PATHS.some(p => pathname.startsWith(p))
    const isAuthPage      = AUTH_PAGE_PATHS.some(p => pathname.startsWith(p))

    if (!user && (isProtectedPage || isProtectedApi)) {
      if (isApi) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' },
          { status: 401, headers: getCorsHeaders(origin) }
        )
      }
      const url = request.nextUrl.clone()
      url.pathname = '/signin'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    if (isAuthPage && user) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  } catch (err) {
    // Never let a Supabase error crash the entire middleware
    console.error('[Middleware] Auth check failed:', err)
    const isProtectedPage = PROTECTED_PAGE_PATHS.some(p => pathname.startsWith(p))
    if (isProtectedPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/signin'
      return NextResponse.redirect(url)
    }
  }

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
