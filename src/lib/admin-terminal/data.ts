// src/lib/admin-terminal/data.ts
//
// Builds the single JSON snapshot that powers /cc/terminal in the admin app.
//
// Two cache tiers protect the database:
//   FAST  : head-only counts, live feed, today's activity
//   SLOW  : 90-day series, cohorts, unit economics (row scans)
// The terminal is event-driven (see the freshness cache below), so these normally
// recompute only when something in the database actually changed. TTLs (10 s / 5 min)
// apply to plain, non-fresh requests. A cached block is shared by every admin on the
// same server instance; across serverless instances each warms its own cache.
//
// Definitions worth knowing (also surfaced in the UI):
//   DAU/WAU/MAU  : profiles whose last_active_at falls inside the trailing window.
//                  Exact for *current* windows, since "latest activity ≥ cutoff"
//                  means "was active in the window".
//   Paying       : subscriptions in active / past_due with plan ≠ free.
//   Paid churn   : paid subs canceled in 30d ÷ paid subs alive at the start of the window.
//   CAC          : marketing-category expenses (30d) ÷ new paid subscriptions (30d).
//                  The revenue cron does not store CAC, so this is derived here.

import { createAdminClient } from '@/lib/supabase/server'
import { fetchAll, countRows } from '@/lib/reports/adminReportData'
import {
  buildAlerts, countPerDay, dateRange, isoDay, movingAverage, pctChange, snapshotDaysAgo, sumFlows,
  sumPerDay, topN, unitEconomics, weekdayHourHeatmap, weeklyCohorts,
  type CohortRow, type RevenueRow, type TerminalAlert,
} from './math'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

type Db = ReturnType<typeof createAdminClient>

export interface FeedItem {
  at: string
  type: 'signup' | 'payment' | 'cancel' | 'security' | 'order'
  text: string
  amount?: number
  level?: 'good' | 'bad' | 'warn' | 'info'
}

export interface TerminalSnapshot {
  generatedAt: string
  dbLatencyMs: number
  kpi: {
    mrr: number | null; arr: number | null; mrrAsOf: string | null
    mrrChange7dPct: number | null; mrrChange30dPct: number | null
    netNewMrr30d: number; newMrr30d: number; churnMrr30d: number; expansionMrr30d: number; contractionMrr30d: number
    totalUsers: number; bannedUsers: number
    payingCustomers: number; trialingCustomers: number; pastDueCustomers: number
    freeToPaidPct: number | null
    dau: number; wau: number; mau: number; stickinessPct: number | null
    signups24h: number; signups7d: number; signupsPrev7d: number; signups30d: number; signupsPrev30d: number
    revenue24h: number; revenue7d: number; revenue30d: number; revenuePrev30d: number; expenses30d: number
    arpu: number | null; ltv: number | null; cac: number | null; ltvToCac: number | null
    paybackMonths: number | null; quickRatio: number | null
    monthlyChurnPct: number | null; grossRevenueRetentionPct: number | null
    trialConversionPct: number | null; activationPct: number | null
    avgRating30d: number | null; feedback30d: number; newsletterSubs: number
  }
  series: {
    mrr: Array<{ date: string; mrr: number; netNew: number }>
    signups: Array<{ date: string; count: number; ma7: number }>
    revenue: Array<{ date: string; amount: number }>
  }
  planMix: Array<{ plan: string; count: number }>
  funnel: Array<{ stage: string; count: number }>
  heatmap: number[][]
  cohorts: CohortRow[]
  geo: Array<{ country: string; count: number }>
  activity: {
    eventsPerHour: number[] // last 24 hourly buckets, oldest → newest
    devices: Array<{ device: string; count: number }>
    topEvents: Array<{ name: string; count: number }>
    sampled: boolean
    total: number
  }
  health: {
    agentsActive: number; agentsTotal: number; failedTasks24h: number; pendingApprovals: number
    criticalSecurityOpen: number; highSecurityOpen: number; revenueSnapshotAgeDays: number | null
  }
  alerts: TerminalAlert[]
  feed: FeedItem[]
  notes: string[]
}

