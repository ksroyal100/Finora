// src/lib/reports/adminReportData.ts
//
// Builds the platform-wide periodic report shown in the admin Command Center
// (/cc/reports). One collector feeds all three outputs (JSON preview, PDF, XLSX)
// so the numbers can never drift between formats.
//
// Conventions
//  - All periods are UTC. daily = one UTC day, weekly = Mon–Sun, monthly = calendar month.
//  - Ranges are [start, end) — end is exclusive.
//  - Every period is compared against the immediately preceding period of the same type.
//  - Row-level reads page through PostgREST's 1,000-row cap (fetchAll) so sums stay
//    correct at scale; plain counts use head-only count queries.
//  - Figures that are estimates (rather than ledger facts) are flagged in `notes`.

import { createAdminClient } from '@/lib/supabase/server'

export type ReportPeriod = 'daily' | 'weekly' | 'monthly'

export interface PeriodRange {
  period: ReportPeriod
  start: Date // inclusive
  end: Date // exclusive
  label: string
  isPartial: boolean // period hasn't finished yet
}

const DAY_MS = 86_400_000

// ── Period resolution ─────────────────────────────────────────

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function fmtDay(d: Date) {
  return d.toISOString().slice(0, 10)
}

function buildRange(period: ReportPeriod, start: Date, end: Date): PeriodRange {
  const lastDay = new Date(end.getTime() - DAY_MS)
  let label: string
  if (period === 'daily') {
    label = start.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
  } else if (period === 'weekly') {
    label = `${fmtDay(start)} to ${fmtDay(lastDay)}`
  } else {
    label = start.toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' })
  }
  return { period, start, end, label, isPartial: end.getTime() > Date.now() }
}

export function resolveRange(period: ReportPeriod, anchor: Date): PeriodRange {
  const day = startOfUtcDay(anchor)
  if (period === 'daily') {
    return buildRange(period, day, new Date(day.getTime() + DAY_MS))
  }
  if (period === 'weekly') {
    const dow = (day.getUTCDay() + 6) % 7 // Monday = 0
    const start = new Date(day.getTime() - dow * DAY_MS)
    return buildRange(period, start, new Date(start.getTime() + 7 * DAY_MS))
  }
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1))
  const end = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 1))
  return buildRange(period, start, end)
}

export function previousRange(r: PeriodRange): PeriodRange {
  if (r.period === 'daily') return resolveRange('daily', new Date(r.start.getTime() - DAY_MS))
  if (r.period === 'weekly') return resolveRange('weekly', new Date(r.start.getTime() - 7 * DAY_MS))
  return resolveRange('monthly', new Date(r.start.getTime() - DAY_MS))
}

// ── Output types ──────────────────────────────────────────────

export interface Metric {
  key: string
  label: string
  value: number
  previous: number
  deltaPct: number | null // null when previous = 0 (no meaningful %)
  format: 'number' | 'currency' | 'percent' | 'decimal'
  // true when an increase is bad (churn, security events, expenses…)
  lowerIsBetter?: boolean
}

export interface DailyPoint {
  date: string
  signups: number
  revenue: number // paid invoices + completed marketplace orders
  expenses: number
  aiQueries: number
  posts: number
}

export interface AdminReport {
  generatedAt: string
  range: { period: ReportPeriod; start: string; end: string; label: string; isPartial: boolean }
  previousRange: { start: string; end: string; label: string }
  headline: Metric[]
  sections: {
    users: Metric[]
    revenue: Metric[]
    subscriptions: Metric[]
    marketplace: Metric[]
    engagement: Metric[]
    security: Metric[]
    operations: Metric[]
  }
  planDistribution: Array<{ plan: string; subscribers: number }>
  newSubscriptionsByPlan: Array<{ plan: string; count: number }>
  expensesByCategory: Array<{ category: string; amount: number }>
  securityBySeverity: Array<{ severity: string; count: number }>
  topProducts: Array<{ title: string; orders: number; revenue: number }>
  daily: DailyPoint[]
  notes: string[]
}

// ── Query helpers ─────────────────────────────────────────────

type Db = ReturnType<typeof createAdminClient>

