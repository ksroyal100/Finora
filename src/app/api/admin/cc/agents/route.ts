import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/security/rbac'
import { agentService } from '@/lib/agents/orchestrator'
import { z } from 'zod'

const chatSchema = z.object({
  agent_name: z.enum(['jarvis', 'athena', 'orion', 'titan', 'phoenix', 'merlin', 'sentinel']),
  message: z.string().min(1).max(8000),
  conversation_id: z.string().uuid().optional(),
  context: z.record(z.unknown()).optional(),
})

const taskSchema = z.object({
  agent_name: z.enum(['jarvis', 'athena', 'orion', 'titan', 'phoenix', 'merlin', 'sentinel']),
  title: z.string().min(3).max(300),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical', 'urgent']).default('medium'),
  input_data: z.record(z.unknown()).default({}),
  due_at: z.string().optional(),
})

// GET /api/admin/cc/agents — list all agents with status
export const GET = withAdmin(async (req) => {
  const agents = await agentService.getAllAgents()
  return apiSuccess(agents)
})

// POST /api/admin/cc/agents — chat or create task
export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const action = body.action ?? 'chat'
  const db = createAdminClient()

  if (action === 'chat') {
    const parsed = chatSchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed', 400)

    const { agent_name, message, conversation_id, context } = parsed.data

    // Get or create conversation
    let convId = conversation_id
    if (!convId) {
      const { data: conv } = await db.from('agent_conversations').insert({
        agent_name,
        initiator_id: userId,
        title: message.slice(0, 60) + (message.length > 60 ? '...' : ''),
        context: context ?? {},
      }).select().single()
      convId = conv?.id
    }

    if (!convId) return apiError('Failed to create conversation', 500)

    // Fetch history
    const { data: history } = await db
      .from('agent_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(20)

    const conversationHistory = (history ?? [])
      .filter(m => m.role === 'user' || m.role === 'agent')
      .map(m => ({ role: m.role === 'agent' ? 'assistant' as const : 'user' as const, content: m.content }))

    // Inject platform context for relevant agents
    let enrichedContext: Record<string, unknown> = context ?? {}

    if (agent_name === 'athena' || agent_name === 'jarvis') {
      const { calculateMRR, getSubscriptionMetrics } = await import('@/services/subscription.service')
      const [mrr, metrics] = await Promise.all([calculateMRR(), getSubscriptionMetrics()])
      enrichedContext = { ...enrichedContext, current_mrr: mrr, subscription_metrics: metrics }
    }

    if (agent_name === 'sentinel' || agent_name === 'jarvis') {
      const { data: secEvents } = await db.from('security_events').select('*').eq('is_resolved', false).in('severity', ['high', 'critical']).limit(5)
      enrichedContext = { ...enrichedContext, unresolved_security_events: secEvents ?? [] }
    }

    if (agent_name === 'titan' || agent_name === 'jarvis') {
      const { data: infra } = await db.from('infrastructure_metrics').select('*').order('recorded_at', { ascending: false }).limit(10)
      enrichedContext = { ...enrichedContext, recent_infrastructure_metrics: infra ?? [] }
    }

    const result = await agentService.chatWithAgent({
      agentName: agent_name,
      conversationId: convId,
      adminId: userId,
      userMessage: message,
      conversationHistory,
      context: enrichedContext,
    })

    return apiSuccess({
      conversation_id: convId,
      agent_name,
      response: result.content,
      tokens_used: result.tokensUsed,
    })

  } else if (action === 'task') {
    const parsed = taskSchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed', 400)

    const { data: task, error } = await db.from('agent_tasks').insert({
      assigned_to: parsed.data.agent_name,
      created_by: userId,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      input_data: parsed.data.input_data,
      due_at: parsed.data.due_at,
      status: 'pending',
    }).select().single()

    if (error) return apiError(error.message, 500)

    // Execute async (fire and forget in production — use queue at scale)
    agentService.executeTask(task.id).catch(e => console.error('[AgentTask] Error:', e))

    return apiSuccess({ task, status: 'executing' }, 202)

  } else {
    return apiError('Invalid action. Use "chat" or "task"', 400)
  }
})
