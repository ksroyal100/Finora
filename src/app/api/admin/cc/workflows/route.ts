import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { orchestrator } from '@/lib/agents/orchestrator'
import { z } from 'zod'

const workflowSchema = z.object({
  title: z.string().min(3).max(300),
  description: z.string().max(2000).optional(),
  goal: z.string().min(10).max(2000),
  orchestrator: z.enum(['jarvis']).default('jarvis'),
  participating_agents: z.array(z.enum(['jarvis', 'athena', 'orion', 'titan', 'phoenix', 'merlin', 'sentinel'])).min(1).max(7),
  input_data: z.record(z.unknown()).default({}),
  scheduled_at: z.string().optional(),
  is_recurring: z.boolean().default(false),
  cron_expression: z.string().optional(),
})

// GET /api/admin/cc/workflows — list workflows
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const status = url.searchParams.get('status') ?? ''
  const db = createAdminClient()

  let query = db
    .from('agent_workflows')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, count, error } = await query.range(from, to)
  if (error) return apiError(error.message, 500)

  return apiSuccess({ workflows: data ?? [], total: count ?? 0, page, per_page: perPage })
})

// POST /api/admin/cc/workflows — create and optionally start workflow
export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const parsed = workflowSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()

  // Determine if JARVIS is always orchestrator
  const { data: workflow, error } = await db.from('agent_workflows').insert({
    created_by: userId,
    title: parsed.data.title,
    description: parsed.data.description,
    goal: parsed.data.goal,
    orchestrator: 'jarvis',
    participating_agents: ['jarvis', ...parsed.data.participating_agents.filter(a => a !== 'jarvis')],
    input_data: parsed.data.input_data,
    scheduled_at: parsed.data.scheduled_at,
    is_recurring: parsed.data.is_recurring,
    cron_expression: parsed.data.cron_expression,
    status: parsed.data.scheduled_at ? 'draft' : 'running',
    total_steps: parsed.data.participating_agents.length + 1,
  }).select().single()

  if (error) return apiError(error.message, 500)

  // Start immediately if not scheduled
  if (!parsed.data.scheduled_at) {
    orchestrator.startWorkflow(workflow.id).catch(e => {
      console.error('[Workflow] Error:', e)
      db.from('agent_workflows').update({ status: 'failed', failure_reason: e.message }).eq('id', workflow.id)
    })
  }

  return apiSuccess({ workflow, started: !parsed.data.scheduled_at }, 201)
})

// PATCH /api/admin/cc/workflows — pause, resume, cancel
export const PATCH = withAdmin(async (req) => {
  const body = await req.json()
  const { id, action } = body
  if (!id || !action) return apiError('Workflow ID and action required', 400)

  const db = createAdminClient()
  let updateData: Record<string, unknown> = {}

  switch (action) {
    case 'pause': updateData = { status: 'paused' }; break
    case 'resume': updateData = { status: 'running' }; break
    case 'cancel': updateData = { status: 'canceled' }; break
    default: return apiError('Invalid action', 400)
  }

  const { data, error } = await db
    .from('agent_workflows')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})