// ── freshness-aware single-flight cache ───────────────────────
//
// The admin terminal no longer polls. It fetches once, then re-fetches only when
// Supabase Realtime reports a database change, passing that change's commit time
// as `since`. A cached block may then be reused only if it was computed AFTER the
// change, so nobody is ever served data that predates it, while several admins
// reacting to the same change share ONE recompute.
//
//   not fresh            : plain TTL (initial loads from other API consumers)
//   fresh                : reuse iff the compute STARTED after this request arrived (always
//                          safe, no clock comparison), OR after since + SINCE_MARGIN_MS
//                          (another admin's recompute for the same change), OR, when
//                          there is no `since`, less than NO_SINCE_FLOOR_MS ago (manual
//                          refresh / reconnect catch-up; also stops click-spam)
//
// `at` is the moment the compute STARTED (every read happens after it), which is
// the conservative choice. SINCE_MARGIN_MS absorbs small clock skew between the
// database host and this server; it is deliberately smaller than the client's
// debounce so the first recompute after an event is shareable by the other admins.
export interface Freshness { fresh: boolean; sinceMs: number | null; arrivedAt: number }
export const SINCE_MARGIN_MS = 500
export const NO_SINCE_FLOOR_MS = 5000

interface Entry<T> { at: number; value: T }
interface Pending<T> { startedAt: number; promise: Promise<T> }
const cache = new Map<string, Entry<unknown>>()
const inflight = new Map<string, Pending<unknown>>()

function startedOk(startedAt: number, ttlMs: number, f: Freshness): boolean {
  if (!f.fresh) return Date.now() - startedAt < ttlMs
  // Rule A (clock-skew free): a compute that STARTED after this request arrived read the
  // database after the change that prompted it, because the client learned of the change
  // before sending the request. Both timestamps come from this server's clock.
  if (startedAt >= f.arrivedAt) return true
  // Rule B: a compute that started before we arrived (typically another admin's request for
  // the same change) is fine if it began after the change itself, plus a skew margin.
  if (f.sinceMs !== null) return startedAt >= f.sinceMs + SINCE_MARGIN_MS
  // No change time (manual refresh / reconnect catch-up): allow at most one recompute per floor.
  return Date.now() - startedAt < NO_SINCE_FLOOR_MS
}

async function cached<T>(key: string, ttlMs: number, compute: () => Promise<T>, enabled: boolean, f: Freshness): Promise<T> {
  if (!enabled) return compute()
  for (;;) {
    const hit = cache.get(key) as Entry<T> | undefined
    if (hit && startedOk(hit.at, ttlMs, f)) return hit.value

    const pend = inflight.get(key) as Pending<T> | undefined
    if (pend) {
      if (startedOk(pend.startedAt, ttlMs, f)) return pend.promise   // shareable: started after the change
      await pend.promise.catch(() => undefined)                      // started too early: wait, then re-evaluate
      continue
    }

    const startedAt = Date.now()
    const promise = compute()
      .then(v => { cache.set(key, { at: startedAt, value: v }); return v })
      .finally(() => { if (inflight.get(key)?.startedAt === startedAt) inflight.delete(key) })
    inflight.set(key, { startedAt, promise })
    return promise
  }
}

export function clearTerminalCache() { cache.clear(); inflight.clear() }

const num = (v: unknown) => Number(v ?? 0) || 0
const nameOf = (p: any) => p?.display_name || p?.username || (p?.email ? String(p.email).split('@')[0] : 'Someone')

