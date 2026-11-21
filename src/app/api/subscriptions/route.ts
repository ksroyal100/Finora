import { NextRequest } from 'next/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import {
  getUserSubscription, createSubscriptionCheckout,
  getPortalSession, getUserEntitlements, checkAIQueryUsage
} from '@/services/subscription.service'
import { z } from 'zod'

// GET /api/subscriptions — get user subscription + entitlements
export const GET = withAuth(async (req, { userId }) => {
  const [sub, entitlements, aiUsage] = await Promise.all([
    getUserSubscription(userId),
    getUserEntitlements(userId),
    checkAIQueryUsage(userId),
  ])
  return apiSuccess({ subscription: sub, entitlements, ai_usage: aiUsage })
})
