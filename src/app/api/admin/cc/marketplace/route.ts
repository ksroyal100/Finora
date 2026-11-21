import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, getPagination, createAuditLog } from '@/lib/security/rbac'
import { adminUpdateProductStatus, processCreatorPayout } from '@/services/marketplace.service'
import { z } from 'zod'

// GET /api/admin/cc/marketplace — admin marketplace overview
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const section = url.searchParams.get('section') ?? 'overview'
  const status = url.searchParams.get('status') ?? ''
  const db = createAdminClient()

  if (section === 'products') {
    let query = db
      .from('marketplace_products')
      .select(`*, creator:profiles!creator_id(display_name, email)`, { count: 'exact' })
      .order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data, count, error } = await query.range(from, to)
    if (error) return apiError(error.message, 500)
    return apiSuccess({ products: data ?? [], total: count ?? 0, page, per_page: perPage })
  }

  if (section === 'orders') {
    const { data, count, error } = await db
      .from('marketplace_orders')
      .select(`*, buyer:profiles!buyer_id(display_name, email), marketplace_order_items(*)`, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) return apiError(error.message, 500)
    return apiSuccess({ orders: data ?? [], total: count ?? 0, page, per_page: perPage })
  }

  if (section === 'creators') {
    const { data, count, error } = await db
      .from('creator_stores')
      .select(`*, owner:profiles!user_id(display_name, email, is_banned)`, { count: 'exact' })
      .order('total_revenue', { ascending: false })
      .range(from, to)
    if (error) return apiError(error.message, 500)
    return apiSuccess({ creators: data ?? [], total: count ?? 0, page, per_page: perPage })
  }

  if (section === 'payouts') {
    const { data, count, error } = await db
      .from('creator_payouts')
      .select(`*, creator:profiles!creator_id(display_name, email)`, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) return apiError(error.message, 500)
    return apiSuccess({ payouts: data ?? [], total: count ?? 0, page, per_page: perPage })
  }

  // Overview stats
  const [
    { count: totalProducts },
    { count: pendingReview },
    { count: totalOrders },
    { count: totalCreators },
    { data: recentOrders },
    { data: topProducts },
    { data: pendingPayouts },
  ] = await Promise.all([
    db.from('marketplace_products').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    db.from('marketplace_products').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
    db.from('marketplace_orders').select('*', { count: 'exact', head: true }),
    db.from('creator_stores').select('*', { count: 'exact', head: true }).eq('is_active', true),
    db.from('marketplace_orders').select('order_number, total, status, created_at, buyer:profiles!buyer_id(display_name)').order('created_at', { ascending: false }).limit(10),
    db.from('marketplace_products').select('title, purchase_count, view_count, average_rating, price').eq('status', 'published').order('purchase_count', { ascending: false }).limit(10),
    db.from('creator_payouts').select('*, creator:profiles!creator_id(display_name)').eq('status', 'pending').order('amount', { ascending: false }).limit(10),
  ])

  return apiSuccess({
    stats: {
      total_products: totalProducts ?? 0,
      pending_review: pendingReview ?? 0,
      total_orders: totalOrders ?? 0,
      active_creators: totalCreators ?? 0,
    },
    recent_orders: recentOrders ?? [],
    top_products: topProducts ?? [],
    pending_payouts: pendingPayouts ?? [],
  })
})

