import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'

// POST /api/net-worth/snapshot — trigger manual snapshot
export const POST = withAuth(async (req, { userId }) => {
  const db = createAdminClient()
  await db.rpc('auto_net_worth_snapshot', { p_user_id: userId })

  const { data } = await db
    .from('net_worth_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  return apiSuccess({ snapshot: data, created_at: new Date().toISOString() })
})

// GET /api/net-worth/snapshot — get snapshot history
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const months = parseInt(url.searchParams.get('months') ?? '12')
  const db = createAdminClient()

  const { data, error } = await db
    .from('net_worth_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })
    .limit(Math.min(months, 36))

  if (error) return apiError(error.message, 500)

  const snapshots = (data ?? []).reverse()
  const current = snapshots[snapshots.length - 1]
  const first = snapshots[0]

  const totalGrowth = first && current && first.net_worth !== 0
    ? ((current.net_worth - first.net_worth) / Math.abs(first.net_worth)) * 100
    : 0

  return apiSuccess({
    snapshots,
    current_net_worth: current?.net_worth ?? 0,
    total_growth_pct: totalGrowth,
    period_months: months,
  })
})
