import { NextRequest } from 'next/server'
import { createAdminClient, getServerUser } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/security/rbac'
import { z } from 'zod'

const paramsSchema = z.object({ id: z.string().uuid() })
const renameSchema = z.object({ title: z.string().min(1).max(200) })

// GET /api/ai-coach/conversations/[id] — full message history for one conversation
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser()
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  const parsed = paramsSchema.safeParse(await params)
  if (!parsed.success) return apiError('Invalid conversation id', 400)
  const { id } = parsed.data

  const db = createAdminClient()

  // Ownership check up front — a 404 here (not 403) avoids confirming
  // to a caller whether a conversation ID they don't own exists at all.
  const { data: conversation } = await db
    .from('ai_conversations')
    .select('id, title, created_at, last_message_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!conversation) return apiError('Conversation not found', 404, 'NOT_FOUND')

  const { data: messages, error } = await db
    .from('ai_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return apiError(error.message, 500)

  return apiSuccess({ conversation, messages: messages ?? [] })
}

// PATCH /api/ai-coach/conversations/[id] — rename a conversation
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser()
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  const parsedParams = paramsSchema.safeParse(await params)
  if (!parsedParams.success) return apiError('Invalid conversation id', 400)
  const { id } = parsedParams.data

  const body = await req.json().catch(() => ({}))
  const parsedBody = renameSchema.safeParse(body)
  if (!parsedBody.success) return apiError('A non-empty title is required', 400)

  const db = createAdminClient()

  const { data: updated, error } = await db
    .from('ai_conversations')
    .update({ title: parsedBody.data.title })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, title')
    .single()

  if (error || !updated) return apiError('Conversation not found', 404, 'NOT_FOUND')

  return apiSuccess({ conversation: updated })
}

// DELETE /api/ai-coach/conversations/[id] — permanently delete a conversation
// and all of its messages (ai_messages.conversation_id has ON DELETE CASCADE,
// so a single delete on ai_conversations is enough — no orphaned rows).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser()
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  const parsed = paramsSchema.safeParse(await params)
  if (!parsed.success) return apiError('Invalid conversation id', 400)
  const { id } = parsed.data

  const db = createAdminClient()

  // Scoping the delete to user_id (not just id) is the actual security
  // control here — without it, any authenticated user could delete any
  // other user's conversation by guessing/enumerating UUIDs.
  const { data: deleted, error } = await db
    .from('ai_conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) return apiError(error.message, 500)
  if (!deleted) return apiError('Conversation not found', 404, 'NOT_FOUND')

  return apiSuccess({ deleted: true, id })
}
