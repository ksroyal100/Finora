// src/app/api/support/chat/route.ts
//
// A lightweight AI support assistant, separate from AI Coach:
//  - Different system prompt (product/account help, not financial advice)
//  - Different, stricter rate limit (support chat is free for every plan,
//    so it needs its own cost guardrail independent of AI Coach's quota)
//  - Stateless — no new database tables. The client sends its own running
//    message history each turn, capped to the last few exchanges.
//
// Reuses the existing withAuth/rate-limit/Groq infrastructure exactly as
// AI Coach does, so this introduces no new patterns into the codebase.

import { NextRequest } from 'next/server'
import { withAuth, apiSuccess, apiError, checkRateLimit, getClientIP } from '@/lib/security/rbac'
import { createChatCompletion, MODELS, type ChatMessage } from '@/lib/ai/groq'
import { z } from 'zod'

const bodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(2000),
  })).min(1).max(20), // last ~10 exchanges is plenty of context for support
})

const SUPPORT_SYSTEM_PROMPT = `You are the Finora support assistant. You help users with questions about using the app: navigating features (Dashboard, Portfolio, Net Worth, Budgeting, Financial Toolkit, Reports, Marketplace, Community, subscriptions/billing), troubleshooting common issues, and explaining what a feature does.

Rules:
- You are NOT a financial, tax, or legal advisor. If asked for financial advice (e.g. "should I buy X stock", "how should I invest"), politely redirect to the in-app AI Coach or a licensed professional, and do not give investment recommendations.
- If a question needs a human (billing disputes, account security concerns, bugs you can't resolve, refund requests), say so plainly and point them to the Contact page.
- Keep answers short and concrete — 2-4 sentences unless steps are needed.
- Never ask for or reference a password, full card number, or other sensitive credentials.`

export const POST = withAuth(async (req: NextRequest, { userId }) => {
  // Separate, stricter limit from the general API limit — support chat has
  // no plan gating, so this is the only cost control on it.
  const ip = getClientIP(req)
  const limit = checkRateLimit(ip, 'support-chat', 15, 60_000) // 15 messages/min/IP
  if (!limit.allowed) {
    return apiError('You\u2019re sending messages too quickly. Please wait a moment and try again.', 429, 'RATE_LIMITED')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400)
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const messages: ChatMessage[] = parsed.data.messages.slice(-10) // keep the payload small regardless of client behavior

  try {
    const result = await createChatCompletion(messages, {
      model: MODELS.LLAMA_8B, // fast + cheap, appropriate for support Q&A
      systemPrompt: SUPPORT_SYSTEM_PROMPT,
      temperature: 0.4,
      maxTokens: 400,
    })

    return apiSuccess({ reply: result.content })
  } catch (err) {
    console.error('[support/chat] Groq request failed:', err)
    return apiError('The support assistant is temporarily unavailable. Please try again or use the Contact page.', 503)
  }
})
