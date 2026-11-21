import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, withFounder, apiSuccess, apiError } from '@/lib/security/rbac'
import { orchestrator } from '@/lib/agents/orchestrator'
import { z } from 'zod'

const goalSchema = z.object({
  title: z.string().min(3).max(300),
  description: z.string().max(2000).optional(),
  goal_type: z.enum(['mrr', 'arr', 'users', 'retention', 'marketplace_revenue', 'custom']),
  target_value: z.number().positive(),
  current_value: z.number().min(0).default(0),
  currency: z.string().length(3).default('USD'),
  period: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  assigned_agent: z.enum(['jarvis', 'athena', 'orion', 'titan', 'phoenix', 'merlin', 'sentinel']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical', 'urgent']).default('high'),
  starts_at: z.string(),
  ends_at: z.string(),
})

// GET /api/admin/cc/goals
export const GET = withAdmin(async (req) => {
  const db = createAdminClient()
  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? 'active'
  const period = url.searchParams.get('period') ?? ''

  let query = db
    .from('company_goals')
    .select('*')
    .order('priority', { ascending: false })
    .order('ends_at')

  if (status) query = query.eq('status', status)
  if (period) query = query.eq('period', period)

  const { data, error } = await query
  if (error) return apiError(error.message, 500)

  const goals = data ?? []

  // Auto-sync revenue goals with real data
  const { calculateMRR } = await import('@/services/subscription.service')
  const currentMRR = await calculateMRR()

  const enriched = await Promise.all(goals.map(async (g) => {
    let currentValue = g.current_value
    if (g.goal_type === 'mrr') currentValue = currentMRR
    if (g.goal_type === 'arr') currentValue = currentMRR * 12

    if (g.goal_type === 'users') {
      const { count } = await db.from('profiles').select('*', { count: 'exact', head: true })
      currentValue = count ?? 0
    }

    // Update if changed
    if (currentValue !== g.current_value) {
      await db.from('company_goals').update({ current_value: currentValue }).eq('id', g.id)
    }

    const progressPct = g.target_value > 0 ? Math.min((currentValue / g.target_value) * 100, 100) : 0

    return {
      ...g,
      current_value: currentValue,
      progress_pct: progressPct,
      days_remaining: Math.ceil((new Date(g.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    }
  }))

  const summary = {
    total: enriched.length,
    on_track: enriched.filter(g => g.progress_pct >= 50).length,
    at_risk: enriched.filter(g => g.progress_pct < 50 && g.days_remaining < 14).length,
    total_target_mrr: enriched.filter(g => g.goal_type === 'mrr').reduce((s, g) => s + g.target_value, 0),
    current_mrr: currentMRR,
  }

  return apiSuccess({ goals: enriched, summary })
})

// POST /api/admin/cc/goals — create goal
export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const parsed = goalSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()
  const { data, error } = await db.from('company_goals').insert({
    ...parsed.data,
    created_by: userId,
    status: 'active',
  }).select().single()

  if (error) return apiError(error.message, 500)

  // Notify assigned agent
  if (parsed.data.assigned_agent) {
    const agentTask = `You have been assigned a company goal:
Title: ${parsed.data.title}
Type: ${parsed.data.goal_type}
Target: ${parsed.data.target_value} ${parsed.data.currency}
Deadline: ${parsed.data.ends_at}
Period: ${parsed.data.period}

Please develop a strategy to achieve this goal and create an action plan with specific steps, KPIs to track, and weekly milestones.`

    const result = await orchestrator['quickDelegate'](parsed.data.assigned_agent, agentTask)

    await db.from('agent_reports').insert({
      agent_name: parsed.data.assigned_agent,
      title: `Goal Strategy: ${parsed.data.title}`,
      report_type: 'goal_strategy',
      content: result.content,
      summary: `Strategy for achieving ${parsed.data.goal_type} goal: ${parsed.data.target_value}`,
    })
  }

  return apiSuccess(data, 201)
})

// PATCH /api/admin/cc/goals — update goal progress or status
export const PATCH = withAdmin(async (req) => {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return apiError('Goal ID required', 400)

  const db = createAdminClient()
  const { data, error } = await db
    .from('company_goals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  // Check if goal completed
  if (data.progress_pct >= 100 && data.status === 'active') {
    await db.from('company_goals').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id)

    // JARVIS celebration report
    orchestrator.delegateToAthena(
      `Company goal achieved! "${data.title}" - Target: ${data.target_value}, achieved on ${new Date().toLocaleDateString()}. 
      Provide a brief financial impact analysis and recommendations for setting the next goal.`
    ).then(async result => {
      await db.from('agent_reports').insert({
        agent_name: 'athena',
        title: `Goal Achieved: ${data.title}`,
        report_type: 'goal_completion',
        content: result.content,
      })
    }).catch(console.error)
  }

  return apiSuccess(data)
})
