'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  computeEquityStats, computeConcentration, goalPace, monteCarlo, rollupHoldings, sliceRange,
} from '@/lib/terminal/analytics'
import type { TerminalData } from '@/lib/terminal/demo'
import {
  T, TERMINAL_CSS, Panel, AreaChart, DrawdownStrip, Ring, Gauge,
  fmtMoney, fmtCompact, fmtPct, tone, heatColor, useCountUp,
} from './ui'

const RANGES: Array<{ id: string; label: string; days: number | null }> = [
  { id: '1m', label: '1M', days: 30 }, { id: '3m', label: '3M', days: 90 },
  { id: '6m', label: '6M', days: 180 }, { id: '1y', label: '1Y', days: 365 }, { id: 'all', label: 'ALL', days: null },
]
const HORIZONS = [6, 12, 24, 60]
const GOAL_GROWTH = 0.04 // assumed yearly growth used for goal pacing (stated in the UI)
const CLASS_COLORS: Record<string, string> = {
  stock: '#19D67A', etf: '#38D5FF', crypto: '#FFB020', bond: '#64D2FF',
  real_estate: '#B069FF', commodity: '#FF3B47', cash: '#FFD60A', other: '#8E8E93',
}

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', timeZone: 'UTC' })

interface Props {
  data: TerminalData
  latencyMs: number | null
  refreshing: boolean
  onRefresh: () => void
  /** Present when the user has real data AND can flip between it and the demo. */
  onToggleDemo?: () => void
}

