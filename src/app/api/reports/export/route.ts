// src/app/api/reports/export/route.ts
//
// Security model for this route:
//  1. The caller must already have a valid Finora session — either a
//     cookie-based session (web) or a Bearer access token (mobile app).
//  2. Before generating anything, the password submitted with the request is
//     verified against Supabase Auth itself (the same password grant used at
//     sign-in) — we never read or store a user's password anywhere; we can
//     only confirm it's correct at the moment it's typed.
//  3. That verified password is used purely as the in-memory encryption key
//     for the generated file, then discarded. It is never written to a log,
//     a database row, or disk.
//  4. Repeated failed attempts are rate-limited using the same security_events
//     table the rest of the platform already logs to.

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getReportData } from '@/lib/reports/getReportData'
import { buildPdfReport } from '@/lib/reports/pdfReport'
import { buildExcelReport } from '@/lib/reports/excelReport'

export const runtime = 'nodejs'

const MAX_ATTEMPTS = 5
const WINDOW_MINUTES = 15

// Same allowlist pattern already used correctly in src/middleware.ts —
// previously this reflected any Origin header verbatim while also allowing
// credentials, which is a real CORS misconfiguration (Engineering Audit H-1).
// Non-browser callers (e.g. the mobile app's Bearer-token fetch) aren't
// subject to CORS at all, so this only tightens browser-based access.
const ALLOWED_ORIGINS = [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_ADMIN_URL].filter(
  (v): v is string => Boolean(v)
)

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin ?? '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

// Resolves the caller's identity from either a cookie session (web) or a
// `Authorization: Bearer <token>` header (mobile), returning a Supabase
// client scoped to that user so RLS applies identically either way.
async function resolveAuthedClient(req: NextRequest): Promise<{ supabase: SupabaseClient; userId: string; email: string } | null> {
  const authHeader = req.headers.get('authorization')

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) return null

    const bearerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user } } = await bearerClient.auth.getUser(token)
    if (!user?.email) return null
    return { supabase: bearerClient, userId: user.id, email: user.email }
  }

  // Fall back to the cookie-based web session
  const cookieClient = await createServerSupabaseClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  if (!user?.email) return null
  return { supabase: cookieClient, userId: user.id, email: user.email }
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'))

  let body: { format?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400, headers: cors })
  }

  const format = body.format === 'xlsx' ? 'xlsx' : body.format === 'pdf' ? 'pdf' : null
  const password = typeof body.password === 'string' ? body.password : ''

  if (!format) return NextResponse.json({ success: false, error: 'format must be "pdf" or "xlsx"' }, { status: 400, headers: cors })
  if (!password) return NextResponse.json({ success: false, error: 'Password is required to protect the exported file.' }, { status: 400, headers: cors })

  const auth = await resolveAuthedClient(req)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Not signed in.' }, { status: 401, headers: cors })
  }
  const { supabase, userId, email } = auth

  // ── Rate limit repeated password guesses ─────────────────────
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()
  const { count: recentFailures } = await supabase
    .from('security_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', 'report_export_auth_failed')
    .gte('created_at', windowStart)

  if ((recentFailures ?? 0) >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { success: false, error: `Too many incorrect attempts. Try again in ${WINDOW_MINUTES} minutes.` },
      { status: 429, headers: cors }
    )
  }

  // ── Verify the submitted password is the user's real login password ──
  // This calls Supabase Auth's own password grant — the exact check used at
  // sign-in — so we confirm correctness without ever persisting the password.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ success: false, error: 'Server misconfigured.' }, { status: 500, headers: cors })
  }

  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ email, password }),
  })

  if (!verifyRes.ok) {
    await supabase.from('security_events').insert({
      user_id: userId,
      event_type: 'report_export_auth_failed',
      severity: 'low',
      description: 'Incorrect password entered while exporting a report',
    })
    return NextResponse.json({ success: false, error: 'That password is incorrect.' }, { status: 401, headers: cors })
  }

  // ── Password confirmed — build the report ─────────────────────
  try {
    const data = await getReportData(supabase, userId)

    if (format === 'pdf') {
      const pdfBuffer = await buildPdfReport(data, password)
      await logExport(supabase, userId, 'pdf')
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          ...cors,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Finora-Report-${dateStamp()}.pdf"`,
        },
      })
    } else {
      const xlsxBuffer = await buildExcelReport(data, password)
      await logExport(supabase, userId, 'xlsx')
      return new NextResponse(new Uint8Array(xlsxBuffer), {
        status: 200,
        headers: {
          ...cors,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Finora-Report-${dateStamp()}.xlsx"`,
        },
      })
    }
  } catch (err) {
    console.error('[reports/export] failed to build report:', err)
    return NextResponse.json({ success: false, error: 'Could not generate the report. Please try again.' }, { status: 500, headers: cors })
  }
}

async function logExport(supabase: SupabaseClient, userId: string, format: 'pdf' | 'xlsx') {
  try {
    await supabase.from('security_events').insert({
      user_id: userId,
      event_type: 'report_exported',
      severity: 'low',
      description: `Exported a password-protected ${format.toUpperCase()} financial report`,
    })
  } catch {
    // Non-critical — never block a successful export over an audit-log write failing
  }
}

function dateStamp() {
  return new Date().toISOString().split('T')[0]
}
