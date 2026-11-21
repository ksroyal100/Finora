import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError, getClientIP } from '@/lib/security/rbac'
import { z } from 'zod'

const eventSchema = z.object({
  event_name: z.string().min(1).max(200),
  properties: z.record(z.unknown()).default({}),
  session_id: z.string().optional(),
  page_url: z.string().optional(),
  referrer: z.string().optional(),
  device_type: z.enum(['desktop', 'mobile', 'tablet']).optional(),
})

const batchSchema = z.object({
  events: z.array(eventSchema).min(1).max(50),
})

// POST /api/analytics — track events
export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const ip = getClientIP(req)
  const ua = req.headers.get('user-agent') ?? ''
  const db = createAdminClient()

  // Batch events
  if (body.events) {
    const parsed = batchSchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed', 400)

    const rows = parsed.data.events.map(e => ({
      event_name: e.event_name,
      user_id: userId,
      session_id: e.session_id ?? null,
      properties: e.properties,
      ip_address: ip,
      user_agent: ua,
      page_url: e.page_url ?? null,
      referrer: e.referrer ?? null,
      device_type: e.device_type ?? null,
    }))

    await db.from('platform_analytics').insert(rows)
    return apiSuccess({ tracked: rows.length })
  }

  // Single event
  const parsed = eventSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  await db.from('platform_analytics').insert({
    event_name: parsed.data.event_name,
    user_id: userId,
    session_id: parsed.data.session_id ?? null,
    properties: parsed.data.properties,
    ip_address: ip,
    user_agent: ua,
    page_url: parsed.data.page_url ?? null,
    referrer: parsed.data.referrer ?? null,
    device_type: parsed.data.device_type ?? null,
  })

  return apiSuccess({ tracked: true })
})

// GET /api/analytics — user-facing analytics
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') ?? '30')
  const db = createAdminClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [
    { data: portfolio },
    { data: goalsData },
    { data: budgetData },
    { data: netWorthHistory },
    { data: aiUsage },
  ] = await Promise.all([
    db.from('portfolios').select('total_value, total_gain_loss_pct, day_change_pct').eq('user_id', userId).eq('is_default', true).single(),
    db.from('goals').select('status, progress_pct, category').eq('user_id', userId).eq('status', 'active'),
    db.from('budgets').select('total_income, total_spent, total_budgeted').eq('user_id', userId).eq('is_active', true).single(),
    db.from('net_worth_snapshots').select('net_worth, snapshot_date').eq('user_id', userId).order('snapshot_date', { ascending: false }).limit(days),
    db.from('ai_usage_logs').select('query_count, week_start').eq('user_id', userId).order('week_start', { ascending: false }).limit(8),
  ])

  const activeGoals = goalsData ?? []
  const onTrackGoals = activeGoals.filter(g => (g.progress_pct ?? 0) >= 50)
  const savingsRate = budgetData && budgetData.total_income > 0
    ? ((budgetData.total_income - budgetData.total_spent) / budgetData.total_income) * 100 : 0

  return apiSuccess({
    portfolio: {
      total_value: (portfolio as any)?.total_value ?? 0,
      gain_loss_pct: (portfolio as any)?.total_gain_loss_pct ?? 0,
      day_change_pct: (portfolio as any)?.day_change_pct ?? 0,
    },
    goals: {
      total: activeGoals.length,
      on_track: onTrackGoals.length,
      avg_progress: activeGoals.length > 0
        ? activeGoals.reduce((s, g) => s + (g.progress_pct ?? 0), 0) / activeGoals.length : 0,
    },
    budget: {
      income: budgetData?.total_income ?? 0,
      spent: budgetData?.total_spent ?? 0,
      savings_rate: savingsRate,
      budget_used_pct: budgetData && budgetData.total_budgeted > 0
        ? (budgetData.total_spent / budgetData.total_budgeted) * 100 : 0,
    },
    net_worth_history: (netWorthHistory ?? []).reverse(),
    ai_coach_usage: aiUsage ?? [],
  })
})
