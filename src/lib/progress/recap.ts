// src/lib/progress/recap.ts
//
// "Your week in money": a plain-English summary of the last 7 days built only from
// data the app already stores. Pure and deterministic (pass `now`), so it is easy to
// test. Every sentence is derived from a number; when the data isn't there we say
// less rather than invent something.

const DAY_MS = 86_400_000

export interface RecapInput {
  now: Date
  snapshots: Array<{ date: string; netWorth: number }>
  transactions: Array<{ date: string; amount: number; isIncome: boolean; category: string | null }>
  holdings: Array<{ symbol: string; dayChangePct: number }>
  goals: Array<{ title: string; progressPct: number }>
  fmt: (n: number) => string // currency formatter supplied by the caller
}

export interface Highlight { tone: 'good' | 'bad' | 'neutral'; text: string }
export interface RecapAction { label: string; href: string; reason: string }

export interface Recap {
  periodLabel: string
  netWorth: { hasData: boolean; change: number; changePct: number | null }
  spending: {
    thisWeek: number; lastWeek: number; changePct: number | null
    topCategory: { name: string; amount: number; sharePct: number } | null
  }
  income: number
  txCountThisWeek: number
  topMover: { symbol: string; dayChangePct: number } | null
  headline: string
  highlights: Highlight[]
  action: RecapAction | null
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const label = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export function buildWeeklyRecap(input: RecapInput): Recap {
  const { now, fmt } = input
  const end = iso(now)
  const start = iso(new Date(now.getTime() - 6 * DAY_MS))          // 7 inclusive days
  const prevStart = iso(new Date(now.getTime() - 13 * DAY_MS))
  const prevEnd = iso(new Date(now.getTime() - 7 * DAY_MS))
  const periodLabel = `${label(new Date(now.getTime() - 6 * DAY_MS))} – ${label(now)}`

  // ── net worth: latest snapshot vs the last snapshot before the window ──
  const snaps = [...input.snapshots].sort((a, b) => (a.date < b.date ? -1 : 1))
  const latest = snaps[snaps.length - 1]
  // baseline = last snapshot strictly BEFORE the window, so all 7 days of change are counted
  const baseline = [...snaps].reverse().find(s => s.date < start)
  const nwHas = !!latest && !!baseline && latest.date > baseline.date && latest.date >= start
  const nwChange = nwHas ? latest.netWorth - baseline!.netWorth : 0
  const nwPct = nwHas && baseline!.netWorth !== 0 ? (nwChange / Math.abs(baseline!.netWorth)) * 100 : null

  // ── spending / income ──
  const inWeek = (d: string) => d >= start && d <= end
  const inPrev = (d: string) => d >= prevStart && d <= prevEnd
  const spendWeek = input.transactions.filter(t => !t.isIncome && inWeek(t.date))
  const spendPrev = input.transactions.filter(t => !t.isIncome && inPrev(t.date))
  const sum = (xs: Array<{ amount: number }>) => xs.reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)
  const thisWeek = sum(spendWeek), lastWeek = sum(spendPrev)
  const income = sum(input.transactions.filter(t => t.isIncome && inWeek(t.date)))
  const txCountThisWeek = input.transactions.filter(t => inWeek(t.date)).length
  const spendChangePct = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : null

