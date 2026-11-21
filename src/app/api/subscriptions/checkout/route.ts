import { NextRequest } from 'next/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { createSubscriptionCheckout } from '@/services/subscription.service'
import { z } from 'zod'

const schema = z.object({
  plan: z.enum(['pro', 'plus', 'elite']),
  interval: z.enum(['monthly', 'yearly']),
  coupon_code: z.string().optional(),
})

export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Invalid plan or interval', 400)

  const session = await createSubscriptionCheckout({ userId, ...parsed.data })
  return apiSuccess({ url: session.url, session_id: session.id })
})
