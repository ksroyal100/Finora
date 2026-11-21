import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { checkAIQueryUsage, incrementAIQueryCount } from '@/services/subscription.service'
import { getWealthCoachResponse } from '@/lib/ai/groq'
import type { ChatMessage } from '@/lib/ai/groq'
import { z } from 'zod'

const messageSchema = z.object({
  conversation_id: z.string().uuid().nullish(),  // nullish = optional + nullable (accepts undefined OR null)
  message: z.string().min(1).max(4000),
  title: z.string().max(200).optional(),
})

// GET /api/ai-coach/conversations — list conversations
export const GET = withAuth(async (req, { userId }) => {
  const db = createAdminClient()
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') ?? '1')
  const perPage = 20
  const from = (page - 1) * perPage

  const { data, count, error } = await db
    .from('ai_conversations')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .range(from, from + perPage - 1)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ conversations: data ?? [], total: count ?? 0 })
})

// POST /api/ai-coach/conversations — send a message
export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = messageSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  // Check usage limits
  const usage = await checkAIQueryUsage(userId)
  if (!usage.allowed) {
    return apiError(
      `Weekly AI query limit reached (${usage.queries_limit} queries/week on Free plan). Upgrade to Pro for unlimited access.`,
      403,
      'USAGE_LIMIT'
    )
  }

  const db = createAdminClient()
  const { conversation_id, message, title } = parsed.data

  // Get or create conversation
  let convId = conversation_id
  if (!convId) {
    const { data: conv, error: convErr } = await db
      .from('ai_conversations')
      .insert({
        user_id: userId,
        title: title ?? message.slice(0, 60) + (message.length > 60 ? '...' : ''),
      })
      .select()
      .single()

    if (convErr) return apiError(convErr.message, 500)
    convId = conv.id
  }

  // Fetch conversation history (last 10 messages)
  const { data: history } = await db
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', convId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  const conversationHistory: ChatMessage[] = (history ?? [])
    .reverse()
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  // Get user context for personalization
  const [{ data: profile }, { data: sub }, { data: recentGoals }] = await Promise.all([
    db.from('profiles').select('currency, country_code').eq('id', userId).single(),
    db.from('subscriptions').select('plan').eq('user_id', userId).single(),
    db.from('goals').select('title, target_amount, current_amount, progress_pct').eq('user_id', userId).eq('status', 'active').limit(3),
  ])

  const userContext = {
    plan: sub?.plan ?? 'free',
    currency: profile?.currency ?? 'USD',
    goals: recentGoals?.map(g => g.title) ?? [],
  }

  // Get AI response
  const result = await getWealthCoachResponse(
    [...conversationHistory, { role: 'user', content: message }],
    userContext
  )

  // Save messages
  await db.from('ai_messages').insert([
    { conversation_id: convId, user_id: userId, role: 'user', content: message },
    {
      conversation_id: convId, user_id: userId, role: 'assistant',
      content: result.content, tokens_used: result.tokensUsed, model: result.model,
    },
  ])

  // Update conversation metadata
  await db.from('ai_conversations').update({
    message_count: (history?.length ?? 0) + 2,
    last_message_at: new Date().toISOString(),
  }).eq('id', convId)

  // Track usage
  await incrementAIQueryCount(userId, result.tokensUsed)

  return apiSuccess({
    conversation_id: convId,
    message:  result.content,   // primary response field
    response: result.content,   // alias — keeps older UI versions working
    tokens_used: result.tokensUsed,
    usage: {
      queries_used:      (usage.queries_used ?? 0) + 1,
      queries_limit:     usage.queries_limit,
      queries_remaining: usage.queries_remaining === -1 ? -1 : Math.max(0, (usage.queries_remaining ?? 0) - 1),
      is_unlimited:      usage.is_unlimited,
    },
  })
})