const PAGE = 1000
const MAX_ROWS = 100_000 // safety valve so one report can never run away

export async function fetchAll<T = Record<string, any>>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

export async function countRows(q: PromiseLike<{ count: number | null; error: any }>): Promise<number> {
  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count ?? 0
}

const sum = (rows: any[], key: string) => rows.reduce((s, r) => s + Number(r[key] ?? 0), 0)
const iso = (d: Date) => d.toISOString()

function pct(cur: number, prev: number): number | null {
  if (!prev) return null
  return ((cur - prev) / Math.abs(prev)) * 100
}

function metric(
  key: string, label: string, value: number, previous: number,
  format: Metric['format'] = 'number', lowerIsBetter = false
): Metric {
  return { key, label, value, previous, deltaPct: pct(value, previous), format, lowerIsBetter }
}

// ── Raw numbers for a single range ────────────────────────────

interface RangeData {
  signups: number
  totalUsersAtEnd: number
  activeUsers: number
  bannedInPeriod: number
  paidInvoiceRows: Array<{ amount_paid: number; paid_at: string }>
  invoicesOpenedCount: number
  mpOrders: Array<{ total: number; platform_fee: number; created_at: string; id: string }>
  refundedOrders: number
  expenseRows: Array<{ amount: number; category: string; date: string }>
  newSubs: Array<{ plan: string; status: string; created_at: string }>
  canceledSubs: number
  payoutsPaid: number
  newProducts: number
  aiRows: Array<{ query_count: number; tokens_used: number; cost: number; created_at: string }>
  posts: Array<{ created_at: string }>
  comments: number
  enrollments: number
  completions: number
  certificates: number
  feedbackRatings: number[]
  secEvents: Array<{ severity: string }>
  secResolved: number
  adminActions: number
  tasksCompleted: number
  tasksFailed: number
  mrrEnd: number
  arrEnd: number
  netNewMrr: number
  churnMrr: number
  newMrr: number
  signupRows: Array<{ created_at: string }>
}

