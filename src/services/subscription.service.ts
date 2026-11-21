// ============================================================
// FINORA — Subscription Service
// ============================================================

import { createAdminClient } from '@/lib/supabase/server'
import {
  getOrCreateStripeCustomer, createCheckoutSession,
  createBillingPortalSession, cancelSubscription,
  upgradeSubscription, STRIPE_PRICES, getPlanFromPriceId,
  getIntervalFromPriceId,
} from '@/lib/stripe/client'
import { sendEmail } from '@/lib/email/resend'
import type { Subscription, SubscriptionPlan, BillingInterval, PlanLimits } from '@/types'

const db = createAdminClient()

// ── PLAN LIMITS ───────────────────────────────────────────────

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    ai_queries_per_week: 3,
    portfolio_assets: 5,
    goals: 3,
    budget_categories: 5,
    marketplace_purchases: true,
    research_access: false,
    marketplace_free_only: false,
  },
  pro: {
    ai_queries_per_week: -1,
    portfolio_assets: -1,
    goals: -1,
    budget_categories: -1,
    marketplace_purchases: true,
    research_access: true,
    marketplace_free_only: false,
  },
  plus: {
    ai_queries_per_week: -1,
    portfolio_assets: -1,
    goals: -1,
    budget_categories: -1,
    marketplace_purchases: true,
    research_access: true,
    marketplace_free_only: false,
    creator_store: true,
    api_access: true,
  },
  elite: {
    ai_queries_per_week: -1,
    portfolio_assets: -1,
    goals: -1,
    budget_categories: -1,
    marketplace_purchases: true,
    research_access: true,
    marketplace_free_only: false,
    creator_store: true,
    api_access: true,
    white_label: true,
    custom_integrations: true,
  },
}

// ── GET USER SUBSCRIPTION ─────────────────────────────────────

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const { data } = await db
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

export async function getUserPlan(userId: string): Promise<SubscriptionPlan> {
  const { data } = await db
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .single()

  if (!data || data.status !== 'active') return 'free'
  return data.plan as SubscriptionPlan
}

// ── ENTITLEMENTS ──────────────────────────────────────────────

export async function getUserEntitlements(userId: string) {
  const plan = await getUserPlan(userId)
  return { plan, limits: PLAN_LIMITS[plan] }
}

export async function checkEntitlement(
  userId: string,
  feature: keyof PlanLimits
): Promise<boolean> {
  const plan = await getUserPlan(userId)
  const limit = PLAN_LIMITS[plan][feature]
  if (typeof limit === 'boolean') return limit
  return limit !== 0
}

// ── USAGE TRACKING ────────────────────────────────────────────

export function getWeekStart(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday
}

export async function checkAndIncrementUsage(
  userId: string,
  feature: string,
  limit: number
): Promise<{ allowed: boolean; used: number; remaining: number }> {
  const weekStart = getWeekStart()
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const { data: existing } = await db
    .from('usage_tracking')
    .select('count')
    .eq('user_id', userId)
    .eq('feature', feature)
    .eq('period_start', weekStart.toISOString())
    .single()

  const currentCount = existing?.count ?? 0

  if (limit !== -1 && currentCount >= limit) {
    return { allowed: false, used: currentCount, remaining: 0 }
  }

  // Upsert usage
  await db.from('usage_tracking').upsert({
    user_id: userId,
    feature,
    count: currentCount + 1,
    period_start: weekStart.toISOString(),
    period_end: weekEnd.toISOString(),
  }, { onConflict: 'user_id,feature,period_start' })

  const newCount = currentCount + 1
  return {
    allowed: true,
    used: newCount,
    remaining: limit === -1 ? -1 : Math.max(0, limit - newCount),
  }
}

export async function getUsageStatus(userId: string, feature: string) {
  const plan = await getUserPlan(userId)
  const limits = PLAN_LIMITS[plan]
  
  let limit = -1
  if (feature === 'ai_queries_per_week') limit = limits.ai_queries_per_week
  if (feature === 'portfolio_assets') limit = limits.portfolio_assets
  if (feature === 'goals') limit = limits.goals

  const weekStart = getWeekStart()
  const { data: usage } = await db
    .from('usage_tracking')
    .select('count')
    .eq('user_id', userId)
    .eq('feature', feature)
    .eq('period_start', weekStart.toISOString())
    .single()

  const used = usage?.count ?? 0
  return {
    used,
    limit,
    remaining: limit === -1 ? -1 : Math.max(0, limit - used),
    is_unlimited: limit === -1,
    plan,
  }
}

// ── AI QUERY USAGE ────────────────────────────────────────────

