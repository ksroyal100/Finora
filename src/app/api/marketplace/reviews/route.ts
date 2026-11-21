import { NextRequest } from 'next/server'
import { withAuth, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { createReview, getProductReviews } from '@/services/marketplace.service'
import { z } from 'zod'

const reviewSchema = z.object({
  product_id: z.string().uuid(),
  rating: z.number().min(1).max(5).int(),
  title: z.string().max(200).optional(),
  content: z.string().max(2000).optional(),
})

export const GET = withAuth(async (req) => {
  const url = new URL(req.url)
  const productId = url.searchParams.get('product_id')
  if (!productId) return apiError('product_id required', 400)
  const { page, perPage } = getPagination(req)
  const result = await getProductReviews(productId, page, perPage)
  return apiSuccess(result)
})

export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)
  const { product_id, rating, title, content } = parsed.data
  const review = await createReview({ userId, productId: product_id, rating, title, content })
  return apiSuccess(review, 201)
})
