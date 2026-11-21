'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PerformanceTerminal } from '@/components/terminal/PerformanceTerminal'
import { buildDemoData, type TerminalData } from '@/lib/terminal/demo'
import { createClient } from '@/lib/supabase/client'

const POLL_MS = 30_000 // live refresh cadence while the tab is visible

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v) || 0)

async function loadRealData(): Promise<{ data: TerminalData; hasAny: boolean; latencyMs: number } | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const t0 = performance.now()
  const [port, hold, assets, liabs, snaps, txs, goals] = await Promise.all([
    supabase.from('portfolios').select('currency,last_synced_at').eq('user_id', user.id).eq('is_default', true).maybeSingle(),
    supabase.from('portfolio_holdings').select('*').eq('user_id', user.id),
    supabase.from('assets').select('value').eq('user_id', user.id).eq('is_active', true),
    supabase.from('liabilities').select('balance').eq('user_id', user.id).eq('is_active', true),
    supabase.from('net_worth_snapshots').select('snapshot_date,net_worth').eq('user_id', user.id)
      .order('snapshot_date', { ascending: false }).limit(730),
    supabase.from('portfolio_transactions').select('id,symbol,type,quantity,price,total_amount,transaction_date')
      .eq('user_id', user.id).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(20),
    supabase.from('goals').select('id,title,target_amount,current_amount,target_date,monthly_contribution,color')
      .eq('user_id', user.id).eq('status', 'active').order('priority', { ascending: false }).limit(8),
  ])
  const latencyMs = performance.now() - t0

  // If EVERY query failed this is an outage / auth problem, not an empty account.
  const results = [port, hold, assets, liabs, snaps, txs, goals]
  if (results.every(r => r.error)) throw new Error(results[0].error?.message ?? 'Could not load your data')

  const holdings = (hold.data ?? []).map((h: any) => ({
    symbol: h.symbol, name: h.name, asset_class: h.asset_class,
    quantity: num(h.quantity), avg_cost: num(h.avg_cost), current_price: h.current_price === null ? null : num(h.current_price),
    market_value: num(h.market_value), unrealized_gain: num(h.unrealized_gain), unrealized_gain_pct: num(h.unrealized_gain_pct),
    day_change: num(h.day_change), day_change_pct: num(h.day_change_pct),
  }))

  const totalAssets = (assets.data ?? []).reduce((s: number, a: any) => s + num(a.value), 0)
  const totalLiabilities = (liabs.data ?? []).reduce((s: number, l: any) => s + num(l.balance), 0)
  const hasBalanceSheet = (assets.data?.length ?? 0) + (liabs.data?.length ?? 0) > 0
  const netWorth = hasBalanceSheet ? totalAssets - totalLiabilities : null

  const series = [...(snaps.data ?? [])].reverse().map((s: any) => ({ date: s.snapshot_date as string, value: num(s.net_worth) }))
  // Append today's live figure so the curve ends where the headline number is.
  const today = new Date().toISOString().slice(0, 10)
  if (netWorth !== null && series.length && series[series.length - 1].date < today) {
    series.push({ date: today, value: netWorth })
  }

  const data: TerminalData = {
    currency: (port.data as any)?.currency ?? 'USD',
    netWorth, totalAssets, totalLiabilities, series, holdings,
    transactions: (txs.data ?? []).map((t: any) => ({
      id: t.id, symbol: t.symbol, type: t.type, quantity: num(t.quantity), price: num(t.price),
      total_amount: num(t.total_amount), transaction_date: t.transaction_date,
    })),
    goals: (goals.data ?? []).map((g: any) => ({
      id: g.id, title: g.title, target_amount: num(g.target_amount), current_amount: num(g.current_amount),
      target_date: g.target_date, monthly_contribution: g.monthly_contribution === null ? null : num(g.monthly_contribution), color: g.color,
    })),
    lastSyncedAt: (port.data as any)?.last_synced_at ?? null,
    isDemo: false,
  }
  const hasAny = holdings.length > 0 || series.length > 0 || hasBalanceSheet || data.goals.length > 0
  return { data, hasAny, latencyMs }
}

export default function PerformancePage() {
  const [real, setReal] = useState<TerminalData | null>(null)
  const [hasAny, setHasAny] = useState(false)
  const [latency, setLatency] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forceDemo, setForceDemo] = useState(false)
  const inFlight = useRef(false)
  const demo = useMemo(() => buildDemoData(), [])

  const refresh = useCallback(async (silent = false) => {
    if (inFlight.current) return // never stack overlapping requests
    inFlight.current = true
    if (!silent) setRefreshing(true)
    try {
      const res = await loadRealData()
      if (res) { setReal(res.data); setHasAny(res.hasAny); setLatency(res.latencyMs); setError(null) }
    } catch (e) {
      setError((e as Error).message) // keep showing the last good data
    } finally {
      inFlight.current = false
      setLoading(false); setRefreshing(false)
    }
  }, [])

  useEffect(() => { refresh(true) }, [refresh])

  // Live polling — paused while the tab is hidden, refreshed immediately on return.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') refresh(true) }
    const id = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [refresh])

  const showDemo = forceDemo || (!loading && !hasAny)
  const data = showDemo ? demo : real

  return (
    <div className="page-container fade-in">
      <PageHeader
        eyebrow="Live"
        title="Performance Terminal"
        description="Your whole financial picture in one live dashboard: equity curve, risk, allocation, goal pacing and forward simulations."
      />

      {error && (
        <div role="alert" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, fontSize: 12.5, color: 'var(--text-primary)', background: 'rgba(255,69,58,0.10)', border: '1px solid rgba(255,69,58,0.25)' }}>
          Couldn&apos;t refresh your data ({error}). Showing the last values we loaded. <button onClick={() => refresh()} style={{ marginLeft: 6, textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {showDemo && !forceDemo && !loading && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, fontSize: 12.5, color: 'var(--text-secondary)', background: 'rgba(255,176,32,0.08)', border: '1px solid rgba(255,176,32,0.22)' }}>
          You don&apos;t have any data yet, so this is a <b>demo</b> of what the terminal shows. Add holdings, assets or goals and it switches to your real numbers automatically.
        </div>
      )}

      {loading && !data ? (
        <div style={{ height: 520, borderRadius: 14, background: '#050607', border: '1px solid #1A1F26', animation: 'pulse 1.5s ease-in-out infinite' }} aria-busy="true" aria-label="Loading terminal" />
      ) : data ? (
        <PerformanceTerminal
          data={data}
          latencyMs={showDemo ? null : latency}
          refreshing={refreshing}
          onRefresh={() => refresh()}
          onToggleDemo={hasAny ? () => setForceDemo(v => !v) : undefined}
        />
      ) : (
        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sign in to view your terminal.</div>
      )}
    </div>
  )
}
