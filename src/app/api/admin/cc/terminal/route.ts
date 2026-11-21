import { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/security/rbac'
import { buildTerminalSnapshot } from '@/lib/admin-terminal/data'

export const runtime = 'nodejs'
export const maxDuration = 30

// ============================================================
// GET /api/admin/cc/terminal
//   ?fresh=1          bypass the plain TTL (the terminal always sends this)
//   &since=<ISO|ms>   commit time of the database change that triggered the call;
//                     the server will only reuse a cache computed after it
//
// One compact snapshot for the admin Command Terminal (/cc/terminal). The terminal
// does NOT poll: it loads once, then calls this again only when Supabase Realtime
// reports a change (or on manual refresh / reconnect). See lib/admin-terminal/data.ts
// for the freshness-aware, single-flight cache that lets several admins share one
// recompute. Auth: withAdmin (valid session/Bearer + active admin_users row).
// ============================================================
function parseSince(raw: string | null): number | null {
  if (!raw) return null
  const ms = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw)
  if (!Number.isFinite(ms)) return null
  // A timestamp from the future (skewed client) must not force endless recomputes.
  return Math.min(ms, Date.now())
}

export const GET = withAdmin(async (req: NextRequest) => {
  const url = new URL(req.url)
  const fresh = url.searchParams.get('fresh') === '1'
  const sinceMs = parseSince(url.searchParams.get('since'))
  try {
    return apiSuccess(await buildTerminalSnapshot({ fresh: fresh || sinceMs !== null, sinceMs }))
  } catch (err) {
    console.error('[admin terminal] failed:', err)
    return apiError(err instanceof Error ? err.message : 'Failed to build terminal snapshot', 500, 'TERMINAL_FAILED')
  }
})
