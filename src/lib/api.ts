// ============================================================
// Finora — API client for server-side operations
// (AI Coach with GROQ, Stripe billing, etc.)
//
// Frontend and API now live in the same app, so this defaults to
// a relative, same-origin path. NEXT_PUBLIC_API_URL only needs to
// be set if you intentionally point this UI at a different API host.
// ============================================================

import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

async function getAuthHeaders(): Promise<HeadersInit> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
    }
  } catch {
    return { 'Content-Type': 'application/json' }
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
    credentials: 'include',
  })
  const json = await res.json().catch(() => ({ success: false, error: 'Invalid response from server' }))
  if (!res.ok || json.success === false) {
    throw new ApiError(res.status, json.error ?? `Request failed (${res.status})`, json.code)
  }
  return json.data ?? json
}

// ── AI Coach ─────────────────────────────────────────────────

export async function sendAIMessage(conversationId: string | null, message: string) {
  return request<{ response: string; conversation_id: string; usage: object }>('/api/ai-coach/conversations', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId, message, agent: 'coach' }),
  })
}

export async function getAIUsage() {
  return request<{ queries_used: number; queries_limit: number; resets_at: string }>('/api/ai-coach/usage')
}

// ── Billing / Stripe ─────────────────────────────────────────

export async function createCheckoutSession(priceId: string, interval: 'monthly' | 'yearly') {
  return request<{ url: string }>('/api/subscriptions/checkout', {
    method: 'POST',
    body: JSON.stringify({ price_id: priceId, interval }),
  })
}

export async function openBillingPortal() {
  return request<{ url: string }>('/api/subscriptions/portal', { method: 'POST' })
}

export async function getInvoices() {
  return request<Array<{ id: string; amount: number; status: string; date: string; url?: string }>>('/api/billing/invoices')
}
