import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import {
  storeAgentMemory,
  searchAgentMemory,
  summarizeConversationToMemory,
} from '@/lib/qdrant/memory'
import { z } from 'zod'

const memorySchema = z.object({
  agent_name: z.enum(['jarvis', 'athena', 'orion', 'titan', 'phoenix', 'merlin', 'sentinel']),
  content: z.string().min(10).max(10000),
  content_type: z.string().default('manual'),
  tags: z.array(z.string()).default([]),
  importance_score: z.number().min(0).max(1).default(0.7),
  source_type: z.string().optional(),
  source_id: z.string().optional(),
})

const searchSchema = z.object({
  agent_name: z.enum(['jarvis', 'athena', 'orion', 'titan', 'phoenix', 'merlin', 'sentinel']),
  query: z.string().min(3),
  limit: z.number().min(1).max(50).default(10),
  min_score: z.number().min(0).max(1).default(0.6),
  content_type: z.string().optional(),
})

// GET /api/admin/cc/agents/memory — list memory index from Supabase
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const agentName = url.searchParams.get('agent') ?? ''
  const contentType = url.searchParams.get('type') ?? ''
  const db = createAdminClient()

  let query = db
    .from('agent_memory_index')
    .select('*', { count: 'exact' })
    .order('importance_score', { ascending: false })
    .order('created_at', { ascending: false })

  if (agentName) query = query.eq('agent_name', agentName)
  if (contentType) query = query.eq('content_type', contentType)

  const { data, count, error } = await query.range(from, to)
  if (error) return apiError(error.message, 500)

  return apiSuccess({
    memories: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
  })
})

// POST /api/admin/cc/agents/memory
export const POST = withAdmin(async (req) => {
  const body = await req.json()

  if (body.action === 'search') {
    const parsed = searchSchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed', 400)

    const results = await searchAgentMemory(
      parsed.data.agent_name,
      parsed.data.query,
      {
        limit: parsed.data.limit,
        minScore: parsed.data.min_score,
        contentType: parsed.data.content_type,
      }
    )
    return apiSuccess({ results, query: parsed.data.query })
  }

  if (body.action === 'store') {
    const parsed = memorySchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed', 400)

    const vectorId = await storeAgentMemory(parsed.data.agent_name, {
      content: parsed.data.content,
      contentType: parsed.data.content_type,
      tags: parsed.data.tags,
      importanceScore: parsed.data.importance_score,
      sourceType: parsed.data.source_type,
      sourceId: parsed.data.source_id,
    })

    return apiSuccess({ stored: true, vector_id: vectorId }, 201)
  }

  if (body.action === 'summarize_conversation') {
    const { agent_name, conversation_id } = body
    if (!agent_name || !conversation_id) return apiError('agent_name and conversation_id required', 400)
    await summarizeConversationToMemory(agent_name, conversation_id)
    return apiSuccess({ summarized: true })
  }

  if (body.action === 'delete') {
    const { memory_id } = body
    if (!memory_id) return apiError('memory_id required', 400)

    const db = createAdminClient()
    await db.from('agent_memory_index').delete().eq('id', memory_id)
    // Note: Qdrant vector deletion requires the vector_id
    // In production: also call qdrant.delete(collection, [vector_id])
    return apiSuccess({ deleted: true })
  }

  return apiError('action must be search, store, summarize_conversation, or delete', 400)
})
