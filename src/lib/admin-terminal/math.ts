// src/lib/admin-terminal/math.ts
//
// Pure, I/O-free calculations behind the admin Command Terminal. Kept separate
// from the data layer so every formula can be unit-tested against known values.
//
// Rule of thumb used throughout: when an input is missing or a denominator is
// zero we return `null` (rendered as "N/A"), never 0 or Infinity — a made-up
// zero on an executive dashboard is worse than an honest blank.

const DAY_MS = 86_400_000

export const isoDay = (d: Date) => d.toISOString().slice(0, 10)

export function safeDiv(a: number, b: number): number | null {
  return b > 0 && Number.isFinite(a / b) ? a / b : null
}

/** % change from `prev` to `cur`; null when prev is 0/absent. */
export function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null
  return ((cur - prev) / Math.abs(prev)) * 100
}

/** Trailing moving average (uses fewer points at the start rather than inventing zeros). */
export function movingAverage(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const from = Math.max(0, i - window + 1)
    const slice = values.slice(from, i + 1)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}

/** Every date from `from` to `to` inclusive (UTC), as YYYY-MM-DD. */
export function dateRange(from: Date, to: Date): string[] {
  const out: string[] = []
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  for (let t = start; t <= end; t += DAY_MS) out.push(isoDay(new Date(t)))
  return out
}

/** Count rows per UTC day and return a dense array aligned to `days`. */
export function countPerDay(timestamps: string[], days: string[]): number[] {
  const m = new Map<string, number>()
  timestamps.forEach(t => { const k = t.slice(0, 10); m.set(k, (m.get(k) ?? 0) + 1) })
  return days.map(d => m.get(d) ?? 0)
}

export function sumPerDay(rows: Array<{ at: string; amount: number }>, days: string[]): number[] {
  const m = new Map<string, number>()
  rows.forEach(r => { const k = r.at.slice(0, 10); m.set(k, (m.get(k) ?? 0) + r.amount) })
  return days.map(d => m.get(d) ?? 0)
}

// ── revenue_metrics helpers ───────────────────────────────────

export interface RevenueRow {
  date: string; mrr: number; arr: number
  new_mrr: number; expansion_mrr: number; contraction_mrr: number; churn_mrr: number; net_new_mrr: number
}

/** The snapshot nearest to (but not after) `daysAgo` days before the latest one. */
export function snapshotDaysAgo(rows: RevenueRow[], daysAgo: number): RevenueRow | null {
  if (!rows.length) return null
  const last = rows[rows.length - 1]
  const cutoff = isoDay(new Date(new Date(`${last.date}T00:00:00Z`).getTime() - daysAgo * DAY_MS))
  let found: RevenueRow | null = null
  for (const r of rows) { if (r.date <= cutoff) found = r; else break }
  return found
}

export function sumFlows(rows: RevenueRow[], days: number) {
  if (!rows.length) return { newMrr: 0, expansion: 0, contraction: 0, churn: 0, netNew: 0 }
  const last = rows[rows.length - 1]
  const cutoff = isoDay(new Date(new Date(`${last.date}T00:00:00Z`).getTime() - (days - 1) * DAY_MS))
  const inWin = rows.filter(r => r.date >= cutoff)
  const s = (k: keyof RevenueRow) => inWin.reduce((a, r) => a + (Number(r[k]) || 0), 0)
  return { newMrr: s('new_mrr'), expansion: s('expansion_mrr'), contraction: s('contraction_mrr'), churn: s('churn_mrr'), netNew: s('net_new_mrr') }
}

// ── SaaS unit economics ───────────────────────────────────────

export interface UnitEconomics {
  arpu: number | null
  monthlyChurnPct: number | null
  ltv: number | null
  cac: number | null
  ltvToCac: number | null
  paybackMonths: number | null
  quickRatio: number | null
  grossRevenueRetentionPct: number | null
}

export const LTV_CAP_MONTHS = 60 // never claim a customer lives > 5 years

