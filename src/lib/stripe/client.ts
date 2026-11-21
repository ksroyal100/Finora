// ============================================================
// FINORA — Stripe Client & Helpers
// ============================================================

import Stripe from 'stripe'
import { SubscriptionPlan, BillingInterval } from '@/types'

// Created on first use, not at import time: a missing key must not break the production
// build or unrelated pages. `stripe` keeps its original name and type, so no caller changes.
let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set. Billing is disabled until you add it.')
    _stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia', typescript: true })
  }
  return _stripe
}
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripe() as unknown as Record<string | symbol, unknown>
    const value = client[prop]
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(client) : value
  },
})

// ── PRICE ID MAP ─────────────────────────────────────────────

export const STRIPE_PRICES: Record<SubscriptionPlan, Partial<Record<BillingInterval, string>>> = {
  free: {},
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY!,
  },
  plus: {
    monthly: process.env.STRIPE_PRICE_PLUS_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_PLUS_YEARLY!,
  },
  elite: {
    monthly: process.env.STRIPE_PRICE_ELITE_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_ELITE_YEARLY!,
  },
}

// ── PLAN LOOKUP BY PRICE ──────────────────────────────────────

export function getPlanFromPriceId(priceId: string): SubscriptionPlan | null {
  for (const [plan, prices] of Object.entries(STRIPE_PRICES)) {
    if (Object.values(prices).includes(priceId)) {
      return plan as SubscriptionPlan
    }
  }
  return null
}

export function getIntervalFromPriceId(priceId: string): BillingInterval | null {
  for (const [, prices] of Object.entries(STRIPE_PRICES)) {
    for (const [interval, id] of Object.entries(prices)) {
      if (id === priceId) return interval as BillingInterval
    }
  }
  return null
}

// ── CUSTOMER MANAGEMENT ───────────────────────────────────────

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string | null
): Promise<string> {
  // Search for existing customer
  const existing = await stripe.customers.search({
    query: `metadata['user_id']:'${userId}'`,
  })

  if (existing.data.length > 0) {
    return existing.data[0].id
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { user_id: userId },
  })

  return customer.id
}

// ── CHECKOUT SESSION ──────────────────────────────────────────

export async function createCheckoutSession(params: {
  customerId: string
  priceId: string
  userId: string
  email: string
  trialDays?: number
  coupon?: string
  successUrl: string
  cancelUrl: string
}) {
  const { customerId, priceId, userId, trialDays, coupon, successUrl, cancelUrl } = params

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      trial_period_days: trialDays,
      metadata: { user_id: userId },
    },
    discounts: coupon ? [{ coupon }] : undefined,
    allow_promotion_codes: !coupon,
    metadata: { user_id: userId },
  })
}

// ── BILLING PORTAL ────────────────────────────────────────────

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
}

// ── SUBSCRIPTION MANAGEMENT ───────────────────────────────────

export async function cancelSubscription(
  subscriptionId: string,
  immediately = false
) {
  if (immediately) {
    return stripe.subscriptions.cancel(subscriptionId)
  }
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })
}

export async function upgradeSubscription(
  subscriptionId: string,
  newPriceId: string
) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  return stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: subscription.items.data[0].id,
      price: newPriceId,
    }],
    proration_behavior: 'create_prorations',
  })
}

// ── MARKETPLACE PAYMENT INTENT ────────────────────────────────

export async function createMarketplacePaymentIntent(params: {
  amount: number
  currency: string
  customerId: string
  orderId: string
  metadata?: Record<string, string>
}) {
  return stripe.paymentIntents.create({
    amount: Math.round(params.amount * 100), // cents
    currency: params.currency.toLowerCase(),
    customer: params.customerId,
    metadata: {
      order_id: params.orderId,
      ...params.metadata,
    },
    automatic_payment_methods: { enabled: true },
  })
}

// ── CONNECT: CREATOR PAYOUTS ─────────────────────────────────

export async function createConnectedAccount(email: string) {
  return stripe.accounts.create({
    type: 'express',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  })
}

export async function createAccountOnboardingLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
) {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  })
}

export async function createCreatorTransfer(params: {
  amount: number
  currency: string
  destinationAccountId: string
  description: string
  metadata?: Record<string, string>
}) {
  return stripe.transfers.create({
    amount: Math.round(params.amount * 100),
    currency: params.currency.toLowerCase(),
    destination: params.destinationAccountId,
    description: params.description,
    metadata: params.metadata,
  })
}

// ── WEBHOOK VERIFICATION ──────────────────────────────────────

export function constructStripeWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  )
}
