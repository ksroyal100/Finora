import { NextRequest, NextResponse } from 'next/server'
import { constructStripeWebhookEvent } from '@/lib/stripe/client'
import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from '@/services/subscription.service'
import { fulfillOrder } from '@/services/marketplace.service'
import { createAdminClient } from '@/lib/supabase/server'
import { logSecurityEvent } from '@/lib/security/rbac'
import Stripe from 'stripe'

export const runtime = 'nodejs'

async function userIdForCustomer(db: ReturnType<typeof createAdminClient>, customerId: string): Promise<string | null> {
  const { data } = await db.from('subscriptions').select('user_id').eq('stripe_customer_id', customerId).single()
  return data?.user_id ?? null
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = constructStripeWebhookEvent(body, signature)
  } catch (err) {
    console.error('[Webhook] Invalid signature:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = createAdminClient()

  try {
    switch (event.type) {
      // ── SUBSCRIPTIONS ─────────────────────────────────────
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionCreated({
          id: sub.id,
          customer: sub.customer as string,
          status: sub.status,
          items: { data: sub.items.data.map(i => ({ price: { id: i.price.id } })) },
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
          trial_start: sub.trial_start,
          trial_end: sub.trial_end,
          metadata: (sub.metadata ?? {}) as Record<string, string>,
        })
        const createdUserId = await userIdForCustomer(db, sub.customer as string)
        if (createdUserId) {
          await logSecurityEvent({ userId: createdUserId, eventType: 'subscription_created', severity: 'low', metadata: { status: sub.status } })
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated({
          id: sub.id,
          status: sub.status,
          items: { data: sub.items.data.map(i => ({ price: { id: i.price.id } })) },
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
          cancel_at: sub.cancel_at,
          canceled_at: sub.canceled_at,
          metadata: (sub.metadata ?? {}) as Record<string, string>,
        })
        const updatedUserId = await userIdForCustomer(db, sub.customer as string)
        if (updatedUserId) {
          await logSecurityEvent({ userId: updatedUserId, eventType: 'subscription_updated', severity: 'low', metadata: { status: sub.status } })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const deletedUserId = await userIdForCustomer(db, sub.customer as string)
        await handleSubscriptionDeleted(sub.id)
        if (deletedUserId) {
          await logSecurityEvent({ userId: deletedUserId, eventType: 'subscription_canceled', severity: 'low' })
        }
        break
      }

      // ── INVOICES ──────────────────────────────────────────
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Get user by stripe customer id
        const { data: sub } = await db
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (sub?.user_id) {
          await db.from('invoices').upsert({
            user_id: sub.user_id,
            stripe_invoice_id: invoice.id,
            status: 'paid',
            amount_due: invoice.amount_due / 100,
            amount_paid: invoice.amount_paid / 100,
            currency: invoice.currency,
            description: invoice.description ?? `Subscription payment`,
            invoice_pdf: invoice.invoice_pdf,
            hosted_invoice_url: invoice.hosted_invoice_url,
            period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
            period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
            paid_at: new Date().toISOString(),
          }, { onConflict: 'stripe_invoice_id' })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        const { data: sub } = await db
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (sub?.user_id) {
          await db.from('notifications').insert({
            user_id: sub.user_id,
            type: 'billing',
            channel: 'in_app',
            title: 'Payment Failed',
            body: 'Your subscription payment failed. Please update your payment method to keep access.',
            action_url: '/billing',
            action_label: 'Update Payment',
          })
          await logSecurityEvent({ userId: sub.user_id, eventType: 'payment_failed', severity: 'medium', metadata: { invoiceId: invoice.id } })
        }
        break
      }

      // ── MARKETPLACE PAYMENTS ──────────────────────────────
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const orderId = pi.metadata?.order_id

        if (orderId) {
          await fulfillOrder(orderId, pi.id)
        }
        break
      }

      // ── CHECKOUT ──────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        // Subscription checkout is handled by subscription events
        // Marketplace checkout is handled by payment_intent events
        console.log('[Webhook] Checkout completed:', session.id)
        break
      }

      // ── CONNECT: STRIPE ACCOUNT STATUS ───────────────────
      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        const status = account.charges_enabled ? 'active' : 'pending'

        await db
          .from('creator_stores')
          .update({ stripe_account_status: status, is_active: account.charges_enabled })
          .eq('stripe_account_id', account.id)
        break
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error(`[Webhook] Error processing ${event.type}:`, err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