// ── SLOW block ────────────────────────────────────────────────
async function slowBlock(db: Db, now: Date) {
  const t30 = new Date(now.getTime() - 30 * DAY_MS).toISOString()
  const t60 = new Date(now.getTime() - 60 * DAY_MS).toISOString()
  const t90 = new Date(now.getTime() - 90 * DAY_MS).toISOString()
  const d95 = isoDay(new Date(now.getTime() - 95 * DAY_MS))
  const nowIso = now.toISOString()

  const [
    revRows, signupRows, invRows, orderRows, expRows,
    churned30, aliveStart30, newPaid30, trialsEnded, trialsConverted, feedbackRows, newsletterSubs,
  ] = await Promise.all([
    fetchAll<any>((f, t) => db.from('revenue_metrics')
      .select('date,mrr,arr,new_mrr,expansion_mrr,contraction_mrr,churn_mrr,net_new_mrr')
      .gte('date', d95).order('date', { ascending: true }).range(f, t)),
    fetchAll<any>((f, t) => db.from('profiles')
      .select('created_at,last_active_at,onboarding_completed,country_code')
      .gte('created_at', t90).range(f, t)),
    fetchAll<any>((f, t) => db.from('invoices').select('amount_paid,paid_at')
      .eq('status', 'paid').gte('paid_at', t60).range(f, t)),
    fetchAll<any>((f, t) => db.from('marketplace_orders').select('total,created_at')
      .eq('status', 'completed').gte('created_at', t60).range(f, t)),
    fetchAll<any>((f, t) => db.from('expenses').select('amount,category,date')
      .gte('date', isoDay(new Date(now.getTime() - 30 * DAY_MS))).range(f, t)),

    // paid churn: canceled in last 30d ÷ paid subs alive at the start of the window
    countRows(db.from('subscriptions').select('id', { count: 'exact', head: true }).neq('plan', 'free').gte('canceled_at', t30)),
    countRows(db.from('subscriptions').select('id', { count: 'exact', head: true }).neq('plan', 'free')
      .lt('created_at', t30).or(`canceled_at.is.null,canceled_at.gte.${t30}`)),
    countRows(db.from('subscriptions').select('id', { count: 'exact', head: true }).neq('plan', 'free').gte('created_at', t30)),
    countRows(db.from('subscriptions').select('id', { count: 'exact', head: true }).gte('trial_ends_at', t30).lt('trial_ends_at', nowIso)),
    countRows(db.from('subscriptions').select('id', { count: 'exact', head: true }).gte('trial_ends_at', t30).lt('trial_ends_at', nowIso)
      .in('status', ['active', 'past_due']).neq('plan', 'free')),
    fetchAll<any>((f, t) => db.from('user_feedback').select('rating').gte('created_at', t30).range(f, t)),
    countRows(db.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'subscribed')),
  ])

  const revenueRows: RevenueRow[] = revRows.map(r => ({
    date: r.date, mrr: num(r.mrr), arr: num(r.arr), new_mrr: num(r.new_mrr),
    expansion_mrr: num(r.expansion_mrr), contraction_mrr: num(r.contraction_mrr),
    churn_mrr: num(r.churn_mrr), net_new_mrr: num(r.net_new_mrr),
  }))

  // Daily series (dense, zero-filled)
  const days90 = dateRange(new Date(now.getTime() - 89 * DAY_MS), now)
  const signupCounts = countPerDay(signupRows.map(r => r.created_at), days90)
  const ma7 = movingAverage(signupCounts, 7)

  const days60 = dateRange(new Date(now.getTime() - 59 * DAY_MS), now)
  const revPerDay60 = sumPerDay([
    ...invRows.map(r => ({ at: r.paid_at as string, amount: num(r.amount_paid) })),
    ...orderRows.map(r => ({ at: r.created_at as string, amount: num(r.total) })),
  ], days60)
  const revenue30 = revPerDay60.slice(30).reduce((a, b) => a + b, 0)
  const revenuePrev30 = revPerDay60.slice(0, 30).reduce((a, b) => a + b, 0)

  const marketingSpend30d = expRows.filter(e => e.category === 'marketing').reduce((a, e) => a + num(e.amount), 0)
  const expenses30d = expRows.reduce((a, e) => a + num(e.amount), 0)

  const lastRev = revenueRows[revenueRows.length - 1] ?? null
  const mrr7 = snapshotDaysAgo(revenueRows, 7)
  const mrr30 = snapshotDaysAgo(revenueRows, 30)
  const flows = sumFlows(revenueRows, 30)

  const nowMs = now.getTime()
  const inLast = (iso: string, ms: number) => nowMs - new Date(iso).getTime() < ms
  const signups30dRows = signupRows.filter(r => inLast(r.created_at, 30 * DAY_MS))
  const signupsPrev30d = signupRows.filter(r => { const a = nowMs - new Date(r.created_at).getTime(); return a >= 30 * DAY_MS && a < 60 * DAY_MS }).length
  const signups7d = signupRows.filter(r => inLast(r.created_at, 7 * DAY_MS)).length
  const signupsPrev7d = signupRows.filter(r => { const a = nowMs - new Date(r.created_at).getTime(); return a >= 7 * DAY_MS && a < 14 * DAY_MS }).length

  const ratings = feedbackRows.map(f => num(f.rating)).filter(r => r > 0)

  return {
    lastRev, mrr7, mrr30, flows, revenueRows,
    revenue30, revenuePrev30, expenses30d, marketingSpend30d,
    revenueSeries: days60.slice(30).map((date, i) => ({ date, amount: revPerDay60[30 + i] })),
    mrrSeries: revenueRows.slice(-90).map(r => ({ date: r.date, mrr: r.mrr, netNew: r.net_new_mrr })),
    signupSeries: days90.map((date, i) => ({ date, count: signupCounts[i], ma7: Math.round(ma7[i] * 100) / 100 })),
    signups30d: signups30dRows.length, signupsPrev30d, signups7d, signupsPrev7d,
    activationPct: signups30dRows.length ? (signups30dRows.filter(r => r.onboarding_completed).length / signups30dRows.length) * 100 : null,
    heatmap: weekdayHourHeatmap(signupRows.filter(r => inLast(r.created_at, 28 * DAY_MS)).map(r => r.created_at)),
    cohorts: weeklyCohorts(signupRows, now, 8),
    geo: topN(signupRows.map(r => (r.country_code as string) || 'Unknown'), 8).map(g => ({ country: g.key, count: g.count })),
    churned30, aliveStart30, newPaid30,
    trialConversionPct: trialsEnded > 0 ? (trialsConverted / trialsEnded) * 100 : null,
    avgRating30d: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    feedback30d: ratings.length, newsletterSubs,
    paidSignups30d: newPaid30,
    onboarded30d: signups30dRows.filter(r => r.onboarding_completed).length,
  }
}

