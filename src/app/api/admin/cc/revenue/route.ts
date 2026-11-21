import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/security/rbac'
import { calculateMRR, getSubscriptionMetrics } from '@/services/subscription.service'
import { orchestrator } from '@/lib/agents/orchestrator'

// GET /api/admin/cc/revenue — full revenue intelligence dashboard
export const GET = withAdmin(async (req) => {
  const db = createAdminClient()
  const url = new URL(req.url)
  const period = parseInt(url.searchParams.get('days') ?? '90')

  const [
    mrr,
    subMetrics,
    { data: revenueHistory },
    { data: orderStats },
    { data: payoutStats },
    { data: planBreakdown },
  ] = await Promise.all([
    calculateMRR(),
    getSubscriptionMetrics(),
    db.from('revenue_metrics').select('*').order('date', { ascending: false }).limit(period),
    db.from('marketplace_orders').select('total, status, created_at').eq('status', 'completed').order('created_at', { ascending: false }).limit(1000),
    db.from('creator_payouts').select('amount, status, period_start').order('created_at', { ascending: false }).limit(100),
    db.from('subscriptions').select('plan').eq('status', 'active').not('plan', 'eq', 'free'),
  ])

  const arr = mrr * 12
  const mpRevenue30d = (orderStats ?? [])
    .filter(o => new Date(o.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .reduce((sum, o) => sum + o.total, 0)

  // Plan distribution
  const planCounts = (planBreakdown ?? []).reduce((acc, s) => {
    acc[s.plan] = (acc[s.plan] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Cohort churn approximation from history
  const latest = revenueHistory?.[0]
  const prev30 = revenueHistory?.[29]
  const churnRate = prev30 && latest && prev30.mrr > 0
    ? Math.max(0, (prev30.mrr - latest.mrr) / prev30.mrr * 100) : 0

  // ARPU
  const paidCount = subMetrics?.paid ?? 1
  const arpu = paidCount > 0 ? mrr / paidCount : 0

  // LTV estimate (ARPU / churn)
  const monthlyChurn = churnRate / 100
  const ltv = monthlyChurn > 0 ? arpu / monthlyChurn : arpu * 24

  return apiSuccess({
    summary: {
      mrr,
      arr,
      mrr_growth_pct: prev30 && prev30.mrr > 0 ? ((mrr - prev30.mrr) / prev30.mrr * 100) : 0,
      marketplace_revenue_30d: mpRevenue30d,
      total_revenue_30d: mrr + mpRevenue30d,
      arpu,
      ltv,
      churn_rate_pct: churnRate,
    },
    subscriptions: {
      ...subMetrics,
      plan_distribution: planCounts,
      paid_percentage: subMetrics?.total && subMetrics.total > 0 ? ((subMetrics.paid / subMetrics.total) * 100).toFixed(1) : '0',
    },
    marketplace: {
      total_revenue: (orderStats ?? []).reduce((sum, o) => sum + o.total, 0),
      revenue_30d: mpRevenue30d,
      total_orders: orderStats?.length ?? 0,
      avg_order_value: orderStats?.length ? (orderStats.reduce((sum, o) => sum + o.total, 0) / orderStats.length) : 0,
    },
    history: revenueHistory ?? [],
    payouts: {
      total_paid: (payoutStats ?? []).filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
      pending: (payoutStats ?? []).filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0),
    },
  })
})

// POST /api/admin/cc/revenue — ask ATHENA for financial analysis
export const POST = withAdmin(async (req) => {
  const body = await req.json()
  const { question, include_data } = body

  if (!question) return apiError('Question required', 400)

  // Get live data for context
  const [mrr, metrics] = await Promise.all([calculateMRR(), getSubscriptionMetrics()])

  const context = include_data ? {
    current_mrr: mrr,
    current_arr: mrr * 12,
    subscription_metrics: metrics,
  } : {}

  const result = await orchestrator.delegateToAthena(question, context)

  return apiSuccess({
    agent: 'athena',
    question,
    analysis: result.content,
    tokens_used: result.tokensUsed,
  })
})
