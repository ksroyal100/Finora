import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { z } from 'zod'
import { getUserPlan } from '@/services/subscription.service'

const progressSchema = z.object({
  lesson_id: z.string().uuid(),
  course_id: z.string().uuid(),
  watch_time_seconds: z.number().min(0).optional(),
  is_completed: z.boolean().optional(),
})

const quizSchema = z.object({
  lesson_id: z.string().uuid(),
  course_id: z.string().uuid(),
  answers: z.record(z.string()),
})

// GET /api/learning/lessons?course_id=xxx or ?lesson_id=xxx
export const GET = withAuth(async (req, { userId }) => {
  const plan = await getUserPlan(userId)
  const url = new URL(req.url)
  const courseId = url.searchParams.get('course_id')
  const lessonId = url.searchParams.get('lesson_id')
  const db = createAdminClient()

  // Single lesson with content
  if (lessonId) {
    const { data: lesson, error } = await db
      .from('lessons')
      .select('*, course:courses!course_id(id, title, required_plan, is_free, creator_id)')
      .eq('id', lessonId)
      .single()

    if (error || !lesson) return apiError('Lesson not found', 404)

    const course = lesson.course as any

    // Check access
    const isCreator = course.creator_id === userId
    const isPlanOk = plan !== 'free' || course.is_free || lesson.is_free
    const isEnrolled = isCreator || (await db.from('course_enrollments').select('id').eq('course_id', course.id).eq('user_id', userId).single()).data

    if (!isCreator && !isPlanOk) {
      return apiError('Upgrade your plan to access this lesson', 403, 'PLAN_REQUIRED')
    }

    // Get user progress
    const { data: progress } = await db
      .from('lesson_progress')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('user_id', userId)
      .single()

    // Get quiz if exists
    const { data: quiz } = await db
      .from('quizzes')
      .select('*, quiz_questions(*)')
      .eq('lesson_id', lessonId)
      .single()

    // Sanitize quiz answers (don't expose correct answers)
    let sanitizedQuiz = null
    if (quiz) {
      sanitizedQuiz = {
        ...quiz,
        quiz_questions: (quiz.quiz_questions as any[]).map(q => ({
          ...q,
          correct_answer: undefined,
        })),
        user_score: progress?.quiz_score,
        attempts: progress?.attempts ?? 0,
      }
    }

    return apiSuccess({
      lesson,
      progress: progress ?? null,
      quiz: sanitizedQuiz,
      is_accessible: true,
    })
  }

  // Course lessons list
  if (!courseId) return apiError('course_id or lesson_id required', 400)

  const { data: course } = await db.from('courses').select('*').eq('id', courseId).single()
  if (!course) return apiError('Course not found', 404)

  const { data: lessons, error } = await db
    .from('lessons')
    .select('*')
    .eq('course_id', courseId)
    .eq('is_published', true)
    .order('sort_order')

  if (error) return apiError(error.message, 500)

  // Get user progress for all lessons
  const lessonIds = (lessons ?? []).map(l => l.id)
  const { data: progressList } = await db
    .from('lesson_progress')
    .select('lesson_id, is_completed, progress_pct: watch_time_seconds')
    .eq('user_id', userId)
    .in('lesson_id', lessonIds)

  const progressMap = new Map(progressList?.map(p => [p.lesson_id, p]))

  return apiSuccess({
    course,
    lessons: (lessons ?? []).map(l => ({
      ...l,
      content: undefined,  // Don't send full content in list view
      video_url: undefined, // Don't expose until actually viewing
      is_completed: progressMap.get(l.id)?.is_completed ?? false,
      is_accessible: plan !== 'free' || course.is_free || l.is_free,
    })),
  })
})

