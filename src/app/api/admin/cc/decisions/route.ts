import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { z } from 'zod'

const decisionSchema = z.object({
  agent_name: z.enum(['jarvis', 'athena', 'orion', 'titan', 'phoenix', 'merlin', 'sentinel']),
  task_id: z.string().uuid().optional(),
  workflow_id: z.string().uuid().optional(),
  title: z.string().min(3).max(300),
  situation: z.string().min(10).max(2000),
  decision: z.string().min(10).max(2000),
  rationale: z.string().max(3000).optional(),
  alternatives: z.array(z.object({ option: z.string(), pros: z.string(), cons: z.string() })).default([]),
  confidence_score: z.number().min(0).max(1).default(0.8),
  requires_approval: z.boolean().default(true),
})

// GET /api/admin/cc/decisions
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const pendingOnly = url.searchParams.get('pending') === 'true'
  const agentName = url.searchParams.get('agent') ?? ''
  const db = createAdminClient()

  let query = db
    .from('agent_decisions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (pendingOnly) query = query.eq('requires_approval', true).eq('is_executed', false)
  if (agentName) query = query.eq('agent_name', agentName)

  const { data, count, error } = await query.range(from, to)
  if (error) return apiError(error.message, 500)

  return apiSuccess({ decisions: data ?? [], total: count ?? 0, page, per_page: perPage })
})

// POST /api/admin/cc/decisions — approve or reject a decision
export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const { action, decision_id } = body

  if (!decision_id) return apiError('Decision ID required', 400)

  const db = createAdminClient()
  const { data: decision } = await db.from('agent_decisions').select('*').eq('id', decision_id).single()
  if (!decision) return apiError('Decision not found', 404)

  if (action === 'approve') {
    await db.from('agent_decisions').update({
      approved_by: userId,
      approved_at: new Date().toISOString(),
      is_executed: true,
      executed_at: new Date().toISOString(),
    }).eq('id', decision_id)

    // Execute the decision (task/workflow related)
    if (decision.task_id) {
      const { agentService } = await import('@/lib/agents/orchestrator')
      agentService.executeTask(decision.task_id).catch(console.error)
    }

    return apiSuccess({ approved: true, decision_id })
  }

  if (action === 'reject') {
    const { reason } = body
    await db.from('agent_decisions').update({
      approved_by: userId,
      approved_at: new Date().toISOString(),
      is_executed: false,
      outcome: `Rejected: ${reason ?? 'No reason provided'}`,
    }).eq('id', decision_id)

    return apiSuccess({ rejected: true, decision_id })
  }

  if (action === 'create') {
    const parsed = decisionSchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed', 400)

    const { data, error } = await db.from('agent_decisions').insert(parsed.data).select().single()
    if (error) return apiError(error.message, 500)
    return apiSuccess(data, 201)
  }

  return apiError('action must be approve, reject, or create', 400)
})
