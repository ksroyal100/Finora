import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'

// GET /api/learning/achievements
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const section = url.searchParams.get('section') ?? 'achievements'
  const db = createAdminClient()

  if (section === 'certificates') {
    const { data, error } = await db
      .from('certificates')
      .select('*, course:courses!course_id(title, thumbnail_url, creator:profiles!creator_id(display_name))')
      .eq('user_id', userId)
      .order('issued_at', { ascending: false })
    if (error) return apiError(error.message, 500)
    return apiSuccess(data ?? [])
  }

  if (section === 'progress') {
    const { data: enrollments } = await db
      .from('course_enrollments')
      .select('*, course:courses!course_id(title, thumbnail_url, lesson_count, difficulty)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('enrolled_at', { ascending: false })
    return apiSuccess(enrollments ?? [])
  }

  // Achievements
  const [{ data: allAchievements }, { data: earned }] = await Promise.all([
    db.from('achievements').select('*').eq('is_active', true).order('points', { ascending: false }),
    db.from('user_achievements').select('*, achievement:achievements!achievement_id(*)').eq('user_id', userId),
  ])

  const earnedIds = new Set(earned?.map(e => e.achievement_id))
  const totalPoints = earned?.reduce((sum, e) => sum + ((e.achievement as any)?.points ?? 0), 0) ?? 0

  return apiSuccess({
    achievements: (allAchievements ?? []).map(a => ({ ...a, is_earned: earnedIds.has(a.id) })),
    earned_count: earned?.length ?? 0,
    total_points: totalPoints,
  })
})
