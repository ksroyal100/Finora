// src/lib/terminal/analytics.ts
//
// Pure calculation layer for the Performance Terminal (/performance).
// No React, no I/O — everything here is deterministic and unit-testable.
//
// Honesty notes baked into the definitions:
//  - The equity series is NET WORTH, so period growth includes deposits and
//    debt paydown, not just investment return. "Sharpe" is therefore a
//    growth-stability ratio, not a pure investment Sharpe. The UI labels it so.
//  - Annualisation uses the real spacing of the user's snapshots (daily,
//    weekly or monthly) rather than assuming a fixed frequency.
//  - With too little history we say so (`enough: false`) and the Monte Carlo
//    falls back to stated assumptions instead of inventing statistics.

export interface SeriesPoint { date: string; value: number } // date = YYYY-MM-DD

export const RISK_FREE_RATE = 0.04 // annual, used only in the Sharpe-style ratio
const DAY_MS = 86_400_000

// ── Small numeric helpers ─────────────────────────────────────

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)) // sample stdev
}

export function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0
  const idx = (sortedAsc.length - 1) * p
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo)
}

const median = (xs: number[]) => percentile([...xs].sort((a, b) => a - b), 0.5)
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY_MS)

// Deterministic PRNG so the Monte Carlo cone doesn't jitter on every re-render.
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(rand: () => number): number {
  // Box–Muller
  let u = 0
  while (u === 0) u = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

// ── Equity-curve statistics ───────────────────────────────────

export interface EquityStats {
  enough: boolean // >= 5 usable periods; otherwise ratios would be noise
  periods: number
  periodsPerYear: number
  totalReturnPct: number
  cagrPct: number | null // null when the span is < 30 days
  volAnnualPct: number
  sharpe: number | null
  maxDrawdownPct: number // <= 0
  currentDrawdownPct: number // <= 0
  winRatePct: number // share of periods with growth > 0
  bestPeriodPct: number
  worstPeriodPct: number
  drawdownSeries: number[] // per point, <= 0, in %
  returns: number[] // simple period returns (fractions)
}

export function computeEquityStats(series: SeriesPoint[]): EquityStats {
  const empty: EquityStats = {
    enough: false, periods: 0, periodsPerYear: 12, totalReturnPct: 0, cagrPct: null, volAnnualPct: 0,
    sharpe: null, maxDrawdownPct: 0, currentDrawdownPct: 0, winRatePct: 0, bestPeriodPct: 0,
    worstPeriodPct: 0, drawdownSeries: series.map(() => 0), returns: [],
  }
  if (series.length < 2) return empty

  // Period returns — skip steps where the base is <= 0 (a % change from zero or
  // negative net worth is meaningless and would poison the statistics).
  const returns: number[] = []
  const gaps: number[] = []
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].value
    if (prev > 0) {
      returns.push(series[i].value / prev - 1)
      gaps.push(Math.max(1, daysBetween(series[i - 1].date, series[i].date)))
    }
  }

  // Drawdown from running peak (only meaningful while the peak is positive)
  let peak = -Infinity
  const drawdownSeries = series.map(p => {
    peak = Math.max(peak, p.value)
    return peak > 0 ? ((p.value - peak) / peak) * 100 : 0
  })
  const maxDrawdownPct = Math.min(0, ...drawdownSeries)
  const currentDrawdownPct = drawdownSeries[drawdownSeries.length - 1]

  const first = series[0], last = series[series.length - 1]
  const spanDays = Math.max(1, daysBetween(first.date, last.date))
  const totalReturnPct = first.value > 0 ? (last.value / first.value - 1) * 100 : 0
  const cagrPct = spanDays >= 30 && first.value > 0 && last.value > 0
    ? (Math.pow(last.value / first.value, 365 / spanDays) - 1) * 100 : null

  const periodsPerYear = gaps.length ? Math.min(365, Math.max(1, 365 / median(gaps))) : 12
  const enough = returns.length >= 5
  const sd = stdev(returns)
  const volAnnual = sd * Math.sqrt(periodsPerYear)
  // Noise floor: a series that is perfectly smooth still has ~1e-17 float dust in its
  // stdev, which would otherwise explode the ratio. Treat sub-0.001% period vol as zero.
  const sharpe = enough && sd > 1e-5
    ? (mean(returns) - RISK_FREE_RATE / periodsPerYear) / sd * Math.sqrt(periodsPerYear)
    : null

  return {
    enough,
    periods: returns.length,
    periodsPerYear,
    totalReturnPct,
    cagrPct,
    volAnnualPct: volAnnual * 100,
    sharpe,
    maxDrawdownPct,
    currentDrawdownPct,
    winRatePct: returns.length ? (returns.filter(r => r > 0).length / returns.length) * 100 : 0,
    bestPeriodPct: returns.length ? Math.max(...returns) * 100 : 0,
    worstPeriodPct: returns.length ? Math.min(...returns) * 100 : 0,
    drawdownSeries,
    returns,
  }
}