async function collect(db: Db, r: PeriodRange): Promise<RangeData> {
  const s = iso(r.start)
  const e = iso(r.end)
  const sDate = fmtDay(r.start)
  const eDate = fmtDay(new Date(r.end.getTime() - 1)) // inclusive last day for DATE columns

  const inRange = (col: string) => (q: any) => q.gte(col, s).lt(col, e)

  const [
    signups, totalUsersAtEnd, activeUsers, bannedInPeriod,
    paidInvoiceRows, invoicesOpenedCount,
    mpOrders, refundedOrders,
    expenseRows,
    newSubs, canceledSubs,
    payoutRows, newProducts,
    aiRows, posts, comments,
    enrollments, completions, certificates,
    feedbackRows,
    secEvents, secResolved, adminActions,
    tasksCompleted, tasksFailed,
    metricsRows, signupRows,
  ] = await Promise.all([
    countRows(inRange('created_at')(db.from('profiles').select('id', { count: 'exact', head: true }))),
    countRows(db.from('profiles').select('id', { count: 'exact', head: true }).lt('created_at', e)),
    countRows(inRange('last_active_at')(db.from('profiles').select('id', { count: 'exact', head: true }))),
    countRows(inRange('banned_at')(db.from('profiles').select('id', { count: 'exact', head: true }))),

    fetchAll<any>((f, t) => inRange('paid_at')(db.from('invoices').select('amount_paid, paid_at').eq('status', 'paid')).range(f, t)),
    countRows(inRange('created_at')(db.from('invoices').select('id', { count: 'exact', head: true }))),

    fetchAll<any>((f, t) => inRange('created_at')(db.from('marketplace_orders').select('id, total, platform_fee, created_at').eq('status', 'completed')).range(f, t)),
    countRows(inRange('refunded_at')(db.from('marketplace_orders').select('id', { count: 'exact', head: true }).eq('status', 'refunded'))),

    // expenses.date is a DATE column → compare with plain dates, inclusive
    fetchAll<any>((f, t) => db.from('expenses').select('amount, category, date').gte('date', sDate).lte('date', eDate).range(f, t)),

    fetchAll<any>((f, t) => inRange('created_at')(db.from('subscriptions').select('plan, status, created_at')).range(f, t)),
    countRows(inRange('canceled_at')(db.from('subscriptions').select('id', { count: 'exact', head: true }))),

    fetchAll<any>((f, t) => inRange('paid_at')(db.from('creator_payouts').select('amount, paid_at').eq('status', 'paid')).range(f, t)),
    countRows(inRange('created_at')(db.from('marketplace_products').select('id', { count: 'exact', head: true }))),

    fetchAll<any>((f, t) => inRange('created_at')(db.from('ai_usage_logs').select('query_count, tokens_used, cost, created_at')).range(f, t)),
    fetchAll<any>((f, t) => inRange('created_at')(db.from('posts').select('created_at')).range(f, t)),
    countRows(inRange('created_at')(db.from('post_comments').select('id', { count: 'exact', head: true }))),

    countRows(inRange('enrolled_at')(db.from('course_enrollments').select('id', { count: 'exact', head: true }))),
    countRows(inRange('completed_at')(db.from('course_enrollments').select('id', { count: 'exact', head: true }))),
    countRows(inRange('issued_at')(db.from('certificates').select('id', { count: 'exact', head: true }))),

    fetchAll<any>((f, t) => inRange('created_at')(db.from('user_feedback').select('rating, created_at')).range(f, t)),

    fetchAll<any>((f, t) => inRange('created_at')(db.from('security_events').select('severity')).range(f, t)),
    countRows(inRange('resolved_at')(db.from('security_events').select('id', { count: 'exact', head: true }))),
    countRows(inRange('created_at')(db.from('audit_logs').select('id', { count: 'exact', head: true }).not('admin_id', 'is', null))),

    countRows(inRange('completed_at')(db.from('agent_tasks').select('id', { count: 'exact', head: true }).eq('status', 'completed'))),
    countRows(inRange('failed_at')(db.from('agent_tasks').select('id', { count: 'exact', head: true }).eq('status', 'failed'))),

    // revenue_metrics.date is a DATE: take every snapshot inside the range
    db.from('revenue_metrics').select('date, mrr, arr, new_mrr, churn_mrr, net_new_mrr')
      .gte('date', sDate).lte('date', eDate).order('date', { ascending: true }),

    fetchAll<any>((f, t) => inRange('created_at')(db.from('profiles').select('created_at')).range(f, t)),
  ])

  if (metricsRows.error) throw new Error(metricsRows.error.message)
  const snaps = metricsRows.data ?? []
  const lastSnap = snaps[snaps.length - 1]

  return {
    signups, totalUsersAtEnd, activeUsers, bannedInPeriod,
    paidInvoiceRows, invoicesOpenedCount,
    mpOrders, refundedOrders,
    expenseRows,
    newSubs, canceledSubs,
    payoutsPaid: sum(payoutRows, 'amount'),
    newProducts,
    aiRows, posts, comments,
    enrollments, completions, certificates,
    feedbackRatings: feedbackRows.map((f: any) => Number(f.rating)),
    secEvents, secResolved, adminActions,
    tasksCompleted, tasksFailed,
    mrrEnd: Number(lastSnap?.mrr ?? 0),
    arrEnd: Number(lastSnap?.arr ?? 0),
    // flows are summed across the daily snapshots inside the period
    netNewMrr: sum(snaps, 'net_new_mrr'),
    churnMrr: sum(snaps, 'churn_mrr'),
    newMrr: sum(snaps, 'new_mrr'),
    signupRows,
  }
}

// ── Derived figures ───────────────────────────────────────────

