import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { z } from 'zod'

const liabilitySchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['mortgage', 'auto_loan', 'student_loan', 'credit_card', 'personal_loan', 'medical', 'tax', 'other']),
  balance: z.number().min(0),
  original_amount: z.number().min(0).optional(),
  interest_rate: z.number().min(0).max(100).default(0),
  minimum_payment: z.number().min(0).default(0),
  currency: z.string().length(3).default('USD'),
  institution: z.string().max(200).optional(),
  due_date: z.string().optional(),
  notes: z.string().max(500).optional(),
})

export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = liabilitySchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)
  const db = createAdminClient()
  const { data, error } = await db.from('liabilities').insert({ user_id: userId, ...parsed.data }).select().single()
  if (error) return apiError(error.message, 500)
  try { await db.rpc('auto_net_worth_snapshot', { p_user_id: userId }) } catch { /* non-critical */ }
  return apiSuccess(data, 201)
})

export const PATCH = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return apiError('Liability ID required', 400)
  const db = createAdminClient()
  const { data, error } = await db.from('liabilities').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId).select().single()
  if (error) return apiError(error.message, 500)
  if (!data) return apiError('Liability not found', 404)
  try { await db.rpc('auto_net_worth_snapshot', { p_user_id: userId }) } catch { /* non-critical */ }
  return apiSuccess(data)
})

export const DELETE = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return apiError('Liability ID required', 400)
  const db = createAdminClient()
  await db.from('liabilities').update({ is_active: false }).eq('id', id).eq('user_id', userId)
  try { await db.rpc('auto_net_worth_snapshot', { p_user_id: userId }) } catch { /* non-critical */ }
  return apiSuccess({ deleted: true })
})
