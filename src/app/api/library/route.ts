import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'

// GET /api/library — user's purchased items and enrolled courses
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const section = url.searchParams.get('section') ?? 'all'
  const { page, perPage, from, to } = getPagination(req)
  const db = createAdminClient()

  if (section === 'purchases') {
    const { data, count, error } = await db
      .from('user_purchases')
      .select(`
        *,
        product:marketplace_products!product_id(
          id, title, slug, thumbnail_url, category,
          creator:profiles!creator_id(display_name, avatar_url)
        )
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('purchased_at', { ascending: false })
      .range(from, to)

    if (error) return apiError(error.message, 500)
    return apiSuccess({ items: data ?? [], total: count ?? 0, page, per_page: perPage })
  }

  if (section === 'courses') {
    const { data, count, error } = await db
      .from('course_enrollments')
      .select(`
        *,
        course:courses!course_id(
          id, title, slug, thumbnail_url, difficulty,
          lesson_count, duration_minutes, certificate_enabled,
          creator:profiles!creator_id(display_name, avatar_url)
        )
      `, { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('enrolled_at', { ascending: false })
      .range(from, to)

    if (error) return apiError(error.message, 500)
    return apiSuccess({ enrollments: data ?? [], total: count ?? 0, page, per_page: perPage })
  }

  if (section === 'certificates') {
    const { data, error } = await db
      .from('certificates')
      .select(`
        *,
        course:courses!course_id(title, thumbnail_url)
      `)
      .eq('user_id', userId)
      .order('issued_at', { ascending: false })

    if (error) return apiError(error.message, 500)
    return apiSuccess(data ?? [])
  }

  // All: summary overview
  const [
    { count: purchaseCount },
    { count: enrollmentCount },
    { count: completedCount },
    { count: certCount },
    { data: recentPurchases },
    { data: inProgressCourses },
  ] = await Promise.all([
    db.from('user_purchases').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('course_enrollments').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_active', true),
    db.from('course_enrollments').select('*', { count: 'exact', head: true }).eq('user_id', userId).not('completed_at', 'is', null),
    db.from('certificates').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('user_purchases')
      .select('purchased_at, product:marketplace_products!product_id(id, title, slug, thumbnail_url, category)')
      .eq('user_id', userId)
      .order('purchased_at', { ascending: false })
      .limit(4),
    db.from('course_enrollments')
      .select('progress_pct, course:courses!course_id(id, title, slug, thumbnail_url, lesson_count)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .is('completed_at', null)
      .gt('progress_pct', 0)
      .order('enrolled_at', { ascending: false })
      .limit(4),
  ])

  return apiSuccess({
    stats: {
      total_purchases: purchaseCount ?? 0,
      enrolled_courses: enrollmentCount ?? 0,
      completed_courses: completedCount ?? 0,
      certificates_earned: certCount ?? 0,
    },
    recent_purchases: recentPurchases ?? [],
    in_progress_courses: inProgressCourses ?? [],
  })
})
