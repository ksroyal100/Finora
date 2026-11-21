import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { PLAN_LIMITS, getUserPlan } from '@/services/subscription.service'
import { z } from 'zod'

// GET /api/learning/courses — list courses
export const GET = withAuth(async (req, { userId }) => {
  const plan = await getUserPlan(userId)
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const search = url.searchParams.get('search') ?? ''
  const category = url.searchParams.get('category') ?? ''
  const difficulty = url.searchParams.get('difficulty') ?? ''
  const isFree = url.searchParams.get('is_free')
  const enrolled = url.searchParams.get('enrolled') === 'true'
  const db = createAdminClient()

  let query = db
    .from('courses')
    .select(`
      *,
      creator:profiles!creator_id(display_name, username, avatar_url),
      category:learning_categories!category_id(name, slug, icon, color)
    `, { count: 'exact' })
    .eq('status', 'published')

  if (search) query = query.textSearch('title', search, { type: 'websearch', config: 'english' })
  if (category) query = query.eq('category_id', category)
  if (difficulty) query = query.eq('difficulty', difficulty)
  if (isFree === 'true') query = query.eq('is_free', true)
  if (isFree === 'false') query = query.eq('is_free', false)

  if (enrolled) {
    const { data: enrollments } = await db
      .from('course_enrollments')
      .select('course_id')
      .eq('user_id', userId)
    const ids = enrollments?.map(e => e.course_id) ?? []
    if (ids.length) query = query.in('id', ids)
    else return apiSuccess({ courses: [], total: 0 })
  }

  const { data, count, error } = await query
    .order('enrollment_count', { ascending: false })
    .range(from, to)

  if (error) return apiError(error.message, 500)

  const courses = data ?? []
  const courseIds = courses.map(c => c.id)

  // Check enrollment status
  const { data: enrollments } = await db
    .from('course_enrollments')
    .select('course_id, progress_pct, completed_at')
    .eq('user_id', userId)
    .in('course_id', courseIds)

  const enrollmentMap = new Map(enrollments?.map(e => [e.course_id, e]))

  return apiSuccess({
    courses: courses.map(c => ({
      ...c,
      is_enrolled: enrollmentMap.has(c.id),
      progress_pct: enrollmentMap.get(c.id)?.progress_pct ?? 0,
      is_completed: !!enrollmentMap.get(c.id)?.completed_at,
      is_accessible: plan === 'free'
        ? c.is_free || c.required_plan === 'free'
        : ['pro', 'plus', 'elite'].includes(plan),
    })),
    total: count ?? 0,
    page,
    per_page: perPage,
  })
})
