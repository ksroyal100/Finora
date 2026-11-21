import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { z } from 'zod'

const milestoneSchema = z.object({
  goal_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  amount: z.number().positive(),
  notes: z.string().max(500).optional(),
})

const contributionSchema = z.object({
  goal_id: z.string().uuid(),
  amount: z.number().positive(),
  notes: z.string().max(500).optional(),
})

// POST /api/goals/milestones — add milestone or contribution
export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const db = createAdminClient()

  if (body.type === 'contribution') {
    const parsed = contributionSchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed', 400)

    // Verify goal ownership
    const { data: goal } = await db.from('goals').select('current_amount, target_amount, title').eq('id', parsed.data.goal_id).eq('user_id', userId).single()
    if (!goal) return apiError('Goal not found', 404)

    const newAmount = goal.current_amount + parsed.data.amount

    await db.from('goal_contributions').insert({ user_id: userId, ...parsed.data })
    const { data: updated } = await db.from('goals').update({
      current_amount: newAmount,
      updated_at: new Date().toISOString(),
    }).eq('id', parsed.data.goal_id).select().single()

    // Check milestones
    if (updated && (updated.progress_pct >= 25 || updated.progress_pct >= 50 || updated.progress_pct >= 75 || updated.progress_pct >= 100)) {
      await db.from('notifications').insert({
        user_id: userId,
        type: 'goal',
        channel: 'in_app',
        title: updated.progress_pct >= 100 ? `🎉 Goal Complete: ${goal.title}!` : `🎯 ${updated.progress_pct}% Milestone: ${goal.title}`,
        body: updated.progress_pct >= 100
          ? `Congratulations! You've reached your goal of $${goal.target_amount.toLocaleString()}!`
          : `You're ${updated.progress_pct}% of the way to $${goal.target_amount.toLocaleString()}! Keep it up!`,
      })
    }

    return apiSuccess({ goal: updated, contribution_added: parsed.data.amount })
  }

  // Milestone
  const parsed = milestoneSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const { data: goal } = await db.from('goals').select('id').eq('id', parsed.data.goal_id).eq('user_id', userId).single()
  if (!goal) return apiError('Goal not found', 404)

  const { data, error } = await db.from('goal_milestones').insert(parsed.data).select().single()
  if (error) return apiError(error.message, 500)
  return apiSuccess(data, 201)
})

// GET /api/goals/milestones
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const goalId = url.searchParams.get('goal_id')
  if (!goalId) return apiError('goal_id required', 400)

  const db = createAdminClient()
  const { data: goal } = await db.from('goals').select('id').eq('id', goalId).eq('user_id', userId).single()
  if (!goal) return apiError('Goal not found', 404)

  const [{ data: milestones }, { data: contributions }] = await Promise.all([
    db.from('goal_milestones').select('*').eq('goal_id', goalId).order('amount'),
    db.from('goal_contributions').select('*').eq('goal_id', goalId).order('contributed_at', { ascending: false }),
  ])

  return apiSuccess({ milestones: milestones ?? [], contributions: contributions ?? [] })
})
