// src/app/api/account/delete/route.ts
//
// Security model, matching the pattern already established for report export:
//  1. Requires an active session (cookie-based).
//  2. Requires the user to type their real password, verified against
//     Supabase Auth's own password grant — never stored, used once.
//  3. Requires typing the literal word "DELETE" as a second, distinct
//     confirmation — this is a permanent, irreversible action.
//  4. Repeated failed password attempts are rate-limited via security_events,
//     same as report export.
//  5. Deletion goes through the Supabase Admin API (service role — the one
//     place in this app that uses it), which removes the auth.users row.
//     Every table in the schema that stores a user's data references
//     profiles(id) with ON DELETE CASCADE, and profiles.id itself references
//     auth.users(id) ON DELETE CASCADE — so this one call cleanly removes
//     the account and everything it owns, with no orphaned rows.

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/security/rbac'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

const MAX_ATTEMPTS = 5
const WINDOW_MINUTES = 15

export async function POST(req: NextRequest) {
  let body: { password?: string; confirmation?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const password = typeof body.password === 'string' ? body.password : ''
  const confirmation = typeof body.confirmation === 'string' ? body.confirmation : ''

  if (confirmation !== 'DELETE') {
    return NextResponse.json({ success: false, error: 'Please type DELETE to confirm.' }, { status: 400 })
  }
  if (!password) {
    return NextResponse.json({ success: false, error: 'Password is required.' }, { status: 400 })
  }

  // Accepts a Bearer token (mobile) or the cookie session (website).
  const user = await getUserFromRequest(req)
  if (!user || !user.email) {
    return NextResponse.json({ success: false, error: 'Not signed in.' }, { status: 401 })
  }

  // Service-role client: a Bearer-only (mobile) request has no cookie session, so a user-bound
  // client would be anonymous under RLS and silently disable the rate limit below. Every query
  // here is explicitly scoped to user.id, so the behaviour matches the cookie path exactly.
  const admin = createServiceRoleClient()

  // ── Rate limit repeated password guesses ─────────────────────
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()
  const { count: recentFailures } = await admin
    .from('security_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('event_type', 'account_deletion_auth_failed')
    .gte('created_at', windowStart)

  if ((recentFailures ?? 0) >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { success: false, error: `Too many incorrect attempts. Try again in ${WINDOW_MINUTES} minutes.` },
      { status: 429 }
    )
  }

  // ── Verify the submitted password is the user's real login password ──
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ success: false, error: 'Server misconfigured.' }, { status: 500 })
  }

  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ email: user.email, password }),
  })

  if (!verifyRes.ok) {
    await admin.from('security_events').insert({
      user_id: user.id,
      event_type: 'account_deletion_auth_failed',
      severity: 'medium',
      description: 'Incorrect password entered while attempting account deletion',
    })
    return NextResponse.json({ success: false, error: 'That password is incorrect.' }, { status: 401 })
  }

  // ── Password + confirmation verified — delete the account ─────
  try {
    // Log intent before deleting — user_id will be SET NULL by the FK once
    // the account is gone, so we capture the email now for the audit trail.
    await admin.from('security_events').insert({
      user_id: user.id,
      event_type: 'account_deleted',
      severity: 'medium',
      description: `Account permanently deleted by user request (${user.email})`,
      metadata: { email: user.email },
    })

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) {
      console.error('[account/delete] admin.deleteUser failed:', deleteError)
      return NextResponse.json({ success: false, error: 'Could not delete your account. Please contact support.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[account/delete] unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Could not delete your account. Please contact support.' }, { status: 500 })
  }
}