// ── FAST block ────────────────────────────────────────────────
async function fastBlock(db: Db, now: Date) {
  const t = (ms: number) => new Date(now.getTime() - ms).toISOString()
  const t24h = t(DAY_MS), t7d = t(7 * DAY_MS), t30d = t(30 * DAY_MS)
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const head = (table: string) => db.from(table).select('id', { count: 'exact', head: true })
  const paidStatuses = ['active', 'past_due']

  const t0 = Date.now()
  const [
    totalUsers, bannedUsers, dau, wau, mau, signups24h,
    paying, trialing, pastDue, activeSubs,
    agentsTotal, agentsActive, failedTasks24h, pendingApprovals, critOpen, highOpen,
    events, revInv24h, revOrd24h,
    fSignups, fPay, fCancel, fSec, fOrders, freeUsers,
  ] = await Promise.all([
    countRows(head('profiles')),
    countRows(head('profiles').eq('is_banned', true)),
    countRows(head('profiles').gte('last_active_at', startOfToday)),
    countRows(head('profiles').gte('last_active_at', t7d)),
    countRows(head('profiles').gte('last_active_at', t30d)),
    countRows(head('profiles').gte('created_at', t24h)),

    countRows(head('subscriptions').in('status', paidStatuses).neq('plan', 'free')),
    countRows(head('subscriptions').eq('status', 'trialing')),
    countRows(head('subscriptions').eq('status', 'past_due')),
    fetchAll<any>((f, to) => db.from('subscriptions').select('plan').in('status', ['active', 'trialing', 'past_due']).range(f, to)),

    countRows(head('agents').eq('is_active', true)),
    countRows(head('agents').eq('is_active', true).in('status', ['idle', 'thinking', 'working', 'waiting'])),
    countRows(head('agent_tasks').eq('status', 'failed').gte('failed_at', t24h)),
    countRows(head('agent_decisions').eq('requires_approval', true).is('approved_at', null).eq('is_executed', false)),
    countRows(head('security_events').eq('is_resolved', false).eq('severity', 'critical')),
    countRows(head('security_events').eq('is_resolved', false).eq('severity', 'high')),

    // Most recent 20k tracker events in the last 24h → hourly shape, devices, top events
    db.from('platform_analytics').select('event_name,device_type,recorded_at', { count: 'exact' })
      .gte('recorded_at', t24h).order('recorded_at', { ascending: false }).limit(20000),
    db.from('invoices').select('amount_paid').eq('status', 'paid').gte('paid_at', t24h),
    db.from('marketplace_orders').select('total').eq('status', 'completed').gte('created_at', t24h),

    db.from('profiles').select('display_name,username,email,created_at').order('created_at', { ascending: false }).limit(6),
    db.from('invoices').select('amount_paid,paid_at').eq('status', 'paid').order('paid_at', { ascending: false }).limit(6),
    db.from('subscriptions').select('plan,canceled_at').not('canceled_at', 'is', null).order('canceled_at', { ascending: false }).limit(5),
    db.from('security_events').select('severity,event_type,created_at').order('created_at', { ascending: false }).limit(5),
    db.from('marketplace_orders').select('total,created_at').eq('status', 'completed').order('created_at', { ascending: false }).limit(5),
    countRows(head('subscriptions').eq('plan', 'free').in('status', ['active', 'trialing'])),
  ])
  const dbLatencyMs = Date.now() - t0

  // activity shape
  const ev = (events.data ?? []) as Array<{ event_name: string; device_type: string | null; recorded_at: string }>
  const hourBuckets = Array(24).fill(0)
  ev.forEach(e => {
    const age = now.getTime() - new Date(e.recorded_at).getTime()
    const idx = 23 - Math.min(23, Math.max(0, Math.floor(age / HOUR_MS)))
    hourBuckets[idx]++
  })
  const totalEvents = events.count ?? ev.length

  const planMap = new Map<string, number>()
  activeSubs.forEach(s => planMap.set(s.plan, (planMap.get(s.plan) ?? 0) + 1))
  const planMix = ['free', 'pro', 'plus', 'elite'].map(plan => ({ plan, count: planMap.get(plan) ?? 0 }))

  const revenue24h = (revInv24h.data ?? []).reduce((a: number, r: any) => a + num(r.amount_paid), 0)
    + (revOrd24h.data ?? []).reduce((a: number, r: any) => a + num(r.total), 0)

  // live feed
  const feed: FeedItem[] = []
  ;(fSignups.data ?? []).forEach((p: any) => feed.push({ at: p.created_at, type: 'signup', text: `${nameOf(p)} joined`, level: 'good' }))
  ;(fPay.data ?? []).forEach((i: any) => feed.push({ at: i.paid_at, type: 'payment', text: 'Payment received', amount: num(i.amount_paid), level: 'good' }))
  ;(fCancel.data ?? []).forEach((s: any) => feed.push({ at: s.canceled_at, type: 'cancel', text: `${String(s.plan).toUpperCase()} subscription canceled`, level: 'bad' }))
  ;(fSec.data ?? []).forEach((e: any) => feed.push({ at: e.created_at, type: 'security', text: `${String(e.event_type).replace(/_/g, ' ')} (${e.severity})`, level: e.severity === 'critical' || e.severity === 'high' ? 'bad' : 'warn' }))
  ;(fOrders.data ?? []).forEach((o: any) => feed.push({ at: o.created_at, type: 'order', text: 'Marketplace order', amount: num(o.total), level: 'info' }))
  feed.sort((a, b) => (a.at < b.at ? 1 : -1))

  return {
    totalUsers, bannedUsers, dau, wau, mau, signups24h, paying, trialing, pastDue, freeUsers,
    planMix, agentsTotal, agentsActive, failedTasks24h, pendingApprovals, critOpen, highOpen,
    hourBuckets, devices: topN(ev.map(e => e.device_type || 'unknown'), 4).map(d => ({ device: d.key, count: d.count })),
    topEvents: topN(ev.map(e => e.event_name), 6).map(e => ({ name: e.key, count: e.count })),
    sampled: totalEvents > ev.length, totalEvents, revenue24h, dbLatencyMs, feed: feed.slice(0, 14),
  }
}

