import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { z } from 'zod'

const reportSchema = z.object({
  agent_name: z.enum(['jarvis', 'athena', 'orion', 'titan', 'phoenix', 'merlin', 'sentinel']),
  title: z.string().min(3).max(300),
  report_type: z.string(),
  content: z.string().min(10),
  summary: z.string().max(500).optional(),
  key_metrics: z.record(z.unknown()).default({}),
  recommendations: z.array(z.string()).default([]),
  action_items: z.array(z.string()).default([]),
})

// GET /api/admin/cc/agents/reports
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const agentName = url.searchParams.get('agent') ?? ''
  const reportType = url.searchParams.get('type') ?? ''
  const pinnedOnly = url.searchParams.get('pinned') === 'true'
  const db = createAdminClient()

  let query = db
    .from('agent_reports')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (agentName) query = query.eq('agent_name', agentName)
  if (reportType) query = query.eq('report_type', reportType)
  if (pinnedOnly) query = query.eq('is_pinned', true)

  const { data, count, error } = await query.range(from, to)
  if (error) return apiError(error.message, 500)
  return apiSuccess({ reports: data ?? [], total: count ?? 0, page, per_page: perPage })
})

// POST /api/admin/cc/agents/reports — request or create a report
export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const db = createAdminClient()

  if (body.action === 'request') {
    // Ask a specific agent to generate a report
    const { agent_name, topic, context } = body
    if (!agent_name || !topic) return apiError('agent_name and topic required', 400)

    const { orchestrator } = await import('@/lib/agents/orchestrator')
    const agentMap = {
      athena: orchestrator.delegateToAthena.bind(orchestrator),
      orion: orchestrator.delegateToOrion.bind(orchestrator),
      titan: orchestrator.delegateToTitan.bind(orchestrator),
      phoenix: orchestrator.delegateToPhoenix.bind(orchestrator),
      merlin: orchestrator.delegateToMerlin.bind(orchestrator),
      sentinel: orchestrator.delegateToSentinel.bind(orchestrator),
      jarvis: async (t: string, c: any) => {
        const { createChatCompletion, MODELS } = await import('@/lib/ai/groq')
        return createChatCompletion([{ role: 'user', content: t }], { model: MODELS.AGENT_DEFAULT, maxTokens: 8192 })
      },
    } as Record<string, Function>

    const delegate = agentMap[agent_name]
    if (!delegate) return apiError('Invalid agent_name', 400)

    const result = await delegate(topic, context ?? {})
    const { data: report } = await db.from('agent_reports').insert({
      agent_name,
      title: topic.slice(0, 100),
      report_type: 'on_demand',
      content: result.content,
      summary: result.content.slice(0, 300),
    }).select().single()

    return apiSuccess({ report, generated: true }, 201)
  }

  // Manual report creation
  const parsed = reportSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const { data, error } = await db.from('agent_reports').insert(parsed.data).select().single()
  if (error) return apiError(error.message, 500)
  return apiSuccess(data, 201)
})

// PATCH /api/admin/cc/agents/reports — pin/archive
export const PATCH = withAdmin(async (req) => {
  const body = await req.json()
  const { id, is_pinned, is_archived } = body
  if (!id) return apiError('Report ID required', 400)
  const db = createAdminClient()
  const { data, error } = await db.from('agent_reports').update({ is_pinned, is_archived, viewed_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})