// POST /api/admin/cc/marketplace — moderate products, process payouts, refunds
export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const { action } = body
  const db = createAdminClient()

  if (action === 'approve_product') {
    const { product_id } = body
    if (!product_id) return apiError('Product ID required', 400)
    const product = await adminUpdateProductStatus(product_id, 'published', userId)
    return apiSuccess({ approved: true, product })
  }

  if (action === 'reject_product') {
    const { product_id, reason } = body
    if (!product_id || !reason) return apiError('product_id and reason required', 400)
    const product = await adminUpdateProductStatus(product_id, 'rejected', userId, reason)
    return apiSuccess({ rejected: true, product })
  }

  if (action === 'remove_product') {
    const { product_id, reason } = body
    if (!product_id) return apiError('Product ID required', 400)
    const product = await adminUpdateProductStatus(product_id, 'archived', userId, reason)
    await createAuditLog({ adminId: userId, action: 'product_removed', resourceType: 'marketplace_product', resourceId: product_id, newData: { reason } })
    return apiSuccess({ removed: true })
  }

  if (action === 'process_payout') {
    const { creator_id } = body
    if (!creator_id) return apiError('Creator ID required', 400)
    const payout = await processCreatorPayout(creator_id)
    if (!payout) return apiError('No revenue to pay out or below minimum threshold', 400)
    return apiSuccess({ payout })
  }

  if (action === 'refund_order') {
    const { order_id, reason } = body
    if (!order_id) return apiError('Order ID required', 400)

    const { data: order } = await db.from('marketplace_orders').select('stripe_payment_intent_id, total, buyer_id').eq('id', order_id).single()
    if (!order) return apiError('Order not found', 404)

    if (order.stripe_payment_intent_id) {
      const { stripe } = await import('@/lib/stripe/client')
      await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id,
        metadata: { order_id, reason: reason ?? 'Admin refund', admin_id: userId },
      })
    }

    await db.from('marketplace_orders').update({ status: 'refunded', refunded_at: new Date().toISOString() }).eq('id', order_id)

    await db.from('notifications').insert({
      user_id: order.buyer_id, type: 'billing', channel: 'in_app',
      title: 'Refund Processed',
      body: `Your refund of $${order.total} has been processed and will appear within 5-10 business days.`,
    })

    await createAuditLog({ adminId: userId, action: 'order_refunded', resourceType: 'marketplace_order', resourceId: order_id, newData: { amount: order.total, reason } })
    return apiSuccess({ refunded: true, amount: order.total })
  }

  if (action === 'verify_creator') {
    const { store_id } = body
    if (!store_id) return apiError('Store ID required', 400)
    await db.from('creator_stores').update({ is_verified: true }).eq('id', store_id)
    return apiSuccess({ verified: true })
  }

  // Push a product directly, as an admin/official listing — published
  // immediately, no moderation queue needed since it's admin-authored.
  if (action === 'create_product') {
    const schema = z.object({
      title: z.string().min(1).max(300),
      slug: z.string().min(1).max(300).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
      description: z.string().optional().default(''),
      short_description: z.string().max(300).optional().default(''),
      category: z.enum(['investing', 'real_estate', 'startups', 'ai', 'software', 'business', 'templates', 'courses', 'research_reports', 'ai_prompt_packs', 'services', 'jobs', 'deals', 'acquisitions']),
      price: z.number().min(0).default(0),
      thumbnail_url: z.string().url().optional().or(z.literal('')),
      external_url: z.string().url().optional().or(z.literal('')),
      is_official: z.boolean().default(true),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed: ' + parsed.error.issues.map(i => i.message).join(', '), 400)

    const { data, error } = await db
      .from('marketplace_products')
      .insert({
        ...parsed.data,
        thumbnail_url: parsed.data.thumbnail_url || null,
        external_url: parsed.data.external_url || null,
        creator_id: userId, // listed under the admin's own account, flagged is_official for UI distinction
        status: 'published',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return apiError('A product with this slug already exists', 409)
      return apiError(error.message, 500)
    }

    await createAuditLog({ adminId: userId, action: 'marketplace_product.create', resourceType: 'marketplace_product', resourceId: data.id })
    return apiSuccess(data, 201)
  }

  // Real content edit — title, price, description, etc. — not just a
  // status transition.
  if (action === 'update_product') {
    const { product_id, ...fields } = body
    if (!product_id) return apiError('product_id required', 400)

    const schema = z.object({
      title: z.string().min(1).max(300).optional(),
      description: z.string().optional(),
      short_description: z.string().max(300).optional(),
      category: z.enum(['investing', 'real_estate', 'startups', 'ai', 'software', 'business', 'templates', 'courses', 'research_reports', 'ai_prompt_packs', 'services', 'jobs', 'deals', 'acquisitions']).optional(),
      price: z.number().min(0).optional(),
      thumbnail_url: z.string().url().optional().or(z.literal('')),
      external_url: z.string().url().optional().or(z.literal('')),
      status: z.enum(['draft', 'pending_review', 'published', 'archived', 'rejected']).optional(),
    })
    const parsed = schema.safeParse(fields)
    if (!parsed.success) return apiError('Validation failed: ' + parsed.error.issues.map(i => i.message).join(', '), 400)

    const updates: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() }
    if (parsed.data.thumbnail_url === '') updates.thumbnail_url = null
    if (parsed.data.external_url === '') updates.external_url = null

    const { data, error } = await db.from('marketplace_products').update(updates).eq('id', product_id).select().single()
    if (error) return apiError(error.message, 500)

    await createAuditLog({ adminId: userId, action: 'marketplace_product.update', resourceType: 'marketplace_product', resourceId: product_id, metadata: { changed_fields: Object.keys(parsed.data) } })
    return apiSuccess(data)
  }

  // A genuine, permanent delete — distinct from 'remove_product' above,
  // which only archives (keeps the row, hides it). This is for listings
  // that should be fully gone (e.g. a mistaken admin-created listing).
  if (action === 'delete_product') {
    const { product_id } = body
    if (!product_id) return apiError('product_id required', 400)
    const { error } = await db.from('marketplace_products').delete().eq('id', product_id)
    if (error) return apiError(error.message, 500)

    await createAuditLog({ adminId: userId, action: 'marketplace_product.delete', resourceType: 'marketplace_product', resourceId: product_id })
    return apiSuccess({ deleted: true })
  }

  return apiError('Invalid action', 400)
})
