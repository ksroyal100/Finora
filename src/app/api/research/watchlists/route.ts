import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { z } from 'zod'

const watchlistSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  symbols: z.array(z.string().toUpperCase()).max(50).default([]),
  is_public: z.boolean().default(false),
})

export const GET = withAuth(async (req, { userId }) => {
  const db = createAdminClient()
  const { data, error } = await db
    .from('watchlists')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at')
  if (error) return apiError(error.message, 500)
  return apiSuccess(data ?? [])
})

export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = watchlistSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()
  const { data, error } = await db
    .from('watchlists')
    .insert({ user_id: userId, ...parsed.data })
    .select()
    .single()
  if (error) return apiError(error.message, 500)
  return apiSuccess(data, 201)
})

export const PATCH = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return apiError('Watchlist ID required', 400)

  const db = createAdminClient()
  const { data, error } = await db
    .from('watchlists')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
})

export const DELETE = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return apiError('Watchlist ID required', 400)
  const db = createAdminClient()
  await db.from('watchlists').delete().eq('id', id).eq('user_id', userId)
  return apiSuccess({ deleted: true })
})