function derive(d: RangeData) {
  const subscriptionRevenue = sum(d.paidInvoiceRows, 'amount_paid')
  const marketplaceGmv = sum(d.mpOrders, 'total')
  const platformFees = sum(d.mpOrders, 'platform_fee')
  const totalRevenue = subscriptionRevenue + marketplaceGmv
  const expenses = sum(d.expenseRows, 'amount')
  const aiQueries = sum(d.aiRows, 'query_count')
  const aiTokens = sum(d.aiRows, 'tokens_used')
  const aiCost = sum(d.aiRows, 'cost')
  const avgRating = d.feedbackRatings.length
    ? d.feedbackRatings.reduce((a, b) => a + b, 0) / d.feedbackRatings.length : 0
  const paidNewSubs = d.newSubs.filter(s => s.plan !== 'free').length
  const critical = d.secEvents.filter(x => x.severity === 'critical' || x.severity === 'high').length
  const taskTotal = d.tasksCompleted + d.tasksFailed
  return {
    subscriptionRevenue, marketplaceGmv, platformFees, totalRevenue, expenses,
    netPosition: totalRevenue - expenses,
    aiQueries, aiTokens, aiCost, avgRating, paidNewSubs, critical,
    taskSuccessRate: taskTotal ? (d.tasksCompleted / taskTotal) * 100 : 0,
  }
}

function groupCount<T>(rows: T[], keyFn: (r: T) => string) {
  const m = new Map<string, number>()
  rows.forEach(r => m.set(keyFn(r), (m.get(keyFn(r)) ?? 0) + 1))
  return m
}

function eachDay(r: PeriodRange): string[] {
  const days: string[] = []
  for (let t = r.start.getTime(); t < r.end.getTime(); t += DAY_MS) days.push(fmtDay(new Date(t)))
  return days
}

// ── Public entry point ────────────────────────────────────────

