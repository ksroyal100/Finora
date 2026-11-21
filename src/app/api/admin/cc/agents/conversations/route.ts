import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'

// GET /api/admin/cc/agents/conversations — list agent conversations
export const GET = withAdmin(async (req, { userId }) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const agentName = url.searchParams.get('agent') ?? ''
  const conversationType = url.searchParams.get('type') ?? ''
  const archived = url.searchParams.get('archived') === 'true'
  const conversationId = url.searchParams.get('id')
  const db = createAdminClient()

  // Single conversation with messages
  if (conversationId) {
    const [{ data: conversation }, { data: messages }] = await Promise.all([
      db.from('agent_conversations').select('*').eq('id', conversationId).single(),
      db.from('agent_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
    ])
    if (!conversation) return apiError('Conversation not found', 404)
    return apiSuccess({ conversation, messages: messages ?? [] })
  }

  // List conversations
  let query = db
    .from('agent_conversations')
    .select('*', { count: 'exact' })
    .eq('initiator_id', userId)
    .eq('is_archived', archived)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (agentName) query = query.eq('agent_name', agentName)
  if (conversationType) query = query.eq('conversation_type', conversationType)

  const { data, count, error } = await query.range(from, to)
  if (error) return apiError(error.message, 500)
  return apiSuccess({ conversations: data ?? [], total: count ?? 0, page, per_page: perPage })
})

// PATCH /api/admin/cc/agents/conversations — archive, rename
export const PATCH = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const { id, title, is_archived } = body
  if (!id) return apiError('Conversation ID required', 400)

  const db = createAdminClient()
  const updates: Record<string, unknown> = {}
  if (title !== undefined) updates.title = title
  if (is_archived !== undefined) updates.is_archived = is_archived

  const { data, error } = await db
    .from('agent_conversations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('initiator_id', userId)
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

// DELETE /api/admin/cc/agents/conversations?id=xxx
export const DELETE = withAdmin(async (req, { userId }) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return apiError('Conversation ID required', 400)

  const db = createAdminClient()
  await db.from('agent_conversations').delete().eq('id', id).eq('initiator_id', userId)
  return apiSuccess({ deleted: true })
})
