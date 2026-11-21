// ============================================================
// FINORA — Analytics Service
// ============================================================

import { createAdminClient } from '@/lib/supabase/server'
import { getServerPostHog, trackServerEvent } from '@/lib/analytics/posthog'
import { getClientIP } from '@/lib/security/rbac'

// ── PLATFORM EVENTS ───────────────────────────────────────────

export const EVENTS = {
  // Auth
  USER_SIGNED_UP:        'user_signed_up',
  USER_SIGNED_IN:        'user_signed_in',
  USER_SIGNED_OUT:       'user_signed_out',
  // Subscription
  SUBSCRIPTION_STARTED:  'subscription_started',
  SUBSCRIPTION_UPGRADED: 'subscription_upgraded',
  SUBSCRIPTION_CANCELED: 'subscription_canceled',
  // AI Coach
  AI_QUERY_SENT:         'ai_query_sent',
  AI_LIMIT_HIT:          'ai_limit_hit',
  // Portfolio
  HOLDING_ADDED:         'holding_added',
  TRANSACTION_ADDED:     'transaction_added',
  // Goals
  GOAL_CREATED:          'goal_created',
  GOAL_COMPLETED:        'goal_completed',
  GOAL_CONTRIBUTION:     'goal_contribution',
  // Net Worth
  ASSET_ADDED:           'asset_added',
  LIABILITY_ADDED:       'liability_added',
  NET_WORTH_CALCULATED:  'net_worth_calculated',
  // Marketplace
  PRODUCT_VIEWED:        'product_viewed',
  PRODUCT_PURCHASED:     'product_purchased',
  WISHLIST_ADDED:        'wishlist_added',
  // Learning
  COURSE_ENROLLED:       'course_enrolled',
  LESSON_COMPLETED:      'lesson_completed',
  COURSE_COMPLETED:      'course_completed',
  CERTIFICATE_EARNED:    'certificate_earned',
  // Community
  POST_CREATED:          'post_created',
  POST_LIKED:            'post_liked',
  COMMENT_CREATED:       'comment_created',
  USER_FOLLOWED:         'user_followed',
  // Research
  REPORT_VIEWED:         'report_viewed',
  REPORT_SAVED:          'report_saved',
  WATCHLIST_UPDATED:     'watchlist_updated',
  // Financial Health
  HEALTH_CALCULATED:     'health_calculated',
} as const

// ── TRACK EVENT ───────────────────────────────────────────────

export async function trackEvent(params: {
  userId?: string
  event: string
  properties?: Record<string, unknown>
  sessionId?: string
  pageUrl?: string
  ipAddress?: string
  userAgent?: string
}) {
  const db = createAdminClient()

  // Store in internal analytics
  try {
    await db.from('platform_analytics').insert({
      event_name: params.event,
      user_id: params.userId ?? null,
      session_id: params.sessionId ?? null,
      properties: params.properties ?? {},
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      page_url: params.pageUrl ?? null,
    })
  } catch (err) {
    console.error(err)
  }

  // Also send to PostHog for product analytics
  if (params.userId) {
    trackServerEvent({
      userId: params.userId,
      event: params.event,
      properties: params.properties,
    }).catch(console.error)
  }
}

// ── PLATFORM METRICS ──────────────────────────────────────────