// Trim a series to the last N days (relative to its own last point, not "today",
// so a user who stopped logging doesn't see an empty chart).
export function sliceRange(series: SeriesPoint[], days: number | null): SeriesPoint[] {
  if (!days || series.length < 2) return series
  const lastDate = series[series.length - 1].date
  const cutoff = new Date(new Date(`${lastDate}T00:00:00Z`).getTime() - days * DAY_MS).toISOString().slice(0, 10)
  const out = series.filter(p => p.date >= cutoff)
  return out.length >= 2 ? out : series.slice(-2)
}

// ── Portfolio concentration ───────────────────────────────────

export interface ConcentrationStats {
  hhi: number // 0..1 (Herfindahl–Hirschman on weights)
  effectiveHoldings: number // 1 / HHI — "how many equal-sized positions this behaves like"
  topWeightPct: number
  topSymbol: string | null
  diversificationScore: number // 0..100
  level: 'BALANCED' | 'ELEVATED' | 'HIGH' | 'N/A'
}

export function computeConcentration(holdings: Array<{ symbol: string; market_value: number }>): ConcentrationStats {
  const pos = holdings.filter(h => h.market_value > 0)
  const total = pos.reduce((s, h) => s + h.market_value, 0)
  if (!pos.length || total <= 0) {
    return { hhi: 0, effectiveHoldings: 0, topWeightPct: 0, topSymbol: null, diversificationScore: 0, level: 'N/A' }
  }
  const weights = pos.map(h => ({ symbol: h.symbol, w: h.market_value / total }))
  const hhi = weights.reduce((s, x) => s + x.w * x.w, 0)
  const top = weights.reduce((a, b) => (b.w > a.w ? b : a))
  // Score: 100 when spread over many names, 0 when everything is one position.
  const n = pos.length
  const minHhi = 1 / n
  const score = n === 1 ? 0 : Math.round(((1 - hhi) / (1 - minHhi)) * Math.min(100, 40 + n * 6))
  return {
    hhi,
    effectiveHoldings: 1 / hhi,
    topWeightPct: top.w * 100,
    topSymbol: top.symbol,
    diversificationScore: Math.max(0, Math.min(100, score)),
    level: top.w > 0.4 ? 'HIGH' : top.w > 0.25 ? 'ELEVATED' : 'BALANCED',
  }
}

// ── Monte Carlo (geometric Brownian motion on monthly steps) ──

export interface MonteCarloResult {
  months: number
  assumed: boolean // true when we had too little history and used default assumptions
  muMonthlyPct: number
  sigmaMonthlyPct: number
  start: number
  p10: number[]; p50: number[]; p90: number[] // length months + 1 (index 0 = today)
  endP10: number; endP50: number; endP90: number
  probAboveStart: number // 0..100
  probHitTarget: number | null // 0..100, only when a target is supplied
  paths: number
}

export const MC_DEFAULTS = { annualReturn: 0.07, annualVol: 0.15 }

export function monteCarlo(opts: {
  start: number
  stats: EquityStats
  months?: number
  paths?: number
  target?: number | null
  seed?: number
}): MonteCarloResult {
  const months = Math.max(1, Math.min(opts.months ?? 12, 120))
  const paths = Math.max(50, Math.min(opts.paths ?? 400, 2000))
  const { start, stats } = opts

  // Per-month drift & vol from the user's own history when there is enough of it.
  // log-returns: ln(1+r). Scale from "per observed period" to "per month".
  const assumed = !stats.enough || start <= 0
  let mu: number, sigma: number
  if (assumed) {
    mu = Math.log(1 + MC_DEFAULTS.annualReturn) / 12
    sigma = MC_DEFAULTS.annualVol / Math.sqrt(12)
  } else {
    const logs = stats.returns.map(r => Math.log(Math.max(1e-6, 1 + r)))
    // observed periods per month = periodsPerYear / 12
    mu = mean(logs) * (stats.periodsPerYear / 12) // drift scales linearly with time
    sigma = stdev(logs) * Math.sqrt(stats.periodsPerYear / 12) // volatility with sqrt(time)
  }
  // Guard rails: a short, lucky history shouldn't project 30%/month.
  mu = Math.max(-0.05, Math.min(0.05, mu))
  sigma = Math.max(0.005, Math.min(0.15, sigma))

  const rand = mulberry32(opts.seed ?? 20260101)
  const finals: number[] = []
  const grid: number[][] = Array.from({ length: months + 1 }, () => [])
  let hit = 0

  for (let p = 0; p < paths; p++) {
    let v = start
    let reached = opts.target != null && start >= opts.target
    grid[0].push(v)
    for (let m = 1; m <= months; m++) {
      // mu is already the mean *log* return, so no Itô correction is needed.
      v = v * Math.exp(mu + sigma * gaussian(rand))
      grid[m].push(v)
      if (opts.target != null && v >= opts.target) reached = true
    }
    finals.push(v)
    if (reached) hit++
  }

  const sorted = grid.map(col => [...col].sort((a, b) => a - b))
  const p10 = sorted.map(c => percentile(c, 0.1))
  const p50 = sorted.map(c => percentile(c, 0.5))
  const p90 = sorted.map(c => percentile(c, 0.9))
  return {
    months, assumed,
    muMonthlyPct: mu * 100, sigmaMonthlyPct: sigma * 100,
    start, p10, p50, p90,
    endP10: p10[months], endP50: p50[months], endP90: p90[months],
    probAboveStart: (finals.filter(f => f > start).length / paths) * 100,
    probHitTarget: opts.target != null ? (hit / paths) * 100 : null,
    paths,
  }
}

