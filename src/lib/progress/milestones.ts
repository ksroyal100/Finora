// src/lib/progress/milestones.ts
//
// Pure, I/O-free logic behind the dashboard's Milestones + streak card.
// Everything is derived from data the app already stores (net-worth snapshots,
// goals, budget transactions), so nothing new has to be tracked.

const DAY_MS = 86_400_000

export const NET_WORTH_LADDER = [
  1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000,
  1_000_000, 2_500_000, 5_000_000, 10_000_000,
] as const

export interface NwPoint { date: string; value: number; liabilities?: number }

export interface Milestone {
  id: string
  kind: 'net_worth' | 'goal' | 'debt_free' | 'savings_rate'
  title: string
  detail: string
  achievedAt: string | null // YYYY-MM-DD, or null when we only know it is true now
  emoji: string
}

export interface NextMilestone {
  target: number
  current: number
  previousRung: number
  progressPct: number // progress between the previous rung and the target, 0..100
  remaining: number
  etaMonths: number | null // at the user's recent pace; null when not growing
}

const byDateAsc = (a: NwPoint, b: NwPoint) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)

const daysBetween = (a: string, b: string) =>
  (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY_MS

export function compactMoney(v: number, sym = '$'): string {
  const a = Math.abs(v)
  if (a >= 1e6) return `${sym}${+(a / 1e6).toFixed(a % 1e6 === 0 ? 0 : 1)}M`
  if (a >= 1e3) return `${sym}${+(a / 1e3).toFixed(a % 1e3 === 0 ? 0 : 1)}K`
  return `${sym}${a.toFixed(0)}`
}

/**
 * Net-worth ladder: which rungs have been crossed (and when), and what's next.
 * ETA uses the average monthly growth over (up to) the last 90 days of history.
 */
export function netWorthMilestones(input: NwPoint[], sym = '$'): { achieved: Milestone[]; next: NextMilestone | null } {
  const series = [...input].sort(byDateAsc)
  if (!series.length) return { achieved: [], next: null }
  const latest = series[series.length - 1]

  const achieved: Milestone[] = []
  for (const rung of NET_WORTH_LADDER) {
    if (latest.value < rung) break
    // first date the series was at/above the rung (and stayed ≥ at the end)
    const first = series.find(p => p.value >= rung)!
    achieved.push({
      id: `nw-${rung}`, kind: 'net_worth', emoji: rung >= 1_000_000 ? '🏆' : rung >= 100_000 ? '🚀' : '🎯',
      title: `${compactMoney(rung, sym)} net worth`, detail: first === series[0] ? 'Reached by the time you started tracking' : 'Crossed on this date',
      achievedAt: first.date,
    })
  }

  const prevRung = achieved.length ? NET_WORTH_LADDER[achieved.length - 1] : 0
  const nextRung = NET_WORTH_LADDER.find(r => r > latest.value) ?? null
  if (nextRung === null) return { achieved, next: null }

  // pace: average monthly change over the last <=90 days of history
  const cutoff = new Date(new Date(`${latest.date}T00:00:00Z`).getTime() - 90 * DAY_MS).toISOString().slice(0, 10)
  const window = series.filter(p => p.date >= cutoff)
  const base = window.length >= 2 ? window[0] : null
  let etaMonths: number | null = null
  if (base) {
    const days = daysBetween(base.date, latest.date)
    if (days >= 14) {
      const perMonth = ((latest.value - base.value) / days) * 30.4375
      if (perMonth > 0) etaMonths = Math.min(600, (nextRung - latest.value) / perMonth)
    }
  }
  const span = nextRung - prevRung
  return {
    achieved,
    next: {
      target: nextRung, current: latest.value, previousRung: prevRung,
      progressPct: Math.max(0, Math.min(100, ((latest.value - prevRung) / span) * 100)),
      remaining: nextRung - latest.value, etaMonths,
    },
  }
}

export interface GoalLike { title: string; progressPct: number }

/** Highest 25/50/75/100% band each goal has reached. */
export function goalMilestones(goals: GoalLike[]): Milestone[] {
  const out: Milestone[] = []
  for (const g of goals) {
    const band = [100, 75, 50, 25].find(b => g.progressPct >= b)
    if (!band) continue
    out.push({
      id: `goal-${g.title}-${band}`, kind: 'goal', emoji: band === 100 ? '✅' : '🎯',
      title: band === 100 ? `${g.title} fully funded` : `${g.title} passed ${band}%`,
      detail: band === 100 ? 'Goal complete' : `Now at ${Math.floor(g.progressPct)}%`, achievedAt: null,
    })
  }
  return out
}

/** Debt-free: liabilities were once > 0 and are now 0. Returns the date it first hit zero afterwards. */
export function debtFreeMilestone(input: NwPoint[]): Milestone | null {
  const series = [...input].filter(p => p.liabilities !== undefined).sort(byDateAsc)
  if (series.length < 2) return null
  const latest = series[series.length - 1]
  if ((latest.liabilities ?? 1) > 0) return null
  const hadDebtAt = series.findIndex(p => (p.liabilities ?? 0) > 0)
  if (hadDebtAt < 0) return null
  const zeroAfter = series.slice(hadDebtAt).find(p => (p.liabilities ?? 0) === 0)
  return {
    id: 'debt-free', kind: 'debt_free', emoji: '🔓', title: 'Debt free',
    detail: 'All liabilities paid off', achievedAt: zeroAfter?.date ?? latest.date,
  }
}

export function savingsRateMilestone(ratePct: number | null): Milestone | null {
  if (ratePct === null || !Number.isFinite(ratePct) || ratePct < 20) return null
  return {
    id: 'savings-20', kind: 'savings_rate', emoji: '💪',
    title: ratePct >= 40 ? 'Saving 40%+ of income' : 'Saving 20%+ of income',
    detail: `This month: ${ratePct.toFixed(0)}%`, achievedAt: null,
  }
}

// ── Weekly logging streak ─────────────────────────────────────

export interface Streak {
  current: number          // consecutive active weeks, including a grace week (see below)
  best: number
  thisWeekActive: boolean
  weeks: boolean[]         // oldest → newest, the last `weeksShown` weeks (newest = this week)
  atRisk: boolean          // streak is alive only thanks to last week; log something this week to keep it
}

const mondayOf = (d: Date) => {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  return day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY_MS
}

/**
 * A week is "active" if the user logged at least one transaction in it (Mon–Sun, UTC).
 * Grace: the current week doesn't break the streak until it has fully passed, so
 * a streak that ran through last week still counts on Monday morning.
 */
export function weeklyStreak(activityDates: string[], now: Date = new Date(), weeksShown = 12): Streak {
  const thisMonday = mondayOf(now)
  const active = new Set<number>()
  for (const d of activityDates) {
    const t = new Date(d.length === 10 ? `${d}T00:00:00Z` : d)
    if (!Number.isNaN(t.getTime()) && t.getTime() <= now.getTime() + DAY_MS) active.add(mondayOf(t))
  }

  const thisWeekActive = active.has(thisMonday)
  let current = 0
  let cursor = thisWeekActive ? thisMonday : thisMonday - 7 * DAY_MS
  while (active.has(cursor)) { current++; cursor -= 7 * DAY_MS }

  // best run over all active weeks
  const sorted = [...active].sort((a, b) => a - b)
  let best = 0, run = 0
  sorted.forEach((w, i) => {
    run = i > 0 && w - sorted[i - 1] === 7 * DAY_MS ? run + 1 : 1
    best = Math.max(best, run)
  })

  const weeks: boolean[] = []
  for (let i = weeksShown - 1; i >= 0; i--) weeks.push(active.has(thisMonday - i * 7 * DAY_MS))
  return { current, best, thisWeekActive, weeks, atRisk: current > 0 && !thisWeekActive }
}