export function unitEconomics(i: {
  mrr: number | null; payingCustomers: number
  churnedLogos30d: number; activeLogosStart30d: number
  marketingSpend30d: number; newPaid30d: number
  flows: { newMrr: number; expansion: number; contraction: number; churn: number }
  mrr30dAgo: number | null
}): UnitEconomics {
  const arpu = i.mrr !== null ? safeDiv(i.mrr, i.payingCustomers) : null
  const churn = safeDiv(i.churnedLogos30d, i.activeLogosStart30d)
  const monthlyChurnPct = churn === null ? null : churn * 100
  // LTV = ARPU / churn — but with zero observed churn the formula diverges, so we
  // report N/A unless there's real churn evidence, and cap the implied lifetime.
  const ltv = arpu !== null && churn !== null && churn > 0 ? arpu * Math.min(1 / churn, LTV_CAP_MONTHS) : null
  const cac = i.newPaid30d > 0 && i.marketingSpend30d > 0 ? i.marketingSpend30d / i.newPaid30d : null
  const ltvToCac = ltv !== null && cac !== null ? ltv / cac : null
  const paybackMonths = cac !== null && arpu !== null && arpu > 0 ? cac / arpu : null
  const quickRatio = safeDiv(i.flows.newMrr + i.flows.expansion, i.flows.churn + i.flows.contraction)
  const lost = i.flows.churn + i.flows.contraction
  const grr = i.mrr30dAgo !== null && i.mrr30dAgo > 0
    ? Math.max(0, Math.min(100, (1 - lost / i.mrr30dAgo) * 100)) : null
  return { arpu, monthlyChurnPct, ltv, cac, ltvToCac, paybackMonths, quickRatio, grossRevenueRetentionPct: grr }
}

// ── Heatmap: signups by weekday (Mon = 0) × hour (UTC) ────────

export function weekdayHourHeatmap(timestamps: string[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0))
  timestamps.forEach(t => {
    const d = new Date(t)
    if (Number.isNaN(d.getTime())) return
    grid[(d.getUTCDay() + 6) % 7][d.getUTCHours()]++
  })
  return grid
}

// ── Weekly signup cohorts ─────────────────────────────────────

export interface CohortRow { week: string; size: number; onboardedPct: number; activeNowPct: number }

export function weeklyCohorts(
  users: Array<{ created_at: string; last_active_at: string | null; onboarding_completed: boolean | null }>,
  now: Date, weeks = 8,
): CohortRow[] {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const thisMonday = day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY_MS
  const activeCutoff = now.getTime() - 30 * DAY_MS
  const out: CohortRow[] = []
  for (let w = weeks - 1; w >= 0; w--) {
    const start = thisMonday - w * 7 * DAY_MS, end = start + 7 * DAY_MS
    const cohort = users.filter(u => { const t = new Date(u.created_at).getTime(); return t >= start && t < end })
    const size = cohort.length
    out.push({
      week: isoDay(new Date(start)), size,
      onboardedPct: size ? (cohort.filter(u => u.onboarding_completed).length / size) * 100 : 0,
      activeNowPct: size ? (cohort.filter(u => u.last_active_at && new Date(u.last_active_at).getTime() >= activeCutoff).length / size) * 100 : 0,
    })
  }
  return out
}