// ── Goal pacing ───────────────────────────────────────────────

export interface GoalPace {
  progressPct: number
  monthsLeft: number | null
  projected: number | null // at the planned monthly contribution, no growth assumed
  status: 'COMPLETE' | 'ON TRACK' | 'BEHIND' | 'NO DATE'
  requiredMonthly: number | null
}

// annualReturn: assumed yearly growth on the balance (default 0 = contributions only).
// Balance grows at the monthly-equivalent rate and each month's contribution is
// added at month end:  FV = cur·(1+r)^m + c·((1+r)^m − 1)/r
export function goalPace(g: {
  target_amount: number; current_amount: number; target_date: string | null; monthly_contribution: number | null
}, now: Date = new Date(), annualReturn = 0): GoalPace {
  const target = Number(g.target_amount) || 0
  const cur = Number(g.current_amount) || 0
  const progressPct = target > 0 ? Math.min(100, (cur / target) * 100) : 0
  if (target > 0 && cur >= target) {
    return { progressPct: 100, monthsLeft: null, projected: cur, status: 'COMPLETE', requiredMonthly: 0 }
  }
  if (!g.target_date) return { progressPct, monthsLeft: null, projected: null, status: 'NO DATE', requiredMonthly: null }

  const end = new Date(`${g.target_date}T00:00:00Z`)
  const monthsLeft = Math.max(0, (end.getTime() - now.getTime()) / (DAY_MS * 30.4375))
  const contrib = Number(g.monthly_contribution) || 0
  const r = annualReturn > 0 ? Math.pow(1 + annualReturn, 1 / 12) - 1 : 0
  const growth = Math.pow(1 + r, monthsLeft)                         // (1+r)^m
  const annuity = r > 0 ? (growth - 1) / r : monthsLeft              // Σ (1+r)^k  (→ m when r = 0)
  const projected = cur * growth + contrib * annuity
  const requiredMonthly = monthsLeft > 0 && annuity > 0 ? Math.max(0, (target - cur * growth) / annuity) : null
  return {
    progressPct, monthsLeft, projected,
    status: projected >= target ? 'ON TRACK' : 'BEHIND',
    requiredMonthly,
  }
}

// ── Holdings P&L roll-up ──────────────────────────────────────

export interface HoldingLike {
  symbol: string; name?: string | null; asset_class: string
  quantity: number; avg_cost: number; current_price: number | null
  market_value: number; unrealized_gain: number; unrealized_gain_pct: number
  day_change: number; day_change_pct: number
}

export function rollupHoldings(h: HoldingLike[]) {
  const value = h.reduce((s, x) => s + (Number(x.market_value) || 0), 0)
  const cost = h.reduce((s, x) => s + (Number(x.quantity) || 0) * (Number(x.avg_cost) || 0), 0)
  const dayChange = h.reduce((s, x) => s + (Number(x.day_change) || 0), 0)
  const prevValue = value - dayChange
  const inProfit = h.filter(x => (Number(x.unrealized_gain) || 0) > 0).length
  return {
    value, cost,
    gain: value - cost,
    gainPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
    dayChange,
    dayChangePct: prevValue > 0 ? (dayChange / prevValue) * 100 : 0,
    holdingsInProfitPct: h.length ? (inProfit / h.length) * 100 : 0,
    count: h.length,
  }
}