  const byCat = new Map<string, number>()
  spendWeek.forEach(t => { const k = t.category ?? 'Uncategorized'; byCat.set(k, (byCat.get(k) ?? 0) + Math.abs(Number(t.amount) || 0)) })
  const topEntry = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]
  const topCategory = topEntry && thisWeek > 0
    ? { name: topEntry[0], amount: topEntry[1], sharePct: (topEntry[1] / thisWeek) * 100 } : null

  // ── holdings mover (today) ──
  const mover = [...input.holdings].filter(h => Number.isFinite(h.dayChangePct) && h.dayChangePct !== 0)
    .sort((a, b) => Math.abs(b.dayChangePct) - Math.abs(a.dayChangePct))[0]
  const topMover = mover && Math.abs(mover.dayChangePct) >= 1 ? { symbol: mover.symbol, dayChangePct: mover.dayChangePct } : null

  // ── goals ──
  const nearest = [...input.goals].filter(g => g.progressPct < 100 && g.progressPct >= 50)
    .sort((a, b) => b.progressPct - a.progressPct)[0]

  // ── highlights (only what the numbers support) ──
  const highlights: Highlight[] = []
  if (nwHas && nwChange !== 0) {
    const pct = nwPct !== null ? ` (${nwPct >= 0 ? '+' : '−'}${Math.abs(nwPct).toFixed(1)}%)` : ''
    highlights.push({ tone: nwChange > 0 ? 'good' : 'bad', text: `Net worth ${nwChange > 0 ? 'grew' : 'fell'} ${fmt(Math.abs(nwChange))}${pct}` })
  }
  if (spendChangePct !== null && Math.abs(spendChangePct) >= 10) {
    highlights.push({
      tone: spendChangePct < 0 ? 'good' : 'bad',
      text: `Spending is ${spendChangePct < 0 ? 'down' : 'up'} ${Math.abs(spendChangePct).toFixed(0)}% on last week (${fmt(thisWeek)} vs ${fmt(lastWeek)})`,
    })
  } else if (thisWeek > 0) {
    highlights.push({ tone: 'neutral', text: `You spent ${fmt(thisWeek)} this week${lastWeek > 0 ? ', in line with last week' : ''}` })
  }
  if (topCategory && topCategory.sharePct >= 25) {
    highlights.push({ tone: 'neutral', text: `Biggest category: ${topCategory.name}, ${fmt(topCategory.amount)} (${topCategory.sharePct.toFixed(0)}% of spending)` })
  }
  if (topMover) {
    highlights.push({
      tone: topMover.dayChangePct > 0 ? 'good' : 'bad',
      text: `${topMover.symbol} is ${topMover.dayChangePct > 0 ? 'up' : 'down'} ${Math.abs(topMover.dayChangePct).toFixed(1)}% today`,
    })
  }
  if (nearest) highlights.push({ tone: 'good', text: `${nearest.title} is ${Math.floor(nearest.progressPct)}% funded, so you're close` })

  // ── headline ──
  let headline: string
  if (nwHas && nwChange > 0) headline = `Good week: net worth up ${fmt(nwChange)}.`
  else if (nwHas && nwChange < 0) headline = `Tougher week: net worth down ${fmt(Math.abs(nwChange))}.`
  else if (txCountThisWeek > 0) headline = `You logged ${txCountThisWeek} transaction${txCountThisWeek > 1 ? 's' : ''} this week.`
  else headline = 'A quiet week so far.'

  // ── one next best action ──
  let action: RecapAction | null = null
  if (txCountThisWeek === 0) {
    action = { label: 'Log this week\u2019s spending', href: '/budgeting', reason: 'Nothing logged in the last 7 days; a minute now keeps your numbers accurate.' }
  } else if (spendChangePct !== null && spendChangePct >= 25) {
    action = { label: 'Review your budget', href: '/budgeting', reason: `Spending jumped ${spendChangePct.toFixed(0)}% on last week.` }
  } else if (nearest) {
    action = { label: `Top up ${nearest.title}`, href: '/goals', reason: `You're ${Math.floor(nearest.progressPct)}% of the way there.` }
  } else if (nwHas && nwChange > 0) {
    action = { label: 'Plan your next move', href: '/simulator', reason: 'See what a bit more saving each month could do over time.' }
  } else {
    action = { label: 'Ask your AI coach', href: '/ai-coach', reason: 'Get a personal suggestion based on your numbers.' }
  }

  return {
    periodLabel,
    netWorth: { hasData: nwHas, change: nwChange, changePct: nwPct },
    spending: { thisWeek, lastWeek, changePct: spendChangePct, topCategory },
    income, txCountThisWeek, topMover, headline, highlights, action,
  }
}
