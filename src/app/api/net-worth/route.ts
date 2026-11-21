import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { z } from 'zod'

const assetSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['cash', 'investment', 'real_estate', 'business', 'vehicle', 'personal', 'retirement', 'crypto', 'other']),
  value: z.number().min(0),
  currency: z.string().length(3).default('USD'),
  institution: z.string().max(200).optional(),
  account_number_last4: z.string().max(4).optional(),
  notes: z.string().max(500).optional(),
  last_valued_at: z.string().optional(),
})

const liabilitySchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['mortgage', 'auto_loan', 'student_loan', 'credit_card', 'personal_loan', 'medical', 'tax', 'other']),
  balance: z.number().min(0),
  original_amount: z.number().min(0).optional(),
  interest_rate: z.number().min(0).max(100).default(0),
  minimum_payment: z.number().min(0).default(0),
  currency: z.string().length(3).default('USD'),
  institution: z.string().max(200).optional(),
  due_date: z.string().optional(),
  notes: z.string().max(500).optional(),
})

// GET /api/net-worth — full net worth picture
export const GET = withAuth(async (req, { userId }) => {
  const db = createAdminClient()
  const url = new URL(req.url)
  const historyMonths = parseInt(url.searchParams.get('months') ?? '12')

  const [
    { data: assets },
    { data: liabilities },
    { data: snapshots },
  ] = await Promise.all([
    db.from('assets').select('*').eq('user_id', userId).eq('is_active', true).order('value', { ascending: false }),
    db.from('liabilities').select('*').eq('user_id', userId).eq('is_active', true).order('balance', { ascending: false }),
    db.from('net_worth_snapshots').select('*').eq('user_id', userId).order('snapshot_date', { ascending: false }).limit(historyMonths),
  ])

  const totalAssets = (assets ?? []).reduce((sum, a) => sum + a.value, 0)
  const totalLiabilities = (liabilities ?? []).reduce((sum, l) => sum + l.balance, 0)
  const netWorth = totalAssets - totalLiabilities

  // Asset breakdown by type
  const assetsByType = (assets ?? []).reduce((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + a.value
    return acc
  }, {} as Record<string, number>)

  // Liability breakdown by type
  const liabilitiesByType = (liabilities ?? []).reduce((acc, l) => {
    acc[l.type] = (acc[l.type] ?? 0) + l.balance
    return acc
  }, {} as Record<string, number>)

  // Net worth change
  const previousSnapshot = snapshots?.[1]
  const netWorthChange = previousSnapshot ? netWorth - previousSnapshot.net_worth : 0
  const netWorthChangePct = previousSnapshot?.net_worth > 0
    ? (netWorthChange / previousSnapshot.net_worth) * 100 : 0

  return apiSuccess({
    net_worth: netWorth,
    net_worth_change: netWorthChange,
    net_worth_change_pct: netWorthChangePct,
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    assets: assets ?? [],
    liabilities: liabilities ?? [],
    assets_by_type: assetsByType,
    liabilities_by_type: liabilitiesByType,
    history: snapshots ?? [],
  })
})
