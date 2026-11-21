import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { z } from 'zod'

const txSchema = z.object({
  budget_id: z.string().uuid(),
  category_id: z.string().uuid(),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  is_income: z.boolean().default(false),
  date: z.string(),
  merchant: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  is_recurring: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
})

export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const budgetId = url.searchParams.get('budget_id')
  const categoryId = url.searchParams.get('category_id')
  const { page, perPage, from, to } = getPagination(req)
  const db = createAdminClient()

  let query = db
    .from('budget_transactions')
    .select('*, category:budget_categories!category_id(name, icon, color)', { count: 'exact' })
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (budgetId) query = query.eq('budget_id', budgetId)
  if (categoryId) query = query.eq('category_id', categoryId)

  const { data, count, error } = await query.range(from, to)
  if (error) return apiError(error.message, 500)
  return apiSuccess({ data: data ?? [], total: count ?? 0, page, per_page: perPage })
})

export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = txSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()

  // Verify budget/category ownership
  const { data: category } = await db
    .from('budget_categories')
    .select('id, budgeted_amount, spent_amount')
    .eq('id', parsed.data.category_id)
    .eq('budget_id', parsed.data.budget_id)
    .eq('user_id', userId)
    .single()

  if (!category) return apiError('Category not found', 404)

  const { data, error } = await db
    .from('budget_transactions')
    .insert({ user_id: userId, ...parsed.data })
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  // Update category spent amount
  if (!parsed.data.is_income) {
    await db.from('budget_categories').update({
      spent_amount: category.spent_amount + parsed.data.amount
    }).eq('id', category.id)
  }

  return apiSuccess(data, 201)
})

export const DELETE = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return apiError('Transaction ID required', 400)

  const db = createAdminClient()
  const { data: tx } = await db.from('budget_transactions').select('*').eq('id', id).eq('user_id', userId).single()
  if (!tx) return apiError('Transaction not found', 404)

  await db.from('budget_transactions').delete().eq('id', id)

  // Reverse category spent amount
  if (!tx.is_income) {
    const { data: cat } = await db.from('budget_categories').select('spent_amount').eq('id', tx.category_id).single()
    if (cat) {
      await db.from('budget_categories').update({ spent_amount: Math.max(0, cat.spent_amount - tx.amount) }).eq('id', tx.category_id)
    }
  }

  return apiSuccess({ deleted: true })
})