export async function buildAdminReport(period: ReportPeriod, anchor: Date): Promise<AdminReport> {
  const db = createAdminClient()
  const cur = resolveRange(period, anchor)
  const prev = previousRange(cur)

  const [c, p] = await Promise.all([collect(db, cur), collect(db, prev)])
  const cd = derive(c)
  const pd = derive(p)

  // Plan distribution is a point-in-time snapshot of *current* active subscribers
  const activeSubs = await fetchAll<any>((f, t) =>
    db.from('subscriptions').select('plan').in('status', ['active', 'trialing', 'past_due']).range(f, t))
  const planMap = groupCount(activeSubs, s => s.plan)
  const planDistribution = ['free', 'pro', 'plus', 'elite']
    .map(plan => ({ plan, subscribers: planMap.get(plan) ?? 0 }))

  const newSubMap = groupCount(c.newSubs, s => s.plan)
  const newSubscriptionsByPlan = Array.from(newSubMap, ([plan, count]) => ({ plan, count }))
    .sort((a, b) => b.count - a.count)

  const expMap = new Map<string, number>()
  c.expenseRows.forEach(x => expMap.set(x.category ?? 'uncategorized', (expMap.get(x.category ?? 'uncategorized') ?? 0) + Number(x.amount)))
  const expensesByCategory = Array.from(expMap, ([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  const sevMap = groupCount(c.secEvents, x => x.severity)
  const securityBySeverity = ['critical', 'high', 'medium', 'low']
    .map(severity => ({ severity, count: sevMap.get(severity) ?? 0 }))

  // Top products by revenue in the period (from order items)
  let topProducts: AdminReport['topProducts'] = []
  if (c.mpOrders.length) {
    const orderIds = c.mpOrders.map(o => o.id)
    const items: any[] = []
    for (let i = 0; i < orderIds.length; i += 200) {
      const { data, error } = await db.from('marketplace_order_items')
        .select('product_id, title, quantity, subtotal')
        .in('order_id', orderIds.slice(i, i + 200))
      if (error) break // item breakdown is a nice-to-have; never fail the report over it
      items.push(...(data ?? []))
    }
    const agg = new Map<string, { title: string; orders: number; revenue: number }>()
    items.forEach(it => {
      const key = it.product_id ?? it.title
      const row = agg.get(key) ?? { title: it.title ?? 'Unknown product', orders: 0, revenue: 0 }
      row.orders += Number(it.quantity ?? 1)
      row.revenue += Number(it.subtotal ?? 0)
      agg.set(key, row)
    })
    topProducts = Array.from(agg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  }

  // Day-by-day series for the current period
  const days = eachDay(cur)
  const bucket = (rows: any[], col: string, valueKey?: string) => {
    const m = new Map<string, number>()
    rows.forEach(r => {
      const k = String(r[col]).slice(0, 10)
      m.set(k, (m.get(k) ?? 0) + (valueKey ? Number(r[valueKey] ?? 0) : 1))
    })
    return m
  }
  const sDaily = bucket(c.signupRows, 'created_at')
  const invDaily = bucket(c.paidInvoiceRows, 'paid_at', 'amount_paid')
  const mpDaily = bucket(c.mpOrders, 'created_at', 'total')
  const expDaily = bucket(c.expenseRows, 'date', 'amount')
  const aiDaily = bucket(c.aiRows, 'created_at', 'query_count')
  const postDaily = bucket(c.posts, 'created_at')
  const daily: DailyPoint[] = days.map(date => ({
    date,
    signups: sDaily.get(date) ?? 0,
    revenue: (invDaily.get(date) ?? 0) + (mpDaily.get(date) ?? 0),
    expenses: expDaily.get(date) ?? 0,
    aiQueries: aiDaily.get(date) ?? 0,
    posts: postDaily.get(date) ?? 0,
  }))

  const M = metric
  const sections: AdminReport['sections'] = {
    users: [
      M('signups', 'New signups', c.signups, p.signups),
      M('total_users', 'Total users (end of period)', c.totalUsersAtEnd, p.totalUsersAtEnd),
      M('active_users', 'Users last active in period', c.activeUsers, p.activeUsers),
      M('banned', 'Users banned', c.bannedInPeriod, p.bannedInPeriod, 'number', true),
    ],
    revenue: [
      M('total_revenue', 'Total revenue collected', cd.totalRevenue, pd.totalRevenue, 'currency'),
      M('sub_revenue', 'Subscription revenue (paid invoices)', cd.subscriptionRevenue, pd.subscriptionRevenue, 'currency'),
      M('mp_gmv', 'Marketplace sales (GMV)', cd.marketplaceGmv, pd.marketplaceGmv, 'currency'),
      M('platform_fees', 'Marketplace platform fees', cd.platformFees, pd.platformFees, 'currency'),
      M('expenses', 'Expenses logged', cd.expenses, pd.expenses, 'currency', true),
      M('net_position', 'Revenue minus expenses', cd.netPosition, pd.netPosition, 'currency'),
      M('mrr', 'MRR (end of period)', c.mrrEnd, p.mrrEnd, 'currency'),
      M('arr', 'ARR (end of period)', c.arrEnd, p.arrEnd, 'currency'),
      M('net_new_mrr', 'Net new MRR', c.netNewMrr, p.netNewMrr, 'currency'),
      M('churn_mrr', 'Churned MRR', c.churnMrr, p.churnMrr, 'currency', true),
      M('payouts_paid', 'Creator payouts paid', c.payoutsPaid, p.payoutsPaid, 'currency'),
      M('invoices_opened', 'Invoices created', c.invoicesOpenedCount, p.invoicesOpenedCount),
    ],
    subscriptions: [
      M('new_subs', 'New subscriptions (all plans)', c.newSubs.length, p.newSubs.length),
      M('new_paid_subs', 'New paid subscriptions', cd.paidNewSubs, pd.paidNewSubs),
      M('canceled_subs', 'Cancellations', c.canceledSubs, p.canceledSubs, 'number', true),
    ],
    marketplace: [
      M('orders', 'Completed orders', c.mpOrders.length, p.mpOrders.length),
      M('refunds', 'Refunded orders', c.refundedOrders, p.refundedOrders, 'number', true),
      M('new_products', 'New product listings', c.newProducts, p.newProducts),
    ],
    engagement: [
      M('ai_queries', 'AI coach queries', cd.aiQueries, pd.aiQueries),
      M('ai_tokens', 'AI tokens used', cd.aiTokens, pd.aiTokens),
      M('ai_cost', 'AI cost', cd.aiCost, pd.aiCost, 'currency', true),
      M('posts', 'Community posts', c.posts.length, p.posts.length),
      M('comments', 'Community comments', c.comments, p.comments),
      M('enrollments', 'Course enrollments', c.enrollments, p.enrollments),
      M('completions', 'Course completions', c.completions, p.completions),
      M('certificates', 'Certificates issued', c.certificates, p.certificates),
      M('feedback_count', 'Feedback submissions', c.feedbackRatings.length, p.feedbackRatings.length),
      M('avg_rating', 'Average feedback rating (1–5)', cd.avgRating, pd.avgRating, 'decimal'),
    ],
    security: [
      M('sec_events', 'Security events', c.secEvents.length, p.secEvents.length, 'number', true),
      M('sec_high', 'High / critical events', cd.critical, pd.critical, 'number', true),
      M('sec_resolved', 'Events resolved', c.secResolved, p.secResolved),
    ],
    operations: [
      M('admin_actions', 'Admin actions (audit log)', c.adminActions, p.adminActions),
      M('tasks_done', 'AI agent tasks completed', c.tasksCompleted, p.tasksCompleted),
      M('tasks_failed', 'AI agent tasks failed', c.tasksFailed, p.tasksFailed, 'number', true),
      M('task_rate', 'Agent task success rate', cd.taskSuccessRate, pd.taskSuccessRate, 'percent'),
    ],
  }

  const pick = (list: Metric[], key: string) => list.find(m => m.key === key)!
  const headline: Metric[] = [
    pick(sections.revenue, 'total_revenue'),
    pick(sections.revenue, 'mrr'),
    pick(sections.users, 'signups'),
    pick(sections.subscriptions, 'new_paid_subs'),
    pick(sections.subscriptions, 'canceled_subs'),
    pick(sections.revenue, 'expenses'),
    pick(sections.revenue, 'net_position'),
    pick(sections.engagement, 'ai_queries'),
  ]

  const notes = [
    'All periods are calculated in UTC. Weekly = Monday–Sunday; monthly = calendar month.',
    'Every figure is compared with the immediately preceding period of the same length.',
    '"Users last active in period" counts users whose most recent activity fell inside the window; it can only under-count for past periods, so compare it with care.',
    'MRR / ARR come from the daily revenue_metrics snapshot. Expansion and contraction MRR are not tracked separately yet, so net new MRR is a blended figure.',
    'Total revenue = paid subscription invoices + completed marketplace order totals (gross, before Stripe fees and creator payouts).',
  ]
  if (cur.isPartial) notes.unshift('This period is still in progress — figures are partial and will keep growing until it closes.')
  if (!daily.length) notes.push('No daily data points were generated.')

  return {
    generatedAt: new Date().toISOString(),
    range: { period, start: fmtDay(cur.start), end: fmtDay(new Date(cur.end.getTime() - DAY_MS)), label: cur.label, isPartial: cur.isPartial },
    previousRange: { start: fmtDay(prev.start), end: fmtDay(new Date(prev.end.getTime() - DAY_MS)), label: prev.label },
    headline, sections, planDistribution, newSubscriptionsByPlan,
    expensesByCategory, securityBySeverity, topProducts, daily, notes,
  }
}

// ── Shared formatting (used by PDF + XLSX) ────────────────────

// Whole dollars for big figures, cents for small non-integer ones (AI cost of
// $0.75 must not render as "$1").
export function money(v: number, currency = 'USD'): string {
  const showCents = Math.abs(v) < 100 && !Number.isInteger(v)
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    minimumFractionDigits: showCents ? 2 : 0, maximumFractionDigits: showCents ? 2 : 0,
  }).format(v)
}

export function formatMetricValue(m: Metric, v: number = m.value, currency = 'USD'): string {
  switch (m.format) {
    case 'currency':
      return money(v, currency)
    case 'percent': return `${v.toFixed(1)}%`
    case 'decimal': return v.toFixed(2)
    default: return new Intl.NumberFormat('en-US').format(Math.round(v))
  }
}

export function formatDelta(m: Metric): string {
  if (m.deltaPct === null) return m.value === 0 && m.previous === 0 ? '—' : 'new'
  return `${m.deltaPct >= 0 ? '+' : ''}${m.deltaPct.toFixed(1)}%`
}

// Good / bad / neutral colouring that respects lowerIsBetter
export function deltaTone(m: Metric): 'good' | 'bad' | 'flat' {
  if (m.deltaPct === null || m.deltaPct === 0) return 'flat'
  const up = m.deltaPct > 0
  return up === !m.lowerIsBetter ? 'good' : 'bad'
}