export function topN<T extends string>(items: T[], n: number): Array<{ key: T; count: number }> {
  const m = new Map<T, number>()
  items.forEach(i => m.set(i, (m.get(i) ?? 0) + 1))
  return Array.from(m, ([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, n)
}

// ── Smart alerts ──────────────────────────────────────────────

export type AlertLevel = 'crit' | 'warn' | 'info' | 'ok'
export interface TerminalAlert { id: string; level: AlertLevel; title: string; detail: string }

export interface AlertInput {
  revenueSnapshotAgeDays: number | null   // null = no snapshots at all
  criticalSecurityOpen: number
  highSecurityOpen: number
  monthlyChurnPct: number | null
  signups24h: number
  signupsAvgPerDay7d: number
  mrr: number | null
  mrr7dAgo: number | null
  failedTasks24h: number
  pendingApprovals: number
  pastDueSubs: number
  dbLatencyMs: number
}

const LEVEL_ORDER: Record<AlertLevel, number> = { crit: 0, warn: 1, info: 2, ok: 3 }

export function buildAlerts(a: AlertInput): TerminalAlert[] {
  const out: TerminalAlert[] = []
  const push = (id: string, level: AlertLevel, title: string, detail: string) => out.push({ id, level, title, detail })

  if (a.revenueSnapshotAgeDays === null) {
    push('rev-none', 'info', 'No revenue snapshots yet', 'MRR/ARR need the daily revenue cron to run at least once.')
  } else if (a.revenueSnapshotAgeDays >= 4) {
    push('rev-stale', 'crit', 'Revenue data is stale', `Latest snapshot is ${a.revenueSnapshotAgeDays} days old. The daily revenue cron is probably not running.`)
  } else if (a.revenueSnapshotAgeDays >= 2) {
    push('rev-stale', 'warn', 'Revenue data is getting stale', `Latest snapshot is ${a.revenueSnapshotAgeDays} days old; check the daily revenue cron.`)
  }

  if (a.criticalSecurityOpen > 0) push('sec-crit', 'crit', `${a.criticalSecurityOpen} critical security event${a.criticalSecurityOpen > 1 ? 's' : ''} unresolved`, 'Review in Security Center now.')
  else if (a.highSecurityOpen > 0) push('sec-high', 'warn', `${a.highSecurityOpen} high-severity security event${a.highSecurityOpen > 1 ? 's' : ''} open`, 'Review in Security Center.')

  if (a.monthlyChurnPct !== null) {
    if (a.monthlyChurnPct >= 10) push('churn', 'crit', `Paid churn is ${a.monthlyChurnPct.toFixed(1)}% over 30 days`, 'Well above the ~3–5% a healthy monthly SaaS usually sees.')
    else if (a.monthlyChurnPct >= 5) push('churn', 'warn', `Paid churn is ${a.monthlyChurnPct.toFixed(1)}% over 30 days`, 'On the high side; check cancellation reasons.')
  }

  if (a.signups24h === 0 && a.signupsAvgPerDay7d >= 3) {
    push('signups', 'warn', 'No signups in the last 24 hours', `The 7-day average is ${a.signupsAvgPerDay7d.toFixed(1)}/day. Check the signup flow and traffic sources.`)
  }

  if (a.mrr !== null && a.mrr7dAgo !== null && a.mrr7dAgo > 0) {
    const drop = ((a.mrr7dAgo - a.mrr) / a.mrr7dAgo) * 100
    if (drop >= 15) push('mrr', 'crit', `MRR fell ${drop.toFixed(1)}% in 7 days`, 'Investigate cancellations and failed payments.')
    else if (drop >= 5) push('mrr', 'warn', `MRR fell ${drop.toFixed(1)}% in 7 days`, 'Check cancellations and failed payments.')
  }

  if (a.pastDueSubs > 0) push('pastdue', 'warn', `${a.pastDueSubs} subscription${a.pastDueSubs > 1 ? 's' : ''} past due`, 'Revenue at risk: payments are failing and retrying.')

  if (a.failedTasks24h >= 15) push('tasks', 'crit', `${a.failedTasks24h} AI agent tasks failed in 24h`, 'Check the agents dashboard for a failing workflow.')
  else if (a.failedTasks24h >= 5) push('tasks', 'warn', `${a.failedTasks24h} AI agent tasks failed in 24h`, 'Check the agents dashboard.')

  if (a.pendingApprovals >= 10) push('approvals', 'warn', `${a.pendingApprovals} agent decisions waiting for approval`, 'The approval queue is backing up.')
  else if (a.pendingApprovals > 0) push('approvals', 'info', `${a.pendingApprovals} agent decision${a.pendingApprovals > 1 ? 's' : ''} awaiting approval`, 'Open Decisions to review.')

  if (a.dbLatencyMs >= 1500) push('latency', 'warn', `Database queries are slow (${Math.round(a.dbLatencyMs)} ms)`, 'The terminal data took longer than usual to load.')

  if (!out.length) push('ok', 'ok', 'All systems nominal', 'No alerts: revenue data is fresh, no open critical security events, churn is within range.')
  return out.sort((x, y) => LEVEL_ORDER[x.level] - LEVEL_ORDER[y.level])
}
