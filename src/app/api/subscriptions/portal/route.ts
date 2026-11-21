import { NextRequest } from 'next/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { getPortalSession } from '@/services/subscription.service'

export const POST = withAuth(async (req, { userId }) => {
  const session = await getPortalSession(userId)
  return apiSuccess({ url: session.url })
})
