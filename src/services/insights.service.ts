// src/services/insights.service.ts
//
// Generates proactive, actionable financial insights from a user's real data.
// Deliberately rule-based and transparent rather than an AI black box — every
// insight here is a specific, honest calculation the user could verify
// themselves, which matters more for trust in a financial product than
// sounding clever. AI Coach remains the place for open-ended AI analysis;
// this engine is the "things worth knowing without having to ask" layer the
// product currently lacks entirely.
//
// Deliberately NOT included: subscription-waste detection. That requires
// transaction-level data (recurring-charge pattern matching), and the schema
// only has aggregated budget_categories, not individual transactions — so a
// real implementation isn't possible yet. Rather than fake it, this is noted
// as a follow-up that needs a transactions table first.

import { createAdminClient } from '@/lib/supabase/server'

export type InsightSeverity = 'positive' | 'info' | 'warning' | 'critical'

export interface Insight {
  id: string
  severity: InsightSeverity
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
}

export async function generateInsights(userId: string): Promise<Insight[]> {
  const db = createAdminClient()

  const [
    { data: assets },
    { data: liabilities },
    { data: budget },
    { data: budgetCategories },
    { data: goals },
    { data: holdings },
  ] = await Promise.all([
    db.from('assets').select('value, type').eq('user_id', userId).eq('is_active', true),
    db.from('liabilities').select('name, balance, interest_rate, minimum_payment, type').eq('user_id', userId).eq('is_active', true),
    db.from('budgets').select('id, total_income, total_spent, total_budgeted').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('budget_categories').select('name, budgeted_amount, spent_amount').eq('user_id', userId),
    db.from('goals').select('title, target_amount, current_amount, target_date, started_at').eq('user_id', userId).eq('status', 'active'),
    db.from('portfolio_holdings').select('symbol, weight_pct').eq('user_id', userId),
  ])

  const insights: Insight[] = []

  const cashAssets = (assets ?? []).filter(a => a.type === 'cash').reduce((s, a) => s + (a.value ?? 0), 0)
  const totalAssets = (assets ?? []).reduce((s, a) => s + (a.value ?? 0), 0)
  const monthlyExpenses = (budget as any)?.total_spent ?? 0
  const monthlyIncome = (budget as any)?.total_income ?? 0

  // ── 1. High-interest debt cost ──────────────────────────────
  const highInterestDebts = (liabilities ?? []).filter(l => (l.interest_rate ?? 0) > 15)
  if (highInterestDebts.length > 0) {
    const monthlyCost = highInterestDebts.reduce((s, l) => s + (l.balance * (l.interest_rate / 100 / 12)), 0)
    const worst = highInterestDebts.sort((a, b) => b.interest_rate - a.interest_rate)[0]
    insights.push({
      id: 'high-interest-debt',
      severity: 'critical',
      title: `${worst.name} is costing you ${formatMoney(monthlyCost)}/mo in interest alone`,
      message: `At ${worst.interest_rate}% APR, paying this down faster than the minimum saves real money — try the Debt Payoff Planner to see how much.`,
      actionUrl: '/financial-toolkit/debt-payoff-planner',
      actionLabel: 'Plan payoff',
    })
  }

  // ── 2. Emergency fund gap ────────────────────────────────────
  if (monthlyExpenses > 0) {
    const monthsCovered = cashAssets / monthlyExpenses
    if (monthsCovered < 3) {
      insights.push({
        id: 'emergency-fund-low',
        severity: 'warning',
        title: `Your emergency fund covers ${monthsCovered.toFixed(1)} months of expenses`,
        message: 'Most planners recommend at least 3–6 months. Even a small automatic monthly transfer closes this gap faster than it feels like it will.',
        actionUrl: '/financial-toolkit/emergency-fund-planner',
        actionLabel: 'Build a plan',
      })
    } else if (monthsCovered > 12 && totalAssets > 0) {
      insights.push({
        id: 'idle-cash',
        severity: 'info',
        title: `You're holding ${monthsCovered.toFixed(0)} months of expenses in cash`,
        message: 'That\u2019s well beyond a typical emergency fund. Money sitting idle in cash long-term usually loses value to inflation — worth considering whether some belongs in your investments or a goal instead.',
      })
    }
  }

  // ── 3. Savings rate ──────────────────────────────────────────
  if (monthlyIncome > 0) {
    const savingsRate = ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100
    if (savingsRate < 0) {
      insights.push({
        id: 'negative-savings',
        severity: 'critical',
        title: `You spent ${formatMoney(monthlyExpenses - monthlyIncome)} more than you earned this period`,
        message: 'This is the single biggest thing to address before anything else — even small categories add up fast when spending exceeds income.',
        actionUrl: '/budgeting',
        actionLabel: 'Review budget',
      })
    } else if (savingsRate >= 20) {
      insights.push({
        id: 'strong-savings-rate',
        severity: 'positive',
        title: `You're saving ${savingsRate.toFixed(0)}% of your income`,
        message: 'That\u2019s a strong rate by any standard — keep it up, and consider whether your goals\u2019 timelines could move up.',
      })
    }
  }

  // ── 4. Budget category overspend ────────────────────────────
  const overspent = (budgetCategories ?? [])
    .filter(c => c.spent_amount > c.budgeted_amount && c.budgeted_amount > 0)
    .sort((a, b) => (b.spent_amount - b.budgeted_amount) - (a.spent_amount - a.budgeted_amount))[0]
  if (overspent) {
    const over = overspent.spent_amount - overspent.budgeted_amount
    insights.push({
      id: 'category-overspend',
      severity: 'warning',
      title: `${overspent.name} is ${formatMoney(over)} over budget this period`,
      message: `You've spent ${formatMoney(overspent.spent_amount)} against a ${formatMoney(overspent.budgeted_amount)} budget in this category.`,
      actionUrl: '/budgeting',
      actionLabel: 'Adjust budget',
    })
  }

  // ── 5. Goal behind schedule ──────────────────────────────────
  const today = new Date()
  for (const goal of goals ?? []) {
    if (!goal.target_date || !goal.started_at) continue
    const start = new Date(goal.started_at)
    const target = new Date(goal.target_date)
    const totalDuration = target.getTime() - start.getTime()
    if (totalDuration <= 0) continue
    const elapsedFraction = Math.min(1, (today.getTime() - start.getTime()) / totalDuration)
    const progressFraction = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0
    if (elapsedFraction > 0.25 && progressFraction < elapsedFraction - 0.15) {
      insights.push({
        id: `goal-behind-${goal.title}`,
        severity: 'warning',
        title: `"${goal.title}" is behind pace to hit its target date`,
        message: `You're ${(progressFraction * 100).toFixed(0)}% of the way there, ${(elapsedFraction * 100).toFixed(0)}% of the way through the timeline. Adjusting the monthly contribution or the target date would keep it realistic.`,
        actionUrl: '/goals',
        actionLabel: 'Review goal',
      })
      break // one goal insight at a time — don't overwhelm
    }
  }

  // ── 6. Portfolio concentration risk ─────────────────────────
  const topHolding = (holdings ?? []).sort((a, b) => (b.weight_pct ?? 0) - (a.weight_pct ?? 0))[0]
  if (topHolding && (topHolding.weight_pct ?? 0) > 40) {
    insights.push({
      id: 'concentration-risk',
      severity: 'info',
      title: `${topHolding.symbol} makes up ${topHolding.weight_pct.toFixed(0)}% of your portfolio`,
      message: 'A single holding above ~40% means your portfolio\u2019s performance is closely tied to one company or fund — worth knowing whether that\u2019s intentional.',
      actionUrl: '/portfolio',
      actionLabel: 'View portfolio',
    })
  }

  // Never overwhelm — surface the most important few, ranked by severity
  const severityRank: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2, positive: 3 }
  return insights.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]).slice(0, 4)
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(n))
}
