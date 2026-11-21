import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { z } from 'zod'

const assetSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['cash', 'investment', 'real_estate', 'business', 'vehicle', 'personal', 'retirement', 'crypto', 'other']),
  value: z.number().min(0),
  currency: z.string().length(3).default('USD'),
  institution: z.string().max(200).optional(),
  account_number_last4: z.string().max(4).optional(),
  notes: z.string().max(500).optional(),
  last_valued_at: z.string().optional(),
})

export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = assetSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()
  const { data, error } = await db.from('assets').insert({ user_id: userId, ...parsed.data }).select().single()
  if (error) return apiError(error.message, 500)

  // Auto-snapshot net worth
  try { await db.rpc('auto_net_worth_snapshot', { p_user_id: userId }) } catch { /* non-critical */ }

  return apiSuccess(data, 201)
})

export const PATCH = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return apiError('Asset ID required', 400)

  const db = createAdminClient()
  const { data, error } = await db.from('assets').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId).select().single()
  if (error) return apiError(error.message, 500)
  if (!data) return apiError('Asset not found', 404)

  try { await db.rpc('auto_net_worth_snapshot', { p_user_id: userId }) } catch { /* non-critical */ }
  return apiSuccess(data)
})

export const DELETE = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return apiError('Asset ID required', 400)

  const db = createAdminClient()
  const { error } = await db.from('assets').update({ is_active: false }).eq('id', id).eq('user_id', userId)
  if (error) return apiError(error.message, 500)

  try { await db.rpc('auto_net_worth_snapshot', { p_user_id: userId }) } catch { /* non-critical */ }
  return apiSuccess({ deleted: true })
})
