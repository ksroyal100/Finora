import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { z } from 'zod'

const budgetSchema = z.object({
  name: z.string().min(1).max(100).default('My Budget'),
  period: z.enum(['weekly', 'monthly', 'yearly']).default('monthly'),
  total_income: z.number().min(0).default(0),
  currency: z.string().length(3).default('USD'),
  start_date: z.string(),
  end_date: z.string(),
})

const categorySchema = z.object({
  budget_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  icon: z.string().optional(),
  color: z.string().optional(),
  budgeted_amount: z.number().min(0),
  is_income: z.boolean().default(false),
  sort_order: z.number().default(0),
})

const txSchema = z.object({
  budget_id: z.string().uuid(),
  category_id: z.string().uuid(),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  is_income: z.boolean().default(false),
  date: z.string(),
  merchant: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  receipt_url: z.string().url().optional(),
  is_recurring: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
})

// GET /api/budgeting — get active budget with categories and transactions
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const budgetId = url.searchParams.get('budget_id')
  const db = createAdminClient()

  let query = db.from('budgets').select('*').eq('user_id', userId)
  if (budgetId) query = query.eq('id', budgetId)
  else query = query.eq('is_active', true).order('created_at', { ascending: false }).limit(1)

  const { data: budgets, error } = await query
  if (error) return apiError(error.message, 500)

  const budget = budgets?.[0]
  if (!budget) return apiSuccess(null)

  const [{ data: categories }, { data: transactions }] = await Promise.all([
    db.from('budget_categories').select('*').eq('budget_id', budget.id).order('sort_order'),
    db.from('budget_transactions').select('*, category:budget_categories!category_id(name, icon, color)')
      .eq('budget_id', budget.id).order('date', { ascending: false }).limit(100),
  ])

  const totalBudgeted = (categories ?? []).filter(c => !c.is_income).reduce((s, c) => s + c.budgeted_amount, 0)
  const totalSpent = (categories ?? []).filter(c => !c.is_income).reduce((s, c) => s + c.spent_amount, 0)
  const totalIncome = (categories ?? []).filter(c => c.is_income).reduce((s, c) => s + c.budgeted_amount, 0)

  return apiSuccess({
    budget: { ...budget, total_budgeted: totalBudgeted, total_spent: totalSpent, total_income: totalIncome },
    categories: categories ?? [],
    transactions: transactions ?? [],
    summary: {
      budgeted: totalBudgeted,
      spent: totalSpent,
      remaining: totalBudgeted - totalSpent,
      income: totalIncome,
      savings: totalIncome - totalSpent,
      savings_rate: totalIncome > 0 ? ((totalIncome - totalSpent) / totalIncome) * 100 : 0,
      budget_used_pct: totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0,
    },
  })
})

// POST /api/budgeting — create budget
export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = budgetSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()
  // Deactivate current budgets
  await db.from('budgets').update({ is_active: false }).eq('user_id', userId)

  const { data, error } = await db.from('budgets').insert({ user_id: userId, ...parsed.data }).select().single()
  if (error) return apiError(error.message, 500)

  // Create default categories
  const defaultCategories = [
    { name: 'Housing', icon: '🏠', color: '#7c3aed', budgeted_amount: 0, sort_order: 0 },
    { name: 'Food & Dining', icon: '🍔', color: '#ef4444', budgeted_amount: 0, sort_order: 1 },
    { name: 'Transportation', icon: '🚗', color: '#f59e0b', budgeted_amount: 0, sort_order: 2 },
    { name: 'Entertainment', icon: '🎬', color: '#8b5cf6', budgeted_amount: 0, sort_order: 3 },
    { name: 'Healthcare', icon: '🏥', color: '#10b981', budgeted_amount: 0, sort_order: 4 },
    { name: 'Savings & Investments', icon: '💰', color: '#06b6d4', budgeted_amount: 0, sort_order: 5 },
    { name: 'Salary', icon: '💼', color: '#22c55e', budgeted_amount: 0, is_income: true, sort_order: 10 },
  ]

  await db.from('budget_categories').insert(
    defaultCategories.map(c => ({ budget_id: data.id, user_id: userId, ...c }))
  )

  return apiSuccess(data, 201)
})
