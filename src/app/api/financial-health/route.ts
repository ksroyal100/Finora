import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { analyzeFinancialHealth } from '@/lib/ai/groq'
import { getUserPlan } from '@/services/subscription.service'

// GET /api/financial-health — get latest health score
export const GET = withAuth(async (req, { userId }) => {
  const db = createAdminClient()

  const { data: score } = await db
    .from('financial_health_scores')
    .select('*')
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  const { data: history } = await db
    .from('financial_health_scores')
    .select('overall_score, snapshot_date')
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })
    .limit(12)

  return apiSuccess({
    current: score ?? null,
    history: (history ?? []).reverse(),
    score_label: getScoreLabel(score?.overall_score ?? 0),
  })
})

// POST /api/financial-health — recalculate health score
export const POST = withAuth(async (req, { userId }) => {
  const plan = await getUserPlan(userId)
  const db = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Gather all financial data in parallel
  const [
    { data: assets },
    { data: liabilities },
    { data: portfolio },
    { data: budget },
    { data: goals },
  ] = await Promise.all([
    db.from('assets').select('value, type').eq('user_id', userId).eq('is_active', true),
    db.from('liabilities').select('balance, type, interest_rate, minimum_payment').eq('user_id', userId).eq('is_active', true),
    db.from('portfolios').select('total_value').eq('user_id', userId).eq('is_default', true).single(),
    db.from('budgets').select('total_income, total_spent').eq('user_id', userId).eq('is_active', true).single(),
    db.from('goals').select('category, progress_pct, status').eq('user_id', userId).eq('status', 'active'),
  ])

  const totalAssets = (assets ?? []).reduce((s, a) => s + a.value, 0)
  const totalLiabilities = (liabilities ?? []).reduce((s, l) => s + l.balance, 0)
  const netWorth = totalAssets - totalLiabilities

  const cashAssets = (assets ?? []).filter(a => a.type === 'cash').reduce((s, a) => s + a.value, 0)
  const monthlyExpenses = (budget as any)?.total_spent ?? 0
  const monthlyIncome = (budget as any)?.total_income ?? 0
  const portfolioValue = (portfolio as any)?.total_value ?? 0

  const highInterestDebt = (liabilities ?? [])
    .filter(l => l.interest_rate > 15 || l.type === 'credit_card')
    .reduce((s, l) => s + l.balance, 0)

  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0
  const emergencyFundMonths = monthlyExpenses > 0 ? cashAssets / monthlyExpenses : 0

  // Component scores (0-100 each)
  const emergencyFundScore = Math.min(100, (emergencyFundMonths / 6) * 100)
  const debtScore = highInterestDebt === 0 ? 100 : Math.max(0, 100 - (highInterestDebt / totalAssets) * 100)
  const savingsRateScore = Math.min(100, (savingsRate / 20) * 100)
  const investmentScore = portfolioValue > 0 ? Math.min(100, (portfolioValue / Math.max(monthlyIncome * 6, 1)) * 100) : 0
  const insuranceScore = 50  // Default until we track insurance assets
  const overallScore = Math.round(
    emergencyFundScore * 0.25 +
    debtScore * 0.25 +
    savingsRateScore * 0.20 +
    investmentScore * 0.20 +
    insuranceScore * 0.10
  )

  // AI-powered insights (Pro+ only)
  let insights: any[] = []
  let recommendations: any[] = []

  if (plan !== 'free') {
    try {
      const analysis = await analyzeFinancialHealth({
        netWorth,
        monthlyIncome,
        monthlyExpenses,
        totalDebt: totalLiabilities,
        emergencyFund: cashAssets,
        portfolioValue,
        savingsRate,
      })
      insights = analysis.insights
      recommendations = analysis.recommendations
    } catch (err) {
      console.error('[FinancialHealth] AI analysis failed:', err)
      insights = getDefaultInsights(emergencyFundScore, debtScore, savingsRateScore, investmentScore)
      recommendations = getDefaultRecommendations(emergencyFundMonths, highInterestDebt, savingsRate)
    }
  } else {
    insights = getDefaultInsights(emergencyFundScore, debtScore, savingsRateScore, investmentScore)
    recommendations = getDefaultRecommendations(emergencyFundMonths, highInterestDebt, savingsRate)
  }

  // Upsert score
  const { data: saved, error } = await db
    .from('financial_health_scores')
    .upsert({
      user_id: userId,
      overall_score: overallScore,
      emergency_fund_score: Math.round(emergencyFundScore),
      debt_score: Math.round(debtScore),
      savings_rate_score: Math.round(savingsRateScore),
      investment_score: Math.round(investmentScore),
      insurance_score: insuranceScore,
      snapshot_date: today,
      insights,
      recommendations,
    }, { onConflict: 'user_id,snapshot_date' })
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  return apiSuccess({
    score: saved,
    score_label: getScoreLabel(overallScore),
    breakdown: {
      emergency_fund: { score: Math.round(emergencyFundScore), months: emergencyFundMonths.toFixed(1) },
      debt: { score: Math.round(debtScore), high_interest_debt: highInterestDebt },
      savings: { score: Math.round(savingsRateScore), rate_pct: savingsRate.toFixed(1) },
      investments: { score: Math.round(investmentScore), portfolio_value: portfolioValue },
    },
  })
})

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Great'
  if (score >= 60) return 'Good'
  if (score >= 45) return 'Fair'
  if (score >= 30) return 'Needs Work'
  return 'Critical'
}