export async function checkAIQueryUsage(userId: string) {
  const plan = await getUserPlan(userId)
  const weeklyLimit = PLAN_LIMITS[plan].ai_queries_per_week

  if (weeklyLimit === -1) {
    return {
      allowed: true,
      queries_used: 0,
      queries_limit: -1,
      queries_remaining: -1,
      is_unlimited: true,
      plan,
    }
  }

  const weekStart = getWeekStart()
  const { data: usage } = await db
    .from('ai_usage_logs')
    .select('query_count')
    .eq('user_id', userId)
    .eq('week_start', weekStart.toISOString().split('T')[0])
    .single()

  const used = usage?.query_count ?? 0
  const remaining = Math.max(0, weeklyLimit - used)

  return {
    allowed: used < weeklyLimit,
    queries_used: used,
    queries_limit: weeklyLimit,
    queries_remaining: remaining,
    is_unlimited: false,
    plan,
  }
}

export async function incrementAIQueryCount(userId: string, tokensUsed = 0) {
  const weekStart = getWeekStart()
  const weekStartDate = weekStart.toISOString().split('T')[0]

  const { data: existing } = await db
    .from('ai_usage_logs')
    .select('id, query_count, tokens_used')
    .eq('user_id', userId)
    .eq('week_start', weekStartDate)
    .single()

  if (existing) {
    await db
      .from('ai_usage_logs')
      .update({
        query_count: existing.query_count + 1,
        tokens_used: (existing.tokens_used ?? 0) + tokensUsed,
      })
      .eq('id', existing.id)
  } else {
    await db.from('ai_usage_logs').insert({
      user_id: userId,
      query_count: 1,
      tokens_used: tokensUsed,
      week_start: weekStartDate,
    })
  }
}

// ── CHECKOUT ──────────────────────────────────────────────────

export async function createSubscriptionCheckout(params: {
  userId: string
  plan: SubscriptionPlan
  interval: BillingInterval
  couponCode?: string
  trialDays?: number
}) {
  const { userId, plan, interval, couponCode, trialDays } = params

  const { data: profile } = await db
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .single()

  if (!profile) throw new Error('Profile not found')

  const priceId = STRIPE_PRICES[plan][interval]
  if (!priceId) throw new Error(`No price found for ${plan}/${interval}`)

  const { data: sub } = await db
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single()

  const customerId = sub?.stripe_customer_id ??
    await getOrCreateStripeCustomer(userId, profile.email, profile.full_name)

  const session = await createCheckoutSession({
    customerId,
    priceId,
    userId,
    email: profile.email,
    trialDays,
    coupon: couponCode,
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
  })

  // Update customer ID if new
  if (!sub?.stripe_customer_id) {
    await db.from('subscriptions').update({
      stripe_customer_id: customerId,
    }).eq('user_id', userId)
  }

  return session
}

// ── BILLING PORTAL ────────────────────────────────────────────

export async function getPortalSession(userId: string) {
  const { data: sub } = await db
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single()

  if (!sub?.stripe_customer_id) throw new Error('No billing account found')

  return createBillingPortalSession(
    sub.stripe_customer_id,
    `${process.env.NEXT_PUBLIC_APP_URL}/billing`
  )
}

// ── SUBSCRIPTION LIFECYCLE ────────────────────────────────────

export async function handleSubscriptionCreated(stripeSubscription: {
  id: string
  customer: string
  status: string
  items: { data: Array<{ price: { id: string } }> }
  current_period_start: number
  current_period_end: number
  trial_start: number | null
  trial_end: number | null
  metadata: Record<string, string>
}) {
  const priceId = stripeSubscription.items.data[0]?.price.id
  const plan = getPlanFromPriceId(priceId) ?? 'pro'
  const interval = getIntervalFromPriceId(priceId) ?? 'monthly'
  const userId = stripeSubscription.metadata.user_id

  if (!userId) return

  await db.from('subscriptions').upsert({
    user_id: userId,
    plan,
    status: stripeSubscription.status as Subscription['status'],
    interval,
    stripe_subscription_id: stripeSubscription.id,
    stripe_customer_id: stripeSubscription.customer,
    stripe_price_id: priceId,
    current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
    trial_starts_at: stripeSubscription.trial_start
      ? new Date(stripeSubscription.trial_start * 1000).toISOString() : null,
    trial_ends_at: stripeSubscription.trial_end
      ? new Date(stripeSubscription.trial_end * 1000).toISOString() : null,
  }, { onConflict: 'user_id' })

  // Send welcome email
  const { data: profile } = await db.from('profiles').select('email, display_name').eq('id', userId).single()
  if (profile) {
    await sendEmail({
      to: profile.email,
      subject: `Welcome to Finora ${plan.charAt(0).toUpperCase() + plan.slice(1)}! 🚀`,
      template: 'subscription_welcome',
      data: { name: profile.display_name ?? 'Wealth Builder', plan },
    })
  }

  // Send in-app notification
  await db.from('notifications').insert({
    user_id: userId,
    type: 'subscription',
    channel: 'in_app',
    title: `🎉 Welcome to Finora ${plan.toUpperCase()}!`,
    body: `Your ${plan} subscription is now active. All features are unlocked.`,
    action_url: '/dashboard',
    action_label: 'Go to Dashboard',
  })
}

