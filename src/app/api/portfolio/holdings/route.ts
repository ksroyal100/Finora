import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { z } from 'zod'

const holdingSchema = z.object({
  portfolio_id: z.string().uuid(),
  symbol: z.string().min(1).max(20).toUpperCase(),
  name: z.string().optional(),
  asset_class: z.enum(['stock', 'etf', 'crypto', 'bond', 'real_estate', 'commodity', 'cash', 'other']).default('stock'),
  quantity: z.number().positive(),
  avg_cost: z.number().positive(),
  current_price: z.number().min(0).optional(),
  currency: z.string().length(3).default('USD'),
  exchange: z.string().optional(),
  sector: z.string().optional(),
  logo_url: z.string().url().optional(),
})

// GET /api/portfolio/holdings?portfolio_id=xxx
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const portfolioId = url.searchParams.get('portfolio_id')

  const db = createAdminClient()
  let query = db
    .from('portfolio_holdings')
    .select('*')
    .eq('user_id', userId)
    .order('market_value', { ascending: false })

  if (portfolioId) query = query.eq('portfolio_id', portfolioId)

  const { data, error } = await query
  if (error) return apiError(error.message, 500)
  return apiSuccess(data ?? [])
})

// POST /api/portfolio/holdings — add holding
export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = holdingSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()

  // Verify portfolio ownership
  const { data: portfolio } = await db
    .from('portfolios')
    .select('id')
    .eq('id', parsed.data.portfolio_id)
    .eq('user_id', userId)
    .single()

  if (!portfolio) return apiError('Portfolio not found', 404)

  const quantity = parsed.data.quantity
  const avgCost = parsed.data.avg_cost
  const currentPrice = parsed.data.current_price ?? avgCost
  const marketValue = quantity * currentPrice
  const unrealizedGain = marketValue - (quantity * avgCost)

  const { data, error } = await db
    .from('portfolio_holdings')
    .upsert({
      user_id: userId,
      ...parsed.data,
      market_value: marketValue,
      unrealized_gain: unrealizedGain,
      unrealized_gain_pct: avgCost > 0 ? (unrealizedGain / (quantity * avgCost)) * 100 : 0,
      last_updated_at: new Date().toISOString(),
    }, { onConflict: 'portfolio_id,symbol' })
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  // Update portfolio totals
  await updatePortfolioTotals(parsed.data.portfolio_id, db)

  return apiSuccess(data, 201)
})

// PATCH /api/portfolio/holdings — update holding
export const PATCH = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return apiError('Holding ID required', 400)

  const db = createAdminClient()
  const { data, error } = await db
    .from('portfolio_holdings')
    .update({ ...updates, last_updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  if (!data) return apiError('Holding not found', 404)

  if (data.portfolio_id) await updatePortfolioTotals(data.portfolio_id, db)

  return apiSuccess(data)
})

// DELETE /api/portfolio/holdings?id=xxx
export const DELETE = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return apiError('Holding ID required', 400)

  const db = createAdminClient()
  const { data, error } = await db
    .from('portfolio_holdings')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('portfolio_id')
    .single()

  if (error) return apiError(error.message, 500)
  if (!data) return apiError('Holding not found', 404)

  await updatePortfolioTotals(data.portfolio_id, db)

  return apiSuccess({ deleted: true })
})

async function updatePortfolioTotals(portfolioId: string, db: ReturnType<typeof createAdminClient>) {
  const { data: holdings } = await db
    .from('portfolio_holdings')
    .select('market_value, quantity, avg_cost')
    .eq('portfolio_id', portfolioId)

  if (!holdings) return

  const totalValue = holdings.reduce((sum, h) => sum + (h.market_value ?? 0), 0)
  const totalCost = holdings.reduce((sum, h) => sum + (h.quantity * h.avg_cost), 0)
  const totalGainLoss = totalValue - totalCost
  const totalGainLossPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0

  await db
    .from('portfolios')
    .update({
      total_value: totalValue,
      total_cost: totalCost,
      total_gain_loss: totalGainLoss,
      total_gain_loss_pct: totalGainLossPct,
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', portfolioId)
}
