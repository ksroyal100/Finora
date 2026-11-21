// ============================================================
// FINORA — Supabase Server Clients
// Supports both cookie-based auth (same-origin) and
// Bearer token auth (cross-origin, e.g. separate UI app)
// ============================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'

// ── SERVER CLIENT (uses cookie session) ──────────────────────

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        }
      }
    }
  )
}

// ── ADMIN CLIENT (bypasses RLS — server use only) ────────────

export function createAdminClient() {
  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// ── GET AUTHENTICATED USER (cookie OR Bearer token) ──────────
// This allows the separate UI app to authenticate by passing
// the Supabase JWT in the Authorization header.

export async function getServerUser() {
  // 1. Try Bearer token from Authorization header (cross-origin UI)
  try {
    const headersList = await headers()
    const authorization = headersList.get('authorization')
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice(7)
      const admin = createAdminClient()
      const { data: { user }, error } = await admin.auth.getUser(token)
      if (!error && user) return user
    }
  } catch {}

  // 2. Fall back to cookie-based session (same-origin)
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (!error && user) return user
  } catch {}

  return null
}

// ── GET USER WITH PROFILE ─────────────────────────────────────

export async function getServerUserWithProfile() {
  const user = await getServerUser()
  if (!user) return { user: null, profile: null }

  const supabase = await createServerSupabaseClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, subscriptions(*)')
    .eq('id', user.id)
    .single()

  return { user, profile }
}

// ── REQUIRE AUTH (throws if not authenticated) ────────────────

export async function requireAuth() {
  const user = await getServerUser()
  if (!user) throw new Error('UNAUTHORIZED')
  return user
}

// ── REQUIRE ADMIN ─────────────────────────────────────────────

export async function requireAdmin() {
  const user = await getServerUser()
  if (!user) throw new Error('UNAUTHORIZED')

  const supabase = await createServerSupabaseClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin', 'founder'].includes(profile.role)) {
    throw new Error('FORBIDDEN')
  }

  return { user, role: profile.role }
}

// ── REQUIRE FOUNDER ───────────────────────────────────────────

export async function requireFounder() {
  const user = await getServerUser()
  if (!user) throw new Error('UNAUTHORIZED')

  const admin = createAdminClient()
  const { data: adminUser } = await admin
    .from('admin_users')
    .select('is_founder, is_active')
    .eq('id', user.id)
    .single()

  if (!adminUser?.is_founder || !adminUser.is_active) {
    throw new Error('FORBIDDEN')
  }

  return user
}

// ── Back-compat alias ──────────────────────────────────────────
// The pre-merge frontend's server.ts exported `getUser`; kept as an alias
// of getServerUser() so no call site needs to change after the merge.
export const getUser = getServerUser