export async function handleSubscriptionUpdated(stripeSubscription: {
  id: string
  status: string
  items: { data: Array<{ price: { id: string } }> }
  current_period_start: number
  current_period_end: number
  cancel_at: number | null
  canceled_at: number | null
  metadata: Record<string, string>
}) {
  const priceId = stripeSubscription.items.data[0]?.price.id
  const plan = getPlanFromPriceId(priceId)
  const interval = getIntervalFromPriceId(priceId)

  await db.from('subscriptions')
    .update({
      plan: plan ?? undefined,
      status: stripeSubscription.status as Subscription['status'],
      interval: interval ?? undefined,
      stripe_price_id: priceId,
      current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      cancel_at: stripeSubscription.cancel_at
        ? new Date(stripeSubscription.cancel_at * 1000).toISOString() : null,
      canceled_at: stripeSubscription.canceled_at
        ? new Date(stripeSubscription.canceled_at * 1000).toISOString() : null,
    })
    .eq('stripe_subscription_id', stripeSubscription.id)
}

export async function handleSubscriptionDeleted(subscriptionId: string) {
  const { data: sub } = await db
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (!sub) return

  await db.from('subscriptions').update({
    plan: 'free',
    status: 'canceled',
    stripe_subscription_id: null,
    stripe_price_id: null,
    cancel_at: null,
    canceled_at: new Date().toISOString(),
  }).eq('stripe_subscription_id', subscriptionId)

  await db.from('notifications').insert({
    user_id: sub.user_id,
    type: 'subscription',
    channel: 'in_app',
    title: 'Subscription Ended',
    body: 'Your paid subscription has ended. You are now on the Free plan. Upgrade anytime to restore access.',
    action_url: '/billing',
    action_label: 'Upgrade Now',
  })
}

// ── VALIDATE COUPON ───────────────────────────────────────────

export async function validateCoupon(code: string) {
  const { data: coupon } = await db
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .single()

  if (!coupon) return { valid: false, error: 'Coupon not found' }

  if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
    return { valid: false, error: 'Coupon has expired' }
  }

  if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
    return { valid: false, error: 'Coupon usage limit reached' }
  }

  return {
    valid: true,
    coupon: {
      code: coupon.code,
      type: coupon.type,
      discount_value: coupon.discount_value,
      min_order_amount: coupon.min_order_amount,
    },
  }
}

// ── ADMIN: SUBSCRIPTION MANAGEMENT ───────────────────────────

export async function adminUpdateUserPlan(
  userId: string,
  plan: SubscriptionPlan,
  adminId: string
) {
  const { data: existing } = await db
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  await db.from('subscriptions').upsert({
    user_id: userId,
    plan,
    status: 'active',
    stripe_subscription_id: existing?.stripe_subscription_id ?? null,
  }, { onConflict: 'user_id' })

  // Audit log
  const { createAuditLog } = await import('@/lib/security/rbac')
  await createAuditLog({
    adminId,
    action: 'admin_plan_update',
    resourceType: 'subscription',
    resourceId: userId,
    oldData: existing,
    newData: { plan, status: 'active' },
  })

  // Notify user
  await db.from('notifications').insert({
    user_id: userId,
    type: 'subscription',
    channel: 'in_app',
    title: `Plan Updated to ${plan.toUpperCase()}`,
    body: `Your plan has been updated to ${plan} by our team.`,
  })
}

// ── REVENUE METRICS ───────────────────────────────────────────

export async function calculateMRR(): Promise<number> {
  const { data } = await db
    .from('subscriptions')
    .select('plan, interval, stripe_subscription_id')
    .eq('status', 'active')
    .not('plan', 'eq', 'free')

  if (!data) return 0

  const planPrices = { pro: 19, plus: 39, elite: 79 }

  return data.reduce((total, sub) => {
    const plan = sub.plan as 'pro' | 'plus' | 'elite'
    const monthlyPrice = planPrices[plan] ?? 0
    const monthly = sub.interval === 'yearly' ? monthlyPrice * (10/12) : monthlyPrice
    return total + monthly
  }, 0)
}

export async function getSubscriptionMetrics() {
  const { data: subs } = await db
    .from('subscriptions')
    .select('plan, status')
    .eq('status', 'active')

  if (!subs) return null

  return {
    total: subs.length,
    free: subs.filter(s => s.plan === 'free').length,
    pro: subs.filter(s => s.plan === 'pro').length,
    plus: subs.filter(s => s.plan === 'plus').length,
    elite: subs.filter(s => s.plan === 'elite').length,
    paid: subs.filter(s => s.plan !== 'free').length,
  }
}