// ── public entry ──────────────────────────────────────────────
export async function buildTerminalSnapshot(
  opts: { now?: Date; useCache?: boolean; fresh?: boolean; sinceMs?: number | null } = {},
): Promise<TerminalSnapshot> {
  const now = opts.now ?? new Date()
  const useCache = opts.useCache ?? true
  const f: Freshness = { fresh: opts.fresh ?? false, sinceMs: opts.sinceMs ?? null, arrivedAt: Date.now() }
  const db = createAdminClient()
  const [S, F] = await Promise.all([
    cached('terminal:slow', 5 * 60_000, () => slowBlock(db, now), useCache, f),
    cached('terminal:fast', 10_000, () => fastBlock(db, now), useCache, f),
  ])

  const ue = unitEconomics({
    mrr: S.lastRev?.mrr ?? null, payingCustomers: F.paying,
    churnedLogos30d: S.churned30, activeLogosStart30d: S.aliveStart30,
    marketingSpend30d: S.marketingSpend30d, newPaid30d: S.newPaid30,
    flows: S.flows, mrr30dAgo: S.mrr30?.mrr ?? null,
  })

  const snapAge = S.lastRev ? Math.max(0, Math.floor((now.getTime() - new Date(`${S.lastRev.date}T00:00:00Z`).getTime()) / DAY_MS)) : null
  const stickiness = F.mau > 0 ? (F.dau / F.mau) * 100 : null
  const freeToPaid = F.freeUsers + F.paying > 0 ? (F.paying / (F.freeUsers + F.paying)) * 100 : null

  const alerts = buildAlerts({
    revenueSnapshotAgeDays: snapAge, criticalSecurityOpen: F.critOpen, highSecurityOpen: F.highOpen,
    monthlyChurnPct: ue.monthlyChurnPct, signups24h: F.signups24h, signupsAvgPerDay7d: S.signups7d / 7,
    mrr: S.lastRev?.mrr ?? null, mrr7dAgo: S.mrr7?.mrr ?? null,
    failedTasks24h: F.failedTasks24h, pendingApprovals: F.pendingApprovals, pastDueSubs: F.pastDue, dbLatencyMs: F.dbLatencyMs,
  })

  const notes = [
    'DAU/WAU/MAU count users whose last activity falls in the window (today UTC / 7 days / 30 days).',
    'Paid churn = paid subscriptions canceled in 30 days ÷ paid subscriptions alive at the start of the window.',
    'CAC is derived: marketing-category expenses (30d) ÷ new paid subscriptions (30d). Log marketing spend in Accounting for it to appear.',
    'LTV = ARPU ÷ monthly paid churn (capped at 60 months); N/A until there is real churn to measure.',
    'Expansion / contraction MRR are not tracked by the revenue cron yet, so Quick Ratio and GRR use new/churn only.',
    'The funnel\'s last step counts paid subscriptions created in the same 30 days; it is not strictly the same people as the signups above.',
    'Signup cohorts show the share of each week\'s signups active in the last 30 days (a "still alive now" rate, not a fixed-day retention curve).',
  ]

  return {
    generatedAt: now.toISOString(),
    dbLatencyMs: F.dbLatencyMs,
    kpi: {
      mrr: S.lastRev?.mrr ?? null, arr: S.lastRev?.arr ?? null, mrrAsOf: S.lastRev?.date ?? null,
      mrrChange7dPct: pctChange(S.lastRev?.mrr ?? null, S.mrr7?.mrr ?? null),
      mrrChange30dPct: pctChange(S.lastRev?.mrr ?? null, S.mrr30?.mrr ?? null),
      netNewMrr30d: S.flows.netNew, newMrr30d: S.flows.newMrr, churnMrr30d: S.flows.churn,
      expansionMrr30d: S.flows.expansion, contractionMrr30d: S.flows.contraction,
      totalUsers: F.totalUsers, bannedUsers: F.bannedUsers,
      payingCustomers: F.paying, trialingCustomers: F.trialing, pastDueCustomers: F.pastDue, freeToPaidPct: freeToPaid,
      dau: F.dau, wau: F.wau, mau: F.mau, stickinessPct: stickiness,
      signups24h: F.signups24h, signups7d: S.signups7d, signupsPrev7d: S.signupsPrev7d,
      signups30d: S.signups30d, signupsPrev30d: S.signupsPrev30d,
      revenue24h: F.revenue24h, revenue7d: S.revenueSeries.slice(-7).reduce((a, r) => a + r.amount, 0),
      revenue30d: S.revenue30, revenuePrev30d: S.revenuePrev30, expenses30d: S.expenses30d,
      arpu: ue.arpu, ltv: ue.ltv, cac: ue.cac, ltvToCac: ue.ltvToCac, paybackMonths: ue.paybackMonths, quickRatio: ue.quickRatio,
      monthlyChurnPct: ue.monthlyChurnPct, grossRevenueRetentionPct: ue.grossRevenueRetentionPct,
      trialConversionPct: S.trialConversionPct, activationPct: S.activationPct,
      avgRating30d: S.avgRating30d, feedback30d: S.feedback30d, newsletterSubs: S.newsletterSubs,
    },
    series: { mrr: S.mrrSeries, signups: S.signupSeries, revenue: S.revenueSeries },
    planMix: F.planMix,
    funnel: [
      { stage: 'Signups (30d)', count: S.signups30d },
      { stage: 'Onboarded', count: S.onboarded30d },
      { stage: 'New paid subs', count: S.paidSignups30d },
    ],
    heatmap: S.heatmap, cohorts: S.cohorts, geo: S.geo,
    activity: { eventsPerHour: F.hourBuckets, devices: F.devices, topEvents: F.topEvents, sampled: F.sampled, total: F.totalEvents },
    health: {
      agentsActive: F.agentsActive, agentsTotal: F.agentsTotal, failedTasks24h: F.failedTasks24h,
      pendingApprovals: F.pendingApprovals, criticalSecurityOpen: F.critOpen, highSecurityOpen: F.highOpen,
      revenueSnapshotAgeDays: snapAge,
    },
    alerts, feed: F.feed, notes,
  }
}
