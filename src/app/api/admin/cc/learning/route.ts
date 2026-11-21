import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, getPagination, createAuditLog } from '@/lib/security/rbac'
import { z } from 'zod'

const courseAdminSchema = z.object({
  title: z.string().min(3).max(300),
  description: z.string().max(10000).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  is_free: z.boolean().default(false),
  price: z.number().min(0).default(0),
  required_plan: z.enum(['free', 'pro', 'plus', 'elite']).default('free'),
  certificate_enabled: z.boolean().default(false),
  category_id: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
})

// GET /api/admin/cc/learning — learning platform overview
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const section = url.searchParams.get('section') ?? 'overview'
  const db = createAdminClient()

  if (section === 'courses') {
    const status = url.searchParams.get('status') ?? ''
    let query = db
      .from('courses')
      .select('*, creator:profiles!creator_id(display_name, email)', { count: 'exact' })
      .order('enrollment_count', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data, count, error } = await query.range(from, to)
    if (error) return apiError(error.message, 500)
    return apiSuccess({ courses: data ?? [], total: count ?? 0, page, per_page: perPage })
  }

  if (section === 'certificates') {
    const { data, count, error } = await db
      .from('certificates')
      .select('*, user:profiles!user_id(display_name, email), course:courses!course_id(title)', { count: 'exact' })
      .order('issued_at', { ascending: false })
      .range(from, to)
    if (error) return apiError(error.message, 500)
    return apiSuccess({ certificates: data ?? [], total: count ?? 0 })
  }

  // Overview
  const [
    { count: totalCourses },
    { count: publishedCourses },
    { count: totalEnrollments },
    { count: completedCourses },
    { count: totalCertificates },
    { data: topCourses },
    { data: categories },
  ] = await Promise.all([
    db.from('courses').select('*', { count: 'exact', head: true }),
    db.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    db.from('course_enrollments').select('*', { count: 'exact', head: true }),
    db.from('course_enrollments').select('*', { count: 'exact', head: true }).not('completed_at', 'is', null),
    db.from('certificates').select('*', { count: 'exact', head: true }),
    db.from('courses').select('title, enrollment_count, completion_count, average_rating, status').eq('status', 'published').order('enrollment_count', { ascending: false }).limit(5),
    db.from('learning_categories').select('*').order('sort_order'),
  ])

  const completionRate = (totalEnrollments ?? 0) > 0
    ? (((completedCourses ?? 0) / (totalEnrollments ?? 1)) * 100).toFixed(1) : '0'

  return apiSuccess({
    stats: {
      total_courses: totalCourses ?? 0,
      published_courses: publishedCourses ?? 0,
      total_enrollments: totalEnrollments ?? 0,
      completion_rate_pct: completionRate,
      certificates_issued: totalCertificates ?? 0,
    },
    top_courses: topCourses ?? [],
    categories: categories ?? [],
  })
})

// POST /api/admin/cc/learning — manage courses, categories
export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const { action } = body
  const db = createAdminClient()

  if (action === 'publish_course') {
    const { course_id } = body
    if (!course_id) return apiError('course_id required', 400)
    await db.from('courses').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', course_id)
    const { data: course } = await db.from('courses').select('creator_id, title').eq('id', course_id).single()
    if (course) {
      await db.from('notifications').insert({
        user_id: course.creator_id, type: 'learning', channel: 'in_app',
        title: 'Course Published!',
        body: `Your course "${course.title}" is now live on Finora Learning Hub.`,
      })
    }
    return apiSuccess({ published: true })
  }

  if (action === 'archive_course') {
    const { course_id } = body
    if (!course_id) return apiError('course_id required', 400)
    await db.from('courses').update({ status: 'archived' }).eq('id', course_id)
    return apiSuccess({ archived: true })
  }

  if (action === 'create_category') {
    const { name, slug, description, icon, color, sort_order } = body
    if (!name || !slug) return apiError('name and slug required', 400)
    const { data, error } = await db.from('learning_categories').insert({ name, slug, description, icon, color, sort_order: sort_order ?? 0 }).select().single()
    if (error) return apiError(error.message, 500)
    return apiSuccess(data, 201)
  }

  if (action === 'create_achievement') {
    const { name, slug, description, icon, badge_url, points, criteria } = body
    if (!name || !slug) return apiError('name and slug required', 400)
    const { data, error } = await db.from('achievements').insert({ name, slug, description, icon, badge_url, points: points ?? 10, criteria: criteria ?? {} }).select().single()
    if (error) return apiError(error.message, 500)
    return apiSuccess(data, 201)
  }

  if (action === 'award_achievement') {
    const { user_id, achievement_id } = body
    if (!user_id || !achievement_id) return apiError('user_id and achievement_id required', 400)
    await db.from('user_achievements').upsert({ user_id, achievement_id, earned_at: new Date().toISOString() }, { onConflict: 'user_id,achievement_id' })
    const { data: achievement } = await db.from('achievements').select('name, points').eq('id', achievement_id).single()
    if (achievement) {
      await db.from('notifications').insert({
        user_id, type: 'learning', channel: 'in_app',
        title: `🏆 Achievement Unlocked: ${achievement.name}`,
        body: `You earned ${achievement.points} points for this achievement!`,
      })
    }
    return apiSuccess({ awarded: true })
  }

  return apiError('Invalid action', 400)
})
