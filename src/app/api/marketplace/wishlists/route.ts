import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { toggleWishlist } from '@/services/marketplace.service'

export const GET = withAuth(async (req, { userId }) => {
  const { page, perPage, from, to } = getPagination(req)
  const db = createAdminClient()
  const { data, count, error } = await db
    .from('marketplace_wishlists')
    .select('*, product:marketplace_products!product_id(id, title, slug, price, thumbnail_url, average_rating, creator_id)', { count: 'exact' })
    .eq('user_id', userId)
    .order('added_at', { ascending: false })
    .range(from, to)
  if (error) return apiError(error.message, 500)
  return apiSuccess({ items: data ?? [], total: count ?? 0, page, per_page: perPage })
})

export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const { product_id } = body
  if (!product_id) return apiError('product_id required', 400)
  const result = await toggleWishlist(userId, product_id)
  return apiSuccess(result)
})
