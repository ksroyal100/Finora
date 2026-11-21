import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { calculateMRR, getSubscriptionMetrics } from '@/services/subscription.service'

// GET /api/admin/cc/subscriptions
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const plan = url.searchParams.get('plan') ?? ''
  const status = url.searchParams.get('status') ?? ''
  const section = url.searchParams.get('section') ?? 'list'
  const db = createAdminClient()

  if (section === 'metrics') {
    const [mrr, metrics] = await Promise.all([calculateMRR(), getSubscriptionMetrics()])

    const { data: recent } = await db
      .from('subscriptions')
      .select('plan, status, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(30)

    // New MRR this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data: newThisMonth } = await db
      .from('subscriptions')
      .select('plan')
      .not('plan', 'eq', 'free')
      .gte('created_at', startOfMonth.toISOString())

    const planPrices = { pro: 19, plus: 39, elite: 79 } as Record<string, number>
    const newMRR = (newThisMonth ?? []).reduce((s, sub) => s + (planPrices[sub.plan] ?? 0), 0)

    return apiSuccess({
      mrr,
      arr: mrr * 12,
      new_mrr_this_month: newMRR,
      metrics,
      recent_changes: recent ?? [],
    })
  }

  // Subscription list with user details
  let query = db
    .from('subscriptions')
    .select(`
      *,
      user:profiles!user_id(id, email, display_name, avatar_url, created_at)
    `, { count: 'exact' })
    .order('updated_at', { ascending: false })

  if (plan) query = query.eq('plan', plan)
  if (status) query = query.eq('status', status)

  const { data, count, error } = await query.range(from, to)
  if (error) return apiError(error.message, 500)
  return apiSuccess({ subscriptions: data ?? [], total: count ?? 0, page, per_page: perPage })
})

// POST /api/admin/cc/subscriptions — override, cancel, extend trial
export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const { action, user_id } = body
  if (!user_id) return apiError('user_id required', 400)

  const db = createAdminClient()

  if (action === 'override_plan') {
    const { plan } = body
    if (!plan) return apiError('plan required', 400)
    const { adminUpdateUserPlan } = await import('@/services/subscription.service')
    await adminUpdateUserPlan(user_id, plan, userId)
    return apiSuccess({ updated: true, plan })
  }

  if (action === 'cancel') {
    const { data: sub } = await db.from('subscriptions').select('stripe_subscription_id').eq('user_id', user_id).single()
    if (sub?.stripe_subscription_id) {
      const { cancelSubscription } = await import('@/lib/stripe/client')
      await cancelSubscription(sub.stripe_subscription_id, true)
    } else {
      await db.from('subscriptions').update({ plan: 'free', status: 'canceled', canceled_at: new Date().toISOString() }).eq('user_id', user_id)
    }
    return apiSuccess({ canceled: true })
  }

  if (action === 'extend_trial') {
    const { days } = body
    if (!days) return apiError('days required', 400)
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + days)
    await db.from('subscriptions').update({ trial_ends_at: trialEnd.toISOString(), status: 'trialing' }).eq('user_id', user_id)
    return apiSuccess({ trial_extended: true, trial_ends_at: trialEnd.toISOString() })
  }

  if (action === 'add_coupon') {
    const { code, discount_percent } = body
    await db.from('subscriptions').update({ coupon_code: code, discount_percent: discount_percent ?? 0 }).eq('user_id', user_id)
    return apiSuccess({ coupon_added: true })
  }

  return apiError('Invalid action', 400)
})
