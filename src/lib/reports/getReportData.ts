// src/lib/reports/getReportData.ts
//
// Pulls together the data that goes into an exported report. Runs entirely
// through the caller's own authenticated Supabase client, so Row Level
// Security does the access control — this never needs a service-role key.

import { SupabaseClient } from '@supabase/supabase-js'

export interface ReportAsset { name: string; type: string; value: number; institution: string | null }
export interface ReportLiability { name: string; type: string; balance: number; interest_rate: number | null }
export interface ReportHolding { symbol: string; name: string | null; quantity: number; market_value: number; unrealized_gain: number; unrealized_gain_pct: number; weight_pct: number }
export interface ReportGoal { title: string; category: string; target_amount: number; current_amount: number; progress_pct: number; target_date: string | null }

export interface ReportData {
  generatedAt: string
  profile: { name: string; email: string; currency: string }
  netWorth: {
    totalAssets: number
    totalLiabilities: number
    netWorth: number
    assets: ReportAsset[]
    liabilities: ReportLiability[]
  }
  portfolio: {
    totalValue: number
    totalGainLoss: number
    totalGainLossPct: number
    holdings: ReportHolding[]
  } | null
  budget: {
    totalIncome: number
    totalSpent: number
    remaining: number
  } | null
  goals: ReportGoal[]
}

export async function getReportData(supabase: SupabaseClient, userId: string): Promise<ReportData> {
  const [profileRes, assetsRes, liabilitiesRes, portfolioRes, holdingsRes, budgetRes, goalsRes] = await Promise.all([
    supabase.from('profiles').select('full_name, display_name, email, currency').eq('id', userId).single(),
    supabase.from('assets').select('name, type, value, institution').eq('user_id', userId).eq('is_active', true),
    supabase.from('liabilities').select('name, type, balance, interest_rate').eq('user_id', userId).eq('is_active', true),
    supabase.from('portfolios').select('id, total_value, total_gain_loss, total_gain_loss_pct').eq('user_id', userId).eq('is_default', true).maybeSingle(),
    supabase.from('portfolio_holdings').select('symbol, name, quantity, market_value, unrealized_gain, unrealized_gain_pct, weight_pct').eq('user_id', userId).order('market_value', { ascending: false }),
    supabase.from('budgets').select('total_income, total_spent').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('goals').select('title, category, target_amount, current_amount, progress_pct, target_date').eq('user_id', userId).eq('status', 'active').order('priority', { ascending: true }),
  ])

  const assets: ReportAsset[] = assetsRes.data ?? []
  const liabilities: ReportLiability[] = liabilitiesRes.data ?? []
  const totalAssets = assets.reduce((s, a) => s + (a.value ?? 0), 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + (l.balance ?? 0), 0)

  const profile = profileRes.data
  const income = budgetRes.data?.total_income ?? 0
  const spent = budgetRes.data?.total_spent ?? 0

  return {
    generatedAt: new Date().toISOString(),
    profile: {
      name: profile?.full_name || profile?.display_name || 'Finora Member',
      email: profile?.email ?? '',
      currency: profile?.currency ?? 'USD',
    },
    netWorth: {
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      assets,
      liabilities,
    },
    portfolio: portfolioRes.data
      ? {
          totalValue: portfolioRes.data.total_value ?? 0,
          totalGainLoss: portfolioRes.data.total_gain_loss ?? 0,
          totalGainLossPct: portfolioRes.data.total_gain_loss_pct ?? 0,
          holdings: holdingsRes.data ?? [],
        }
      : null,
    budget: budgetRes.data
      ? { totalIncome: income, totalSpent: spent, remaining: income - spent }
      : null,
    goals: goalsRes.data ?? [],
  }
}
