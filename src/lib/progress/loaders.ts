'use client'
// Client-side loaders (Supabase + RLS, same pattern as the Portfolio page). They only
// read, and every query is scoped to the signed-in user.

import { createClient } from '@/lib/supabase/client'

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v) || 0)
const isoDay = (d: Date) => d.toISOString().slice(0, 10)

export interface ProgressData {
  snapshots: Array<{ date: string; netWorth: number; liabilities: number }>
  transactions: Array<{ date: string; amount: number; isIncome: boolean; category: string | null }>
  holdings: Array<{ symbol: string; dayChangePct: number }>
  goals: Array<{ title: string; progressPct: number }>
  savingsRatePct: number | null
  hasAnyData: boolean
}

export async function loadProgressData(now: Date = new Date()): Promise<ProgressData | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const txFrom = isoDay(new Date(now.getTime() - 190 * 86_400_000)) // ~27 weeks: enough for the streak strip
  const [snaps, txs, holds, goals] = await Promise.all([
    supabase.from('net_worth_snapshots').select('snapshot_date,net_worth,total_liabilities')
      .eq('user_id', user.id).order('snapshot_date', { ascending: false }).limit(800),
    supabase.from('budget_transactions').select('date,amount,is_income,budget_categories!category_id(name)')
      .eq('user_id', user.id).gte('date', txFrom).order('date', { ascending: false }).limit(2000),
    supabase.from('portfolio_holdings').select('symbol,day_change_pct').eq('user_id', user.id),
    supabase.from('goals').select('title,target_amount,current_amount,progress_pct')
      .eq('user_id', user.id).eq('status', 'active').limit(12),
  ])

  const snapshots = [...(snaps.data ?? [])].reverse().map((s: any) => ({
    date: s.snapshot_date as string, netWorth: num(s.net_worth), liabilities: num(s.total_liabilities),
  }))
  const transactions = (txs.data ?? []).map((t: any) => ({
    date: t.date as string, amount: num(t.amount), isIncome: !!t.is_income,
    category: (Array.isArray(t.budget_categories) ? t.budget_categories[0]?.name : t.budget_categories?.name) ?? null,
  }))
  const holdings = (holds.data ?? []).map((h: any) => ({ symbol: h.symbol as string, dayChangePct: num(h.day_change_pct) }))
  const goalList = (goals.data ?? []).map((g: any) => ({
    title: g.title as string,
    progressPct: g.progress_pct != null ? num(g.progress_pct) : (num(g.target_amount) > 0 ? (num(g.current_amount) / num(g.target_amount)) * 100 : 0),
  }))

  // savings rate this calendar month = (income − spending) / income
  const monthStart = isoDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))
  const thisMonth = transactions.filter(t => t.date >= monthStart)
  const inc = thisMonth.filter(t => t.isIncome).reduce((a, t) => a + Math.abs(t.amount), 0)
  const spent = thisMonth.filter(t => !t.isIncome).reduce((a, t) => a + Math.abs(t.amount), 0)
  const savingsRatePct = inc > 0 ? ((inc - spent) / inc) * 100 : null

  return {
    snapshots, transactions, holdings, goals: goalList, savingsRatePct,
    hasAnyData: snapshots.length > 0 || transactions.length > 0 || holdings.length > 0 || goalList.length > 0,
  }
}

export interface SimulatorDefaults {
  startValue: number
  monthlyContribution: number
  goals: Array<{ id: string; title: string; target: number }>
  isSample: boolean   // true when we had no data and used generic starting values
}

export async function loadSimulatorDefaults(now: Date = new Date()): Promise<SimulatorDefaults> {
  const sample: SimulatorDefaults = { startValue: 10_000, monthlyContribution: 500, goals: [], isSample: true }
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return sample

  const monthStart = isoDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))
  const [snap, tx, goals] = await Promise.all([
    supabase.from('net_worth_snapshots').select('net_worth').eq('user_id', user.id).order('snapshot_date', { ascending: false }).limit(1),
    supabase.from('budget_transactions').select('amount,is_income').eq('user_id', user.id).gte('date', monthStart).limit(1000),
    supabase.from('goals').select('id,title,target_amount,monthly_contribution').eq('user_id', user.id).eq('status', 'active').limit(10),
  ])

  const start = Math.max(0, num(snap.data?.[0]?.net_worth))
  const inc = (tx.data ?? []).filter((t: any) => t.is_income).reduce((a: number, t: any) => a + Math.abs(num(t.amount)), 0)
  const spent = (tx.data ?? []).filter((t: any) => !t.is_income).reduce((a: number, t: any) => a + Math.abs(num(t.amount)), 0)
  const cashFlow = inc - spent
  const goalContrib = (goals.data ?? []).reduce((a: number, g: any) => a + num(g.monthly_contribution), 0)
  // prefer what they actually plan to save (goals), then what they actually saved this month
  const monthly = goalContrib > 0 ? goalContrib : cashFlow > 0 ? Math.round(cashFlow / 50) * 50 : 0

  if (start === 0 && monthly === 0 && !(goals.data ?? []).length) return sample
  return {
    startValue: Math.round(start),
    monthlyContribution: monthly,
    goals: (goals.data ?? []).filter((g: any) => num(g.target_amount) > 0).map((g: any) => ({ id: g.id, title: g.title, target: num(g.target_amount) })),
    isSample: false,
  }
}
