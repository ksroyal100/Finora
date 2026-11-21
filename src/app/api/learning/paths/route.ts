import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { getUserPlan } from '@/services/subscription.service'

export const GET = withAuth(async (req, { userId }) => {
  const plan = await getUserPlan(userId)
  const { page, perPage, from, to } = getPagination(req)
  const db = createAdminClient()

  const { data, count, error } = await db
    .from('learning_paths')
    .select(`
      *,
      learning_path_courses(
        sort_order, is_required,
        course:courses!course_id(id, title, thumbnail_url, difficulty, lesson_count, duration_minutes)
      )
    `, { count: 'exact' })
    .eq('is_published', true)
    .order('sort_order')
    .range(from, to)

  if (error) return apiError(error.message, 500)

  // Check enrollment status for each path's courses
  const allCourseIds = (data ?? [])
    .flatMap(p => (p.learning_path_courses as any[]).map((lpc: any) => lpc.course?.id))
    .filter(Boolean)

  const { data: enrollments } = await db
    .from('course_enrollments')
    .select('course_id, progress_pct')
    .eq('user_id', userId)
    .in('course_id', allCourseIds)

  const enrollmentMap = new Map(enrollments?.map(e => [e.course_id, e.progress_pct]))

  const paths = (data ?? []).map(p => {
    const courses = (p.learning_path_courses as any[]).map((lpc: any) => ({
      ...lpc.course,
      sort_order: lpc.sort_order,
      is_required: lpc.is_required,
      progress_pct: enrollmentMap.get(lpc.course?.id) ?? 0,
    }))
    const totalProgress = courses.length > 0
      ? courses.reduce((s: number, c: any) => s + c.progress_pct, 0) / courses.length : 0

    return {
      ...p,
      learning_path_courses: undefined,
      courses,
      total_courses: courses.length,
      completed_courses: courses.filter((c: any) => c.progress_pct >= 100).length,
      path_progress_pct: totalProgress,
      is_accessible: plan !== 'free' || p.required_plan === 'free',
    }
  })

  return apiSuccess({ paths, total: count ?? 0, page, per_page: perPage })
})
