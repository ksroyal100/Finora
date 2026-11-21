import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { z } from 'zod'

const txSchema = z.object({
  portfolio_id: z.string().uuid(),
  symbol: z.string().min(1).max(20).toUpperCase(),
  type: z.enum(['buy', 'sell', 'dividend', 'split', 'transfer', 'deposit', 'withdrawal']),
  quantity: z.number().positive(),
  price: z.number().positive(),
  fees: z.number().min(0).default(0),
  currency: z.string().length(3).default('USD'),
  notes: z.string().max(500).optional(),
  transaction_date: z.string(),
})

export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const portfolioId = url.searchParams.get('portfolio_id')
  const symbol = url.searchParams.get('symbol')
  const { page, perPage, from, to } = getPagination(req)

  const db = createAdminClient()
  let query = db
    .from('portfolio_transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false })

  if (portfolioId) query = query.eq('portfolio_id', portfolioId)
  if (symbol) query = query.eq('symbol', symbol.toUpperCase())

  const { data, count, error } = await query.range(from, to)
  if (error) return apiError(error.message, 500)

  return apiSuccess({ data: data ?? [], total: count ?? 0, page, per_page: perPage })
})

export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = txSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()

  // Verify portfolio ownership
  const { data: portfolio } = await db.from('portfolios').select('id').eq('id', parsed.data.portfolio_id).eq('user_id', userId).single()
  if (!portfolio) return apiError('Portfolio not found', 404)

  const totalAmount = parsed.data.quantity * parsed.data.price

  const { data, error } = await db
    .from('portfolio_transactions')
    .insert({ user_id: userId, ...parsed.data, total_amount: totalAmount })
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  // Update holding avg cost if buy/sell
  if (['buy', 'sell'].includes(parsed.data.type)) {
    const { data: existing } = await db
      .from('portfolio_holdings')
      .select('*')
      .eq('portfolio_id', parsed.data.portfolio_id)
      .eq('symbol', parsed.data.symbol)
      .single()

    if (existing) {
      let newQty = existing.quantity
      let newAvgCost = existing.avg_cost

      if (parsed.data.type === 'buy') {
        const totalCost = existing.quantity * existing.avg_cost + totalAmount
        newQty = existing.quantity + parsed.data.quantity
        newAvgCost = newQty > 0 ? totalCost / newQty : 0
      } else {
        newQty = Math.max(0, existing.quantity - parsed.data.quantity)
      }

      await db.from('portfolio_holdings').update({
        quantity: newQty,
        avg_cost: newAvgCost,
        market_value: newQty * (existing.current_price ?? parsed.data.price),
        last_updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    }
  }

  return apiSuccess(data, 201)
})
