import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { checkAIQueryUsage, getUserPlan } from '@/services/subscription.service'

// GET /api/dashboard — aggregate wealth dashboard data
export const GET = withAuth(async (req, { userId }) => {
  const plan = await getUserPlan(userId)
  const db = createAdminClient()

  const [
    { data: portfolio },
    { data: goals },
    { data: netWorthSnapshot },
    { data: budgetData },
    { data: recentTransactions },
    { data: notifications },
    { data: healthScore },
    aiUsage,
  ] = await Promise.all([
    db.from('portfolios')
      .select('total_value, total_gain_loss, total_gain_loss_pct, day_change, day_change_pct')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single(),
    db.from('goals')
      .select('id, title, target_amount, current_amount, progress_pct, category, icon, color, target_date, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('priority', { ascending: false })
      .limit(4),
    db.from('net_worth_snapshots')
      .select('net_worth, total_assets, total_liabilities, snapshot_date')
      .eq('user_id', userId)
      .order('snapshot_date', { ascending: false })
      .limit(13),
    db.from('budgets')
      .select('total_income, total_spent, total_budgeted')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single(),
    db.from('budget_transactions')
      .select('description, amount, is_income, date, category:budget_categories!category_id(name, icon, color)')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(5),
    db.from('notifications')
      .select('id, title, body, type, is_read, created_at, action_url')
      .eq('user_id', userId)
      .eq('channel', 'in_app')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5),
    db.from('financial_health_scores')
      .select('overall_score, snapshot_date')
      .eq('user_id', userId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single(),
    checkAIQueryUsage(userId),
  ])

  // Net worth calculations
  const snapshots = netWorthSnapshot ?? []
  const currentSnapshot = snapshots[0]
  const prevSnapshot = snapshots[1]
  const netWorth = currentSnapshot?.net_worth ?? 0
  const prevNetWorth = prevSnapshot?.net_worth ?? netWorth
  const netWorthChange = netWorth - prevNetWorth
  const netWorthChangePct = prevNetWorth !== 0 ? (netWorthChange / Math.abs(prevNetWorth)) * 100 : 0

  // Budget calculations
  const monthlyIncome = (budgetData as any)?.total_income ?? 0
  const monthlySpent = (budgetData as any)?.total_spent ?? 0
  const monthlyBudgeted = (budgetData as any)?.total_budgeted ?? 0
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlySpent) / monthlyIncome) * 100 : 0
  const budgetUsedPct = monthlyBudgeted > 0 ? (monthlySpent / monthlyBudgeted) * 100 : 0
  const cashFlow = monthlyIncome - monthlySpent

  // Goals summary
  const activeGoals = goals ?? []
  const goalsOnTrack = activeGoals.filter(g => (g.progress_pct ?? 0) >= 50).length

  // Portfolio
  const portfolioValue = (portfolio as any)?.total_value ?? 0
  const portfolioDayChange = (portfolio as any)?.day_change ?? 0
  const portfolioDayChangePct = (portfolio as any)?.day_change_pct ?? 0

  return apiSuccess({
    summary: {
      net_worth: netWorth,
      net_worth_change: netWorthChange,
      net_worth_change_pct: netWorthChangePct,
      total_assets: currentSnapshot?.total_assets ?? 0,
      total_liabilities: currentSnapshot?.total_liabilities ?? 0,
      portfolio_value: portfolioValue,
      portfolio_day_change: portfolioDayChange,
      portfolio_day_change_pct: portfolioDayChangePct,
      monthly_income: monthlyIncome,
      monthly_expenses: monthlySpent,
      cash_flow: cashFlow,
      savings_rate: savingsRate,
      budget_used_pct: budgetUsedPct,
      health_score: (healthScore as any)?.overall_score ?? null,
      active_goals: activeGoals.length,
      goals_on_track: goalsOnTrack,
    },
    goals: activeGoals,
    net_worth_history: snapshots.reverse().map(s => ({
      date: s.snapshot_date,
      net_worth: s.net_worth,
    })),
    recent_transactions: recentTransactions ?? [],
    unread_notifications: notifications ?? [],
    ai_usage: aiUsage,
    plan,
    quick_stats: {
      portfolio_return_pct: (portfolio as any)?.total_gain_loss_pct ?? 0,
      goals_completion_avg: activeGoals.length > 0
        ? activeGoals.reduce((s, g) => s + (g.progress_pct ?? 0), 0) / activeGoals.length
        : 0,
    },
  })
})