export function PerformanceTerminal({ data, latencyMs, refreshing, onRefresh, onToggleDemo }: Props) {
  const cur = data.currency
  const [rangeId, setRangeId] = useState('1y')
  const [horizon, setHorizon] = useState(12)
  const [goalId, setGoalId] = useState<string | null>(null)
  const [seed, setSeed] = useState(20260101)
  const [heatMode, setHeatMode] = useState<'day' | 'total'>('day')

  // Clock only after mount — avoids a server/client hydration mismatch.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // ── derived analytics ──────────────────────────────────────
  const range = RANGES.find(r => r.id === rangeId)!
  const fullStats = useMemo(() => computeEquityStats(data.series), [data.series])
  const series = useMemo(() => sliceRange(data.series, range.days), [data.series, range.days])
  const stats = useMemo(() => computeEquityStats(series), [series])
  const roll = useMemo(() => rollupHoldings(data.holdings), [data.holdings])
  const conc = useMemo(() => computeConcentration(data.holdings), [data.holdings])

  const lastSeries = data.series.length ? data.series[data.series.length - 1].value : null
  const headline = data.netWorth ?? lastSeries ?? (roll.count ? roll.value : 0)
  const headlineLabel = data.netWorth !== null || lastSeries !== null ? 'Net worth' : 'Portfolio value'
  const animated = useCountUp(headline)

  const goals = useMemo(() => data.goals.map(g => ({ g, pace: goalPace(g, new Date(), GOAL_GROWTH) })), [data.goals])
  const selectedGoal = goalId ? data.goals.find(g => g.id === goalId) ?? null : null

  const mc = useMemo(() => monteCarlo({
    start: headline, stats: fullStats, months: horizon, target: selectedGoal ? selectedGoal.target_amount : null, seed,
  }), [headline, fullStats, horizon, selectedGoal, seed])

  const byClass = useMemo(() => {
    const m = new Map<string, number>()
    data.holdings.forEach(h => m.set(h.asset_class, (m.get(h.asset_class) ?? 0) + (Number(h.market_value) || 0)))
    const total = Array.from(m.values()).reduce((a, b) => a + b, 0) || 1
    return Array.from(m, ([k, v]) => ({ k, v, pct: (v / total) * 100 })).sort((a, b) => b.v - a.v)
  }, [data.holdings])

  const sortedHoldings = useMemo(
    () => [...data.holdings].sort((a, b) => (Number(b.market_value) || 0) - (Number(a.market_value) || 0)), [data.holdings])
  const heatScale = heatMode === 'day'
    ? Math.max(1, ...data.holdings.map(h => Math.abs(h.day_change_pct)))
    : Math.max(5, ...data.holdings.map(h => Math.abs(h.unrealized_gain_pct)))

  const movers = useMemo(
    () => [...data.holdings].sort((a, b) => Math.abs(b.day_change_pct) - Math.abs(a.day_change_pct)).slice(0, 12), [data.holdings])

  const syncedAt = data.lastSyncedAt ? new Date(data.lastSyncedAt) : null
  const hasSeries = data.series.length >= 2

  return (
    <div className="pt-root">
      <style>{TERMINAL_CSS}</style>

      {/* ── Status bar ─────────────────────────────────────── */}
      <div className="pt-row" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontWeight: 800, letterSpacing: '.04em', fontSize: 13 }}>
          <span style={{ color: T.amber }}>F</span>INORA <span style={{ color: T.dim }}>×</span> TERMINAL
        </div>
        <span className={`pt-chip ${data.isDemo ? 'a' : 'g'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className={`pt-dot ${data.isDemo ? 'demo' : ''}`} />{data.isDemo ? 'DEMO DATA' : 'LIVE'}
        </span>
        <span className="pt-chip">{cur}</span>
        <span style={{ flex: 1 }} />
        {onToggleDemo && (
          <button className={`pt-chip ${data.isDemo ? 'on' : ''}`} onClick={onToggleDemo}>
            {data.isDemo ? 'EXIT DEMO' : 'PREVIEW DEMO'}
          </button>
        )}
        {latencyMs !== null && <span className="pt-chip c">{Math.round(latencyMs)}MS</span>}
        {syncedAt && <span className="pt-chip" title="Last time your holdings were synced">SYNCED {syncedAt.toISOString().slice(11, 19)}Z</span>}
        <span className="pt-chip" style={{ minWidth: 76, textAlign: 'center' }}>{now ? now.toISOString().slice(11, 19) : '--:--:--'} UTC</span>
        <button className="pt-chip" onClick={onRefresh} aria-label="Refresh data" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <RefreshCw size={10} style={{ animation: refreshing ? 'pt-spin .8s linear infinite' : 'none' }} />REFRESH
        </button>
      </div>

      {/* ── Movers tape ────────────────────────────────────── */}
      {movers.length > 0 && (
        <div className="pt-tape" style={{ marginBottom: 8 }}>
          <div className="in">
            {[0, 1].map(dup => (
              <span key={dup} style={{ display: 'inline-flex', gap: 26 }}>
                {movers.map(h => (
                  <span key={`${dup}-${h.symbol}`}>
                    <b>{h.symbol}</b>{' '}
                    <span style={{ color: T.dim }}>{fmtMoney(Number(h.current_price) || 0, cur, (Number(h.current_price) || 0) < 100)}</span>{' '}
                    <span style={{ color: tone(h.day_change_pct) }}>{h.day_change_pct >= 0 ? '▲' : '▼'} {Math.abs(h.day_change_pct).toFixed(2)}%</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="pt-grid">
        {/* ── Hero ─────────────────────────────────────────── */}
        <Panel title={headlineLabel} sub={data.isDemo ? 'sample account' : 'all assets − liabilities'} className="pt-c5"
          right={<span className="pt-chip a">{RANGES.find(r => r.id === rangeId)!.label}</span>}>
          <div className="pt-big" style={{ fontSize: 'clamp(34px, 5.2vw, 58px)', marginBottom: 8, wordBreak: 'break-all' }}>
            {fmtMoney(animated, cur)}
          </div>
          <div className="pt-row" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
            {hasSeries && (
              <span className={`pt-chip ${stats.totalReturnPct >= 0 ? 'g' : 'r'}`}>
                {fmtPct(stats.totalReturnPct)} · {range.label}
              </span>
            )}
            {roll.count > 0 && (
              <span className={`pt-chip ${roll.dayChange >= 0 ? 'g' : 'r'}`}>
                TODAY {roll.dayChange >= 0 ? '+' : '−'}{fmtMoney(Math.abs(roll.dayChange), cur)} ({fmtPct(roll.dayChangePct)})
              </span>
            )}
            {data.totalAssets > 0 && <span className="pt-chip">ASSETS {fmtCompact(data.totalAssets, cur)}</span>}
            {data.totalLiabilities > 0 && <span className="pt-chip">DEBT {fmtCompact(data.totalLiabilities, cur)}</span>}
          </div>
          <div className="pt-kpi">
            <Kpi label="CAGR" value={fullStats.cagrPct !== null ? fmtPct(fullStats.cagrPct, 1) : 'N/A'} color={fullStats.cagrPct !== null ? tone(fullStats.cagrPct) : T.dim} hint="Annualised growth over your full history (needs 30+ days)" />
            <Kpi label="UP PERIODS" value={stats.periods ? `${stats.winRatePct.toFixed(0)}%` : 'N/A'} color={!stats.periods ? T.dim : stats.winRatePct >= 50 ? T.green : T.amber} hint="Share of snapshot-to-snapshot periods where net worth grew" />
            <Kpi label="SHARPE*" value={stats.sharpe !== null ? stats.sharpe.toFixed(2) : 'N/A'} color={stats.sharpe === null ? T.dim : stats.sharpe >= 1 ? T.green : stats.sharpe >= 0 ? T.amber : T.red} hint="Growth stability vs a 4% risk-free rate. Needs 5+ periods. Includes deposits, so it is not a pure investment Sharpe." />
            <Kpi label="MAX DD" value={hasSeries ? fmtPct(stats.maxDrawdownPct, 1, false) : 'N/A'} color={!hasSeries ? T.dim : stats.maxDrawdownPct < -15 ? T.red : stats.maxDrawdownPct < -7 ? T.amber : T.green} hint="Largest peak-to-trough fall in the selected range" />
          </div>
          {roll.count > 0 && (
            <div className="pt-kpi" style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
              <Kpi label="PORTFOLIO" value={fmtCompact(roll.value, cur)} color={T.text} hint="Current market value of all holdings" />
              <Kpi label="UNREALIZED" value={`${roll.gain >= 0 ? '+' : '−'}${fmtCompact(Math.abs(roll.gain), cur)}`} color={tone(roll.gain)} hint="Market value minus what you paid" />
              <Kpi label="IN PROFIT" value={`${roll.holdingsInProfitPct.toFixed(0)}%`} color={roll.holdingsInProfitPct >= 50 ? T.green : T.amber} hint="Share of your positions currently above cost" />
              <Kpi label="VOL / YR" value={fullStats.enough ? `${fullStats.volAnnualPct.toFixed(1)}%` : 'N/A'} color={T.text} hint="Annualised volatility of net-worth growth" />
            </div>
          )}
        </Panel>

        {/* ── Equity curve ─────────────────────────────────── */}
        <Panel title="Equity curve" sub="net worth over time" className="pt-c7"
          right={<div className="pt-row" style={{ gap: 4 }}>
            {RANGES.map(r => (
              <button key={r.id} className={`pt-chip ${rangeId === r.id ? 'on' : ''}`} onClick={() => setRangeId(r.id)}>{r.label}</button>
            ))}
          </div>}>
          {hasSeries ? (
            <>
              <AreaChart
                values={series.map(p => p.value)} labels={series.map(p => shortDate(p.date))} height={178}
                secondary={stats.drawdownSeries} fmt={v => fmtCompact(v, cur)} hoverFmt={i => fmtMoney(series[i].value, cur)} />
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 8.5, letterSpacing: '.1em', color: T.dim, marginBottom: 2 }}>DRAWDOWN FROM PEAK</div>
                <DrawdownStrip dd={stats.drawdownSeries} />
              </div>
            </>
          ) : (
            <Empty text="Not enough history yet. Net worth snapshots build your equity curve." cta={{ href: '/net-worth', label: 'Open Net Worth' }} />
          )}
        </Panel>

        {/* ── Holdings heat grid ───────────────────────────── */}
        <Panel title="Holdings heat grid" sub={`${roll.count} positions`} className="pt-c7"
          right={<div className="pt-row" style={{ gap: 4 }}>
            <button className={`pt-chip ${heatMode === 'day' ? 'on' : ''}`} onClick={() => setHeatMode('day')}>TODAY</button>
            <button className={`pt-chip ${heatMode === 'total' ? 'on' : ''}`} onClick={() => setHeatMode('total')}>ALL-TIME</button>
          </div>}>
          {roll.count ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 5 }}>
                {sortedHoldings.map(h => {
                  const v = heatMode === 'day' ? h.day_change_pct : h.unrealized_gain_pct
                  return (
                    <div key={h.symbol} title={`${h.name ?? h.symbol} · ${fmtMoney(Number(h.market_value) || 0, cur)}`}
                      style={{ background: heatColor(v, heatScale), border: `1px solid ${T.line}`, borderRadius: 5, padding: '7px 8px' }}>
                      <div style={{ fontWeight: 800, fontSize: 11, marginBottom: 2 }}>{h.symbol}</div>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: v >= 0 ? '#CFFFE5' : '#FFD3D6' }}>{fmtPct(v, 1)}</div>
                      <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>{fmtCompact(Number(h.market_value) || 0, cur)}</div>
                    </div>
                  )
                })}
              </div>
              <div className="pt-row" style={{ marginTop: 9, color: T.dim, fontSize: 9.5, flexWrap: 'wrap', gap: 14 }}>
                <span>VALUE <b style={{ color: T.text }}>{fmtMoney(roll.value, cur)}</b></span>
                <span>COST <b style={{ color: T.text }}>{fmtMoney(roll.cost, cur)}</b></span>
                <span>P&amp;L <b style={{ color: tone(roll.gain) }}>{roll.gain >= 0 ? '+' : '−'}{fmtMoney(Math.abs(roll.gain), cur)} ({fmtPct(roll.gainPct, 1)})</b></span>
                <span>IN PROFIT <b style={{ color: T.text }}>{roll.holdingsInProfitPct.toFixed(0)}%</b></span>
              </div>
            </>
          ) : (
            <Empty text="No holdings yet. Add positions to light up the grid." cta={{ href: '/portfolio', label: 'Open Portfolio' }} />
          )}
        </Panel>

        {/* ── Allocation + concentration ───────────────────── */}
        <Panel title="Allocation" sub="by asset class" className="pt-c5"
          right={<span className={`pt-chip ${conc.level === 'HIGH' ? 'r' : conc.level === 'ELEVATED' ? 'a' : 'g'}`}>{conc.level === 'N/A' ? 'NO DATA' : `${conc.level} CONC.`}</span>}>
          {byClass.length ? (
            <div className="pt-row" style={{ alignItems: 'flex-start', gap: 14 }}>
              <Ring pct={conc.diversificationScore} size={96} color={conc.diversificationScore >= 60 ? T.green : conc.diversificationScore >= 35 ? T.amber : T.red}
                label={`${conc.diversificationScore}`} sub="diversif." />
              <div style={{ flex: 1, minWidth: 0 }}>
                {byClass.map(c => (
                  <div key={c.k} style={{ marginBottom: 6 }}>
                    <div className="pt-row" style={{ justifyContent: 'space-between', fontSize: 9.5, marginBottom: 2 }}>
                      <span style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>{c.k.replace('_', ' ')}</span>
                      <span style={{ color: T.dim }}>{c.pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 4, background: T.line, borderRadius: 2 }}>
                      <div style={{ width: `${c.pct}%`, height: '100%', background: CLASS_COLORS[c.k] ?? T.dim, borderRadius: 2, boxShadow: `0 0 6px ${(CLASS_COLORS[c.k] ?? T.dim)}66` }} />
                    </div>
                  </div>
                ))}
                {conc.topSymbol && (
                  <div style={{ fontSize: 9, color: T.dim, marginTop: 6 }}>
                    TOP POSITION <b style={{ color: T.text }}>{conc.topSymbol} {conc.topWeightPct.toFixed(1)}%</b> · ACTS LIKE <b style={{ color: T.text }}>{conc.effectiveHoldings.toFixed(1)}</b> EQUAL POSITIONS
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Empty text="Allocation appears once you add holdings." cta={{ href: '/portfolio', label: 'Open Portfolio' }} />
          )}
        </Panel>

        {/* ── Monte Carlo ──────────────────────────────────── */}
        <Panel title="Monte Carlo cone" sub={`${mc.paths} simulated futures`} className="pt-c7"
          right={<div className="pt-row" style={{ gap: 4, flexWrap: 'wrap' }}>
            {HORIZONS.map(h => (
              <button key={h} className={`pt-chip ${horizon === h ? 'on' : ''}`} onClick={() => setHorizon(h)}>{h >= 12 ? `${h / 12}Y` : `${h}M`}</button>
            ))}
            <button className="pt-chip" onClick={() => setSeed(s => s + 1)} title="Run a fresh set of simulations">RESEED</button>
          </div>}>
          {headline > 0 ? (
            <>
            <AreaChart
              values={mc.p50} labels={mc.p50.map((_, i) => (i === 0 ? 'NOW' : `+${i}M`))} height={170} color={T.cyan}
              band={{ lo: mc.p10, hi: mc.p90 }} refLine={selectedGoal ? { value: selectedGoal.target_amount, label: `GOAL ${fmtCompact(selectedGoal.target_amount, cur)}` } : null}
              fmt={v => fmtCompact(v, cur)} hoverFmt={i => `${fmtCompact(mc.p10[i], cur)} · ${fmtCompact(mc.p50[i], cur)} · ${fmtCompact(mc.p90[i], cur)}`} />
            <div className="pt-row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 14, fontSize: 9.5, color: T.dim }}>
              <span>P10 <b style={{ color: T.red }}>{fmtCompact(mc.endP10, cur)}</b></span>
              <span>MEDIAN <b style={{ color: T.cyan }}>{fmtCompact(mc.endP50, cur)}</b></span>
              <span>P90 <b style={{ color: T.green }}>{fmtCompact(mc.endP90, cur)}</b></span>
              <span>P(GROWTH) <b style={{ color: T.text }}>{mc.probAboveStart.toFixed(0)}%</b></span>
              {mc.probHitTarget !== null && <span>P(GOAL) <b style={{ color: T.amber }}>{mc.probHitTarget.toFixed(0)}%</b></span>}
            </div>
            <div style={{ fontSize: 8.5, color: T.faint, marginTop: 6, lineHeight: 1.5 }}>
              {mc.assumed
                ? `ASSUMED: not enough history yet, so this uses ${7}% return / ${15}% volatility a year. It is an illustration, not a forecast.`
                : `Built from your own history: ${mc.muMonthlyPct.toFixed(2)}%/mo drift, ${mc.sigmaMonthlyPct.toFixed(2)}%/mo volatility. Past growth includes deposits. Not a guarantee.`}
            </div>
            </>
          ) : (
            <Empty text="Add assets or holdings so we can simulate where your net worth could go." cta={{ href: '/net-worth', label: 'Open Net Worth' }} />
          )}
          {data.goals.length > 0 && (
            <div className="pt-row" style={{ gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 8.5, color: T.dim, letterSpacing: '.1em' }}>TARGET:</span>
              <button className={`pt-chip ${goalId === null ? 'on' : ''}`} onClick={() => setGoalId(null)}>NONE</button>
              {data.goals.map(g => (
                <button key={g.id} className={`pt-chip ${goalId === g.id ? 'on' : ''}`} onClick={() => setGoalId(g.id)}>{g.title.toUpperCase().slice(0, 18)}</button>
              ))}
            </div>
          )}
        </Panel>

        {/* ── Goal rings ───────────────────────────────────── */}
        <Panel title="Goal progress" sub="pace vs deadline" className="pt-c5"
          right={<Link href="/goals" className="pt-chip" style={{ textDecoration: 'none' }}>MANAGE</Link>}>
          {goals.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {goals.slice(0, 4).map(({ g, pace }) => {
                const c = pace.status === 'COMPLETE' ? T.green : pace.status === 'ON TRACK' ? T.cyan : pace.status === 'BEHIND' ? T.red : T.dim
                return (
                  <div key={g.id} className="pt-row" style={{ gap: 12 }}>
                    <Ring pct={pace.progressPct} size={66} stroke={6} color={c} label={`${Math.round(pace.progressPct)}%`} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.title}</div>
                      <div style={{ color: T.dim, fontSize: 9.5, margin: '2px 0 4px' }}>
                        {fmtCompact(Number(g.current_amount), cur)} / {fmtCompact(Number(g.target_amount), cur)}
                        {pace.monthsLeft !== null && ` · ${pace.monthsLeft >= 12 ? `${(pace.monthsLeft / 12).toFixed(1)}y` : `${Math.round(pace.monthsLeft)}mo`} left`}
                      </div>
                      <div className="pt-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        <span className="pt-chip" style={{ color: c, borderColor: `${c}55` }}>{pace.status}</span>
                        {pace.status === 'BEHIND' && pace.requiredMonthly !== null && (
                          <span style={{ fontSize: 9, color: T.dim }}>NEED {fmtMoney(pace.requiredMonthly, cur)}/MO</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Empty text="Set a goal to track pace against its deadline." cta={{ href: '/goals', label: 'Open Goals' }} />
          )}
          {goals.length > 0 && (
            <div style={{ fontSize: 8.5, color: T.faint, marginTop: 10, lineHeight: 1.5 }}>
              Pace assumes your planned monthly contribution plus {GOAL_GROWTH * 100}%/yr growth on the balance.
            </div>
          )}
        </Panel>

        {/* ── Risk meters ──────────────────────────────────── */}
        <Panel title="Risk meters" sub="how bumpy is the ride" className="pt-c5">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <Gauge value={Math.abs(fullStats.currentDrawdownPct)} max={25} label="Drawdown now" display={hasSeries ? `${Math.abs(fullStats.currentDrawdownPct).toFixed(1)}%` : 'N/A'}
              color={Math.abs(fullStats.currentDrawdownPct) > 15 ? T.red : Math.abs(fullStats.currentDrawdownPct) > 7 ? T.amber : T.green} />
            <Gauge value={fullStats.volAnnualPct} max={40} label="Volatility / yr" display={fullStats.enough ? `${fullStats.volAnnualPct.toFixed(0)}%` : 'N/A'}
              color={fullStats.volAnnualPct > 25 ? T.red : fullStats.volAnnualPct > 12 ? T.amber : T.green} />
            <Gauge value={conc.topWeightPct} max={60} label="Top position" display={conc.level === 'N/A' ? 'N/A' : `${conc.topWeightPct.toFixed(0)}%`}
              color={conc.level === 'HIGH' ? T.red : conc.level === 'ELEVATED' ? T.amber : T.green} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginTop: 10, fontSize: 9.5, color: T.dim }}>
            <span>BEST PERIOD <b style={{ color: T.green }}>{hasSeries ? fmtPct(fullStats.bestPeriodPct, 1) : 'N/A'}</b></span>
            <span>WORST PERIOD <b style={{ color: T.red }}>{hasSeries ? fmtPct(fullStats.worstPeriodPct, 1) : 'N/A'}</b></span>
            <span>OBSERVATIONS <b style={{ color: T.text }}>{fullStats.periods}</b></span>
            <span>CADENCE <b style={{ color: T.text }}>{fullStats.periods ? `${Math.round(365 / fullStats.periodsPerYear)}D` : 'N/A'}</b></span>
          </div>
        </Panel>

        {/* ── Activity tape ────────────────────────────────── */}
        <Panel title="Activity tape" sub="latest transactions" className="pt-c7">
          {data.transactions.length ? (
            <table className="pt-tbl">
              <thead><tr><th>Date</th><th>Type</th><th>Symbol</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
              <tbody>
                {data.transactions.slice(0, 8).map(t => {
                  const c = t.type === 'buy' ? T.green : t.type === 'sell' ? T.red : T.amber
                  return (
                    <tr key={t.id}>
                      <td style={{ color: T.dim }}>{shortDate(t.transaction_date)}</td>
                      <td><span style={{ color: c, fontWeight: 700 }}>{t.type.toUpperCase()}</span></td>
                      <td style={{ fontWeight: 700 }}>{t.symbol}</td>
                      <td>{Number(t.quantity).toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
                      <td>{fmtMoney(Number(t.price), cur, Number(t.price) < 100)}</td>
                      <td style={{ color: T.text }}>{fmtMoney(Number(t.total_amount), cur)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <Empty text="No transactions logged yet." cta={{ href: '/portfolio', label: 'Open Portfolio' }} />
          )}
        </Panel>
      </div>

      <div style={{ fontSize: 8.5, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>
        * Sharpe, volatility and drawdown are measured on net worth, so deposits and debt payments count as growth. Figures are educational estimates, not investment advice.
      </div>
    </div>
  )
}

function Kpi({ label, value, color, hint }: { label: string; value: string; color: string; hint: string }) {
  return (
    <div title={hint}>
      <div className="l">{label}</div>
      <div className="v" style={{ color }}>{value}</div>
    </div>
  )
}

function Empty({ text, cta }: { text: string; cta: { href: string; label: string } }) {
  return (
    <div style={{ padding: '26px 8px', textAlign: 'center', color: T.dim, fontSize: 10.5, lineHeight: 1.6 }}>
      <div style={{ marginBottom: 10 }}>{text}</div>
      <Link href={cta.href} className="pt-chip a" style={{ textDecoration: 'none' }}>{cta.label.toUpperCase()} →</Link>
    </div>
  )
}
