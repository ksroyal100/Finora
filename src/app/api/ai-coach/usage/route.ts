import { withAuth, apiSuccess } from '@/lib/security/rbac'
import { checkAIQueryUsage } from '@/services/subscription.service'

// GET /api/ai-coach/usage
export const GET = withAuth(async (req, { userId }) => {
  const usage = await checkAIQueryUsage(userId)
  return apiSuccess(usage)
})