// POST /api/learning/lessons — update progress or submit quiz
export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const db = createAdminClient()

  if (body.action === 'enroll') {
    const { course_id } = body
    if (!course_id) return apiError('course_id required', 400)

    const { data: course } = await db.from('courses').select('id, lesson_count').eq('id', course_id).single()
    if (!course) return apiError('Course not found', 404)

    await db.from('course_enrollments').upsert({
      course_id,
      user_id: userId,
      enrolled_at: new Date().toISOString(),
      is_active: true,
    }, { onConflict: 'course_id,user_id' })

    await db.from('courses').update({ enrollment_count: db.rpc('increment', { x: 1 }) as unknown as number }).eq('id', course_id)

    return apiSuccess({ enrolled: true, course_id })
  }

  if (body.action === 'progress') {
    const parsed = progressSchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed', 400)

    const { data: existing } = await db.from('lesson_progress').select('*').eq('lesson_id', parsed.data.lesson_id).eq('user_id', userId).single()

    const watchTime = (existing?.watch_time_seconds ?? 0) + (parsed.data.watch_time_seconds ?? 0)
    const isCompleted = parsed.data.is_completed ?? (watchTime > 60)

    await db.from('lesson_progress').upsert({
      lesson_id: parsed.data.lesson_id,
      course_id: parsed.data.course_id,
      user_id: userId,
      watch_time_seconds: watchTime,
      is_completed: isCompleted,
      completed_at: isCompleted && !existing?.is_completed ? new Date().toISOString() : existing?.completed_at ?? null,
    }, { onConflict: 'lesson_id,user_id' })

    // Update enrollment progress
    if (isCompleted) {
      const { count: completedCount } = await db
        .from('lesson_progress')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', parsed.data.course_id)
        .eq('user_id', userId)
        .eq('is_completed', true)

      const { data: course } = await db.from('courses').select('lesson_count').eq('id', parsed.data.course_id).single()
      const progressPct = course && course.lesson_count > 0
        ? Math.min(100, Math.round(((completedCount ?? 0) / course.lesson_count) * 100))
        : 0

      await db.from('course_enrollments').update({
        progress_pct: progressPct,
        last_lesson_id: parsed.data.lesson_id,
        completed_at: progressPct >= 100 ? new Date().toISOString() : null,
      }).eq('course_id', parsed.data.course_id).eq('user_id', userId)

      // Issue certificate if course completed
      if (progressPct >= 100) {
        const { data: course } = await db.from('courses').select('certificate_enabled').eq('id', parsed.data.course_id).single()
        if (course?.certificate_enabled) {
          await db.from('certificates').upsert({ user_id: userId, course_id: parsed.data.course_id }, { onConflict: 'user_id,course_id' })
        }
      }
    }

    return apiSuccess({ progress_updated: true, is_completed: isCompleted })
  }

  if (body.action === 'submit_quiz') {
    const parsed = quizSchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed', 400)

    const { data: quiz } = await db
      .from('quizzes')
      .select('*, quiz_questions(*)')
      .eq('lesson_id', parsed.data.lesson_id)
      .single()

    if (!quiz) return apiError('Quiz not found', 404)

    const { data: existingProgress } = await db
      .from('lesson_progress')
      .select('attempts')
      .eq('lesson_id', parsed.data.lesson_id)
      .eq('user_id', userId)
      .single()

    if ((existingProgress?.attempts ?? 0) >= quiz.max_attempts) {
      return apiError(`Maximum attempts (${quiz.max_attempts}) reached`, 400)
    }

    // Grade quiz
    const questions = quiz.quiz_questions as any[]
    let correct = 0
    const results = questions.map(q => {
      const userAnswer = parsed.data.answers[q.id]
      const isCorrect = userAnswer === q.correct_answer
      if (isCorrect) correct++
      return { question_id: q.id, is_correct: isCorrect, correct_answer: q.correct_answer, user_answer: userAnswer }
    })

    const score = questions.length > 0 ? (correct / questions.length) * 100 : 0
    const passed = score >= quiz.passing_score

    await db.from('lesson_progress').upsert({
      lesson_id: parsed.data.lesson_id,
      course_id: parsed.data.course_id,
      user_id: userId,
      quiz_score: score,
      is_completed: passed,
      completed_at: passed ? new Date().toISOString() : null,
      attempts: (existingProgress?.attempts ?? 0) + 1,
    }, { onConflict: 'lesson_id,user_id' })

    return apiSuccess({ score, passed, correct, total: questions.length, results, passing_score: quiz.passing_score })
  }

  return apiError('action must be enroll, progress, or submit_quiz', 400)
})
