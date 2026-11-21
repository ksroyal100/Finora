import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { fulfillOrder } from '@/services/marketplace.service'

// POST /api/marketplace/checkout — confirm payment and fulfill order
export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const { order_id, payment_intent_id } = body
  if (!order_id) return apiError('order_id required', 400)

  const db = createAdminClient()

  // Verify order belongs to user
  const { data: order } = await db
    .from('marketplace_orders')
    .select('id, buyer_id, status, total')
    .eq('id', order_id)
    .eq('buyer_id', userId)
    .single()

  if (!order) return apiError('Order not found', 404)
  if (order.status === 'completed') return apiSuccess({ already_fulfilled: true, order_id })
  if (order.status === 'canceled') return apiError('Order was canceled', 400)

  // Verify payment if paid order
  if (order.total > 0 && payment_intent_id) {
    const { stripe } = await import('@/lib/stripe/client')
    const pi = await stripe.paymentIntents.retrieve(payment_intent_id)

    if (pi.status !== 'succeeded') {
      return apiError(`Payment not completed (status: ${pi.status})`, 400)
    }
    if (pi.metadata?.order_id !== order_id) {
      return apiError('Payment intent does not match order', 400)
    }
  }

  const fulfilled = await fulfillOrder(order_id, payment_intent_id)
  return apiSuccess({ fulfilled: true, order: fulfilled })
})

// GET /api/marketplace/checkout?order_id=xxx — get order status
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const orderId = url.searchParams.get('order_id')
  const sessionId = url.searchParams.get('session_id')
  const db = createAdminClient()

  if (sessionId) {
    // Stripe checkout session lookup
    const { stripe } = await import('@/lib/stripe/client')
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const orderId = session.metadata?.order_id
    if (!orderId) return apiError('No order associated with session', 404)

    const { data: order } = await db.from('marketplace_orders').select('*').eq('id', orderId).eq('buyer_id', userId).single()
    return apiSuccess({ order, session_status: session.status })
  }

  if (!orderId) return apiError('order_id or session_id required', 400)

  const { data: order, error } = await db
    .from('marketplace_orders')
    .select('*, marketplace_order_items(*, marketplace_products(title, thumbnail_url, slug, download_url))')
    .eq('id', orderId)
    .eq('buyer_id', userId)
    .single()

  if (error || !order) return apiError('Order not found', 404)
  return apiSuccess(order)
})
