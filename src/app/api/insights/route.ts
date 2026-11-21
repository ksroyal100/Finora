// src/app/api/insights/route.ts
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { generateInsights } from '@/services/insights.service'

// GET /api/insights — proactive, computed financial insights for the dashboard
export const GET = withAuth(async (req, { userId }) => {
  try {
    const insights = await generateInsights(userId)
    return apiSuccess({ insights })
  } catch (err) {
    console.error('[insights] failed to generate:', err)
    return apiError('Could not generate insights right now.', 500)
  }
})
