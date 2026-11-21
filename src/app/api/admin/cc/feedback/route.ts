import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/security/rbac'

// GET /api/admin/cc/feedback — all submissions plus aggregate rating stats.
// This is the only place this data is ever readable — RLS blocks even the
// submitting user from reading their own feedback back.
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') ?? '1', 10)
  const perPage = 40
  const db = createAdminClient()

  const [{ data: feedback, error, count }, { data: allRatings }] = await Promise.all([
    db
      .from('user_feedback')
      .select('id, user_id, rating, review, context, status, created_at, profiles:user_id(display_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1),
    db.from('user_feedback').select('rating'),
  ])

  if (error) return apiError(error.message, 500)

  const ratings = (allRatings ?? []).map(r => r.rating as number)
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
  const distribution = [1, 2, 3, 4, 5].map(star => ratings.filter(r => r === star).length)

  return apiSuccess({
    feedback: feedback ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
    avg_rating: Math.round(avgRating * 100) / 100,
    total_ratings: ratings.length,
    distribution,
  })
})