function getDefaultInsights(ef: number, debt: number, savings: number, invest: number) {
  const insights = []
  if (ef >= 80) insights.push({ type: 'emergency_fund', title: 'Strong Emergency Fund', description: 'You have a solid emergency fund to cover unexpected expenses.', severity: 'positive' })
  else if (ef < 40) insights.push({ type: 'emergency_fund', title: 'Emergency Fund Needs Attention', description: 'Build up to 6 months of expenses in liquid savings.', severity: 'warning' })
  if (debt >= 80) insights.push({ type: 'debt', title: 'Low High-Interest Debt', description: 'Great job avoiding high-interest debt!', severity: 'positive' })
  else if (debt < 50) insights.push({ type: 'debt', title: 'High-Interest Debt Detected', description: 'Prioritize paying off credit cards and high-interest loans.', severity: 'danger' })
  if (savings >= 60) insights.push({ type: 'savings', title: 'Healthy Savings Rate', description: 'Your savings rate is on track.', severity: 'positive' })
  else insights.push({ type: 'savings', title: 'Increase Your Savings Rate', description: 'Aim for at least 20% of income saved each month.', severity: 'warning' })
  if (invest >= 50) insights.push({ type: 'investment', title: 'Building Investment Portfolio', description: 'Your investments are growing. Stay consistent.', severity: 'positive' })
  else insights.push({ type: 'investment', title: 'Start Investing', description: 'Begin investing even small amounts to benefit from compounding.', severity: 'neutral' })
  return insights
}

function getDefaultRecommendations(efMonths: number, highDebt: number, savingsRate: number) {
  const recs = []
  if (efMonths < 3) recs.push({ priority: 1, action: 'Build Emergency Fund', description: 'Save 3-6 months of expenses in a high-yield savings account.', impact: 'high' })
  if (highDebt > 0) recs.push({ priority: 2, action: 'Pay Off High-Interest Debt', description: 'Use the avalanche method — pay minimums on all, extra on highest rate.', impact: 'high' })
  if (savingsRate < 15) recs.push({ priority: 3, action: 'Increase Savings Rate to 20%', description: 'Automate savings transfers on payday.', impact: 'high' })
  recs.push({ priority: 4, action: 'Maximize Retirement Contributions', description: 'Contribute at least enough to get full employer match.', impact: 'medium' })
  recs.push({ priority: 5, action: 'Invest in Low-Cost Index Funds', description: 'Start with broad market ETFs like VTI or VTSAX.', impact: 'medium' })
  return recs
}