export async function getPlatformMetrics(period: 'day' | 'week' | 'month' | 'all' = 'month') {
  const db = createAdminClient()
  const now = new Date()
  let since: Date

  switch (period) {
    case 'day':   since = new Date(now.getTime() - 86_400_000); break
    case 'week':  since = new Date(now.getTime() - 7 * 86_400_000); break
    case 'month': since = new Date(now.getTime() - 30 * 86_400_000); break
    default:      since = new Date(0)
  }

  const sinceISO = since.toISOString()

  const [
    { count: newUsers },
    { count: activeUsers },
    { count: aiQueries },
    { count: newGoals },
    { count: coursesEnrolled },
    { count: communityPosts },
    { count: marketplacePurchases },
    { data: eventBreakdown },
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sinceISO),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('last_active_at', sinceISO),
    db.from('ai_messages').select('*', { count: 'exact', head: true }).eq('role', 'user').gte('created_at', sinceISO),
    db.from('goals').select('*', { count: 'exact', head: true }).gte('created_at', sinceISO),
    db.from('course_enrollments').select('*', { count: 'exact', head: true }).gte('enrolled_at', sinceISO),
    db.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'published').gte('created_at', sinceISO),
    db.from('marketplace_orders').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('created_at', sinceISO),
    db.from('platform_analytics').select('event_name').gte('recorded_at', sinceISO),
  ])

  const eventCounts = (eventBreakdown ?? []).reduce((acc, e) => {
    acc[e.event_name] = (acc[e.event_name] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    period,
    since: sinceISO,
    users: {
      new: newUsers ?? 0,
      active: activeUsers ?? 0,
    },
    engagement: {
      ai_queries: aiQueries ?? 0,
      goals_created: newGoals ?? 0,
      courses_enrolled: coursesEnrolled ?? 0,
      community_posts: communityPosts ?? 0,
      marketplace_purchases: marketplacePurchases ?? 0,
    },
    event_breakdown: eventCounts,
  }
}

// ── FUNNEL ANALYTICS ──────────────────────────────────────────

export async function getConversionFunnel() {
  const db = createAdminClient()

  const [
    { count: totalSignups },
    { count: completedOnboarding },
    { count: addedPortfolio },
    { count: createdGoal },
    { count: upgradedToPaid },
    { count: madeMarketplacePurchase },
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_completed', true),
    db.from('portfolios').select('user_id', { count: 'exact', head: true }),
    db.from('goals').select('user_id', { count: 'exact', head: true }),
    db.from('subscriptions').select('*', { count: 'exact', head: true }).not('plan', 'eq', 'free').eq('status', 'active'),
    db.from('user_purchases').select('user_id', { count: 'exact', head: true }),
  ])

  const total = totalSignups ?? 1

  return {
    funnel: [
      { step: 'Signed Up',              count: totalSignups ?? 0,          pct: 100 },
      { step: 'Completed Onboarding',   count: completedOnboarding ?? 0,   pct: Math.round(((completedOnboarding ?? 0) / total) * 100) },
      { step: 'Added Portfolio',        count: addedPortfolio ?? 0,        pct: Math.round(((addedPortfolio ?? 0) / total) * 100) },
      { step: 'Created Goal',           count: createdGoal ?? 0,           pct: Math.round(((createdGoal ?? 0) / total) * 100) },
      { step: 'Upgraded to Paid',       count: upgradedToPaid ?? 0,        pct: Math.round(((upgradedToPaid ?? 0) / total) * 100) },
      { step: 'Marketplace Purchase',   count: madeMarketplacePurchase ?? 0, pct: Math.round(((madeMarketplacePurchase ?? 0) / total) * 100) },
    ],
    conversion_rate: Math.round(((upgradedToPaid ?? 0) / total) * 100),
  }
}

// ── USER COHORT ANALYSIS ──────────────────────────────────────

export async function getCohortRetention() {
  const db = createAdminClient()

  // Get signups by month for last 6 months
  const cohorts: Array<{ month: string; total: number; retained: number }> = []

  for (let i = 5; i >= 0; i--) {
    const cohortStart = new Date()
    cohortStart.setMonth(cohortStart.getMonth() - i)
    cohortStart.setDate(1)
    cohortStart.setHours(0, 0, 0, 0)

    const cohortEnd = new Date(cohortStart)
    cohortEnd.setMonth(cohortEnd.getMonth() + 1)

    const { count: total } = await db
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', cohortStart.toISOString())
      .lt('created_at', cohortEnd.toISOString())

    // "Retained" = still active in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
    const { count: retained } = await db
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', cohortStart.toISOString())
      .lt('created_at', cohortEnd.toISOString())
      .gte('last_active_at', thirtyDaysAgo.toISOString())

    cohorts.push({
      month: cohortStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      total: total ?? 0,
      retained: retained ?? 0,
    })
  }

  return cohorts.map(c => ({
    ...c,
    retention_rate: c.total > 0 ? Math.round((c.retained / c.total) * 100) : 0,
  }))
}

// ── FLUSH POSTHOG ─────────────────────────────────────────────

export async function flushAnalytics() {
  const ph = getServerPostHog()
  await ph.shutdown()
}
