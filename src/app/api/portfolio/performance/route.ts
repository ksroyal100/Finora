import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'

// GET /api/portfolio/performance
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const portfolioId = url.searchParams.get('portfolio_id')
  const period = url.searchParams.get('period') ?? '30' // days
  const db = createAdminClient()

  let portfolioQuery = db.from('portfolios').select('*').eq('user_id', userId)
  if (portfolioId) portfolioQuery = portfolioQuery.eq('id', portfolioId)
  else portfolioQuery = portfolioQuery.eq('is_default', true)

  const { data: portfolio } = await portfolioQuery.single()
  if (!portfolio) return apiError('Portfolio not found', 404)

  const { data: holdings } = await db
    .from('portfolio_holdings')
    .select('*')
    .eq('portfolio_id', portfolio.id)
    .order('market_value', { ascending: false })

  const { data: transactions } = await db
    .from('portfolio_transactions')
    .select('*')
    .eq('portfolio_id', portfolio.id)
    .order('transaction_date', { ascending: false })
    .limit(50)

  const holdingsList = holdings ?? []

  // Asset class breakdown
  const byAssetClass = holdingsList.reduce((acc, h) => {
    acc[h.asset_class] = (acc[h.asset_class] ?? 0) + (h.market_value ?? 0)
    return acc
  }, {} as Record<string, number>)

  // Sector breakdown
  const bySector = holdingsList.reduce((acc, h) => {
    if (h.sector) acc[h.sector] = (acc[h.sector] ?? 0) + (h.market_value ?? 0)
    return acc
  }, {} as Record<string, number>)

  // Top gainers and losers
  const sorted = [...holdingsList].sort((a, b) => (b.unrealized_gain_pct ?? 0) - (a.unrealized_gain_pct ?? 0))
  const topGainers = sorted.slice(0, 5)
  const topLosers = sorted.slice(-5).reverse()

  // Total return calculation
  const totalCost = holdingsList.reduce((s, h) => s + (h.quantity * h.avg_cost), 0)
  const totalValue = holdingsList.reduce((s, h) => s + (h.market_value ?? 0), 0)
  const totalReturn = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0

  // Dividend income (from dividend transactions)
  const dividendIncome = (transactions ?? [])
    .filter(t => t.type === 'dividend')
    .reduce((s, t) => s + t.total_amount, 0)

  return apiSuccess({
    portfolio,
    summary: {
      total_value: totalValue,
      total_cost: totalCost,
      total_return_pct: totalReturn,
      total_gain_loss: totalValue - totalCost,
      day_change: portfolio.day_change,
      day_change_pct: portfolio.day_change_pct,
      dividend_income: dividendIncome,
      holding_count: holdingsList.length,
    },
    holdings: holdingsList,
    transactions: transactions ?? [],
    breakdown: {
      by_asset_class: byAssetClass,
      by_sector: bySector,
    },
    top_gainers: topGainers,
    top_losers: topLosers,
  })
})
