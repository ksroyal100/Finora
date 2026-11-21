import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { PLAN_LIMITS, getUserPlan } from '@/services/subscription.service'
import { z } from 'zod'

const portfolioSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  currency: z.string().length(3).default('USD'),
  is_default: z.boolean().optional(),
  is_public: z.boolean().optional(),
})

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
})

const transactionSchema = z.object({
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

// GET /api/portfolio — list user portfolios
export const GET = withAuth(async (req, { userId }) => {
  const db = createAdminClient()
  const { data, error } = await db
    .from('portfolios')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return apiError(error.message, 500)
  return apiSuccess(data ?? [])
})

// POST /api/portfolio — create portfolio
export const POST = withAuth(async (req, { userId }) => {
  const plan = await getUserPlan(userId)
  const db = createAdminClient()
  const body = await req.json()

  // Check portfolio limit for free plan
  const { count } = await db
    .from('portfolios')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const limit = PLAN_LIMITS[plan].portfolio_assets
  if (limit !== -1 && (count ?? 0) >= 3) {
    return apiError('Portfolio limit reached. Upgrade to Pro for unlimited portfolios.', 403, 'PLAN_REQUIRED')
  }

  const parsed = portfolioSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  // If setting as default, unset others
  if (parsed.data.is_default) {
    await db.from('portfolios').update({ is_default: false }).eq('user_id', userId)
  }

  const { data, error } = await db
    .from('portfolios')
    .insert({ user_id: userId, ...parsed.data })
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data, 201)
})
