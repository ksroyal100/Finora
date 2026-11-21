import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'

// GET /api/admin/cc/agents/tasks — list all agent tasks
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const agentName = url.searchParams.get('agent') ?? ''
  const status = url.searchParams.get('status') ?? ''
  const priority = url.searchParams.get('priority') ?? ''
  const workflowId = url.searchParams.get('workflow_id') ?? ''
  const db = createAdminClient()

  let query = db
    .from('agent_tasks')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (agentName) query = query.eq('assigned_to', agentName)
  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)
  if (workflowId) query = query.eq('workflow_id', workflowId)

  const { data, count, error } = await query.range(from, to)
  if (error) return apiError(error.message, 500)

  // Stats summary
  const { data: stats } = await db
    .from('agent_tasks')
    .select('status, assigned_to')

  const byStatus = (stats ?? []).reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const byAgent = (stats ?? []).reduce((acc, t) => {
    acc[t.assigned_to] = (acc[t.assigned_to] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return apiSuccess({
    tasks: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
    stats: { by_status: byStatus, by_agent: byAgent },
  })
})

// PATCH /api/admin/cc/agents/tasks — retry or cancel a task
export const PATCH = withAdmin(async (req) => {
  const body = await req.json()
  const { id, action } = body
  if (!id || !action) return apiError('id and action required', 400)

  const db = createAdminClient()
  const { data: task } = await db.from('agent_tasks').select('*').eq('id', id).single()
  if (!task) return apiError('Task not found', 404)

  if (action === 'retry') {
    if (!['failed', 'canceled'].includes(task.status)) {
      return apiError('Only failed or canceled tasks can be retried', 400)
    }
    await db.from('agent_tasks').update({
      status: 'pending',
      retry_count: task.retry_count + 1,
      failed_at: null,
      failure_reason: null,
      started_at: null,
    }).eq('id', id)

    // Re-execute
    const { agentService } = await import('@/lib/agents/orchestrator')
    agentService.executeTask(id).catch(console.error)
    return apiSuccess({ retrying: true, task_id: id })
  }

  if (action === 'cancel') {
    await db.from('agent_tasks').update({ status: 'canceled' }).eq('id', id)
    return apiSuccess({ canceled: true, task_id: id })
  }

  if (action === 'update_progress') {
    const { progress_pct } = body
    if (progress_pct === undefined) return apiError('progress_pct required', 400)
    await db.from('agent_tasks').update({ progress_pct }).eq('id', id)
    return apiSuccess({ updated: true })
  }

  return apiError('action must be retry, cancel, or update_progress', 400)
})
