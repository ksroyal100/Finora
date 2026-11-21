import { NextRequest } from 'next/server'
import { withAuth, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { createOrder } from '@/services/marketplace.service'
import { createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const orderSchema = z.object({
  product_ids: z.array(z.string().uuid()).min(1).max(10),
  coupon_code: z.string().optional(),
})

// GET /api/marketplace/orders
export const GET = withAuth(async (req, { userId }) => {
  const { page, perPage, from, to } = getPagination(req)
  const db = createAdminClient()

  const { data, count, error } = await db
    .from('marketplace_orders')
    .select('*, marketplace_order_items(*, marketplace_products(title, thumbnail_url, slug))', { count: 'exact' })
    .eq('buyer_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ data: data ?? [], total: count ?? 0, page, per_page: perPage })
})

// POST /api/marketplace/orders
export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = orderSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const result = await createOrder({
    buyerId: userId,
    productIds: parsed.data.product_ids,
    couponCode: parsed.data.coupon_code,
  })

  // If free, mark completed immediately
  if (result.is_free) {
    const { fulfillOrder } = await import('@/services/marketplace.service')
    await fulfillOrder(result.order.id)
    return apiSuccess({ order: result.order, is_free: true, completed: true })
  }

  return apiSuccess({
    order: result.order,
    client_secret: result.client_secret,
    total: result.total,
    is_free: false,
  }, 201)
})
