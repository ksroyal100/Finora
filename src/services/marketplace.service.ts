// ============================================================
// FINORA — Marketplace Service
// ============================================================

import { createAdminClient } from '@/lib/supabase/server'
import {
  createMarketplacePaymentIntent,
  createConnectedAccount,
  createAccountOnboardingLink,
  createCreatorTransfer,
} from '@/lib/stripe/client'
import { sendEmail } from '@/lib/email/resend'
import type {
  MarketplaceProduct, MarketplaceOrder, CreatorStore,
  MarketplaceCategory, ProductStatus, PaginatedResponse
} from '@/types'

const db = createAdminClient()

// ── PRODUCTS ──────────────────────────────────────────────────

export async function getProducts(params: {
  page?: number
  perPage?: number
  category?: MarketplaceCategory
  search?: string
  minPrice?: number
  maxPrice?: number
  isFree?: boolean
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular' | 'rating'
  tags?: string[]
  creatorId?: string
  userId?: string
}): Promise<PaginatedResponse<MarketplaceProduct>> {
  const {
    page = 1, perPage = 20, category, search,
    minPrice, maxPrice, isFree, sortBy = 'newest', tags, creatorId, userId
  } = params

  let query = db
    .from('marketplace_products')
    .select('*, creator:profiles!creator_id(id, display_name, avatar_url, username), store:creator_stores!store_id(id, store_name, slug, is_verified)', { count: 'exact' })
    .eq('status', 'published')

  if (category) query = query.eq('category', category)
  if (minPrice !== undefined) query = query.gte('price', minPrice)
  if (maxPrice !== undefined) query = query.lte('price', maxPrice)
  if (isFree !== undefined) query = isFree ? query.eq('price', 0) : query.gt('price', 0)
  if (creatorId) query = query.eq('creator_id', creatorId)
  if (tags && tags.length > 0) query = query.overlaps('tags', tags)

  if (search) {
    query = query.textSearch('title', search, { type: 'websearch', config: 'english' })
  }

  switch (sortBy) {
    case 'price_asc': query = query.order('price', { ascending: true }); break
    case 'price_desc': query = query.order('price', { ascending: false }); break
    case 'popular': query = query.order('purchase_count', { ascending: false }); break
    case 'rating': query = query.order('average_rating', { ascending: false }); break
    default: query = query.order('published_at', { ascending: false })
  }

  const from = (page - 1) * perPage
  const { data, count, error } = await query.range(from, from + perPage - 1)

  if (error) throw error

  // Enrich with user-specific data if userId provided
  let products = (data ?? []) as unknown as MarketplaceProduct[]
  if (userId) {
    const productIds = products.map(p => p.id)

    const [{ data: purchases }, { data: wishlists }] = await Promise.all([
      db.from('user_purchases').select('product_id').eq('user_id', userId).in('product_id', productIds),
      db.from('marketplace_wishlists').select('product_id').eq('user_id', userId).in('product_id', productIds),
    ])

    const purchasedIds = new Set(purchases?.map(p => p.product_id) ?? [])
    const wishlistedIds = new Set(wishlists?.map(w => w.product_id) ?? [])

    products = products.map(p => ({
      ...p,
      is_purchased: purchasedIds.has(p.id),
      is_wishlisted: wishlistedIds.has(p.id),
    }))
  }

  return {
    data: products,
    total: count ?? 0,
    page,
    per_page: perPage,
    total_pages: Math.ceil((count ?? 0) / perPage),
    has_next: from + perPage < (count ?? 0),
    has_prev: page > 1,
  }
}

export async function getProduct(slug: string, userId?: string) {
  const { data, error } = await db
    .from('marketplace_products')
    .select('*, creator:profiles!creator_id(*), store:creator_stores!store_id(*)')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (error || !data) return null

  // Increment view count
  await db.from('marketplace_products')
    .update({ view_count: data.view_count + 1 })
    .eq('id', data.id)

  let product = data as unknown as MarketplaceProduct

  if (userId) {
    const [{ data: purchase }, { data: wishlist }] = await Promise.all([
      db.from('user_purchases').select('id').eq('user_id', userId).eq('product_id', data.id).single(),
      db.from('marketplace_wishlists').select('id').eq('user_id', userId).eq('product_id', data.id).single(),
    ])

    product = {
      ...product,
      is_purchased: !!purchase,
      is_wishlisted: !!wishlist,
    }
  }

  return product
}

export async function createProduct(params: {
  creatorId: string
  data: Partial<MarketplaceProduct>
}) {
  const { creatorId, data } = params

  // Verify creator has a store (plus/elite plan required)
  const { data: store } = await db
    .from('creator_stores')
    .select('id, is_active')
    .eq('user_id', creatorId)
    .single()

  if (!store || !store.is_active) {
    throw new Error('Active creator store required to list products')
  }

  const slug = generateSlug(data.title ?? 'product')

  const { data: product, error } = await db
    .from('marketplace_products')
    .insert({
      creator_id: creatorId,
      store_id: store.id,
      title: data.title,
      slug,
      description: data.description,
      short_description: data.short_description,
      category: data.category,
      subcategory: data.subcategory,
      price: data.price ?? 0,
      compare_price: data.compare_price,
      currency: data.currency ?? 'USD',
      thumbnail_url: data.thumbnail_url,
      media_urls: data.media_urls ?? [],
      tags: data.tags ?? [],
      features: data.features ?? [],
      requirements: data.requirements ?? [],
      license_type: data.license_type ?? 'standard',
      is_digital: data.is_digital ?? true,
      metadata: data.metadata ?? {},
      status: 'draft',
    })
    .select()
    .single()

  if (error) throw error
  return product
}

export async function updateProduct(productId: string, creatorId: string, updates: Partial<MarketplaceProduct>) {
  const { data, error } = await db
    .from('marketplace_products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('creator_id', creatorId)
    .select()
    .single()

  if (error) throw error
  return data
}

// ── ORDERS & CHECKOUT ─────────────────────────────────────────

export async function createOrder(params: {
  buyerId: string
  productIds: string[]
  couponCode?: string
}) {
  const { buyerId, productIds, couponCode } = params

  // Fetch products
  const { data: products, error } = await db
    .from('marketplace_products')
    .select('*, creator_stores!store_id(stripe_account_id, commission_rate)')
    .in('id', productIds)
    .eq('status', 'published')

  if (error || !products?.length) throw new Error('Products not found')

  // Check not already purchased
  const { data: existing } = await db
    .from('user_purchases')
    .select('product_id')
    .eq('user_id', buyerId)
    .in('product_id', productIds)

  const alreadyPurchased = existing?.map(p => p.product_id) ?? []
  if (alreadyPurchased.length > 0) {
    throw new Error(`Already purchased: ${alreadyPurchased.join(', ')}`)
  }

  // Apply coupon
  let discountPct = 0
  if (couponCode) {
    const { validateCoupon } = await import('./subscription.service')
    const validation = await validateCoupon(couponCode)
    if (validation.valid && validation.coupon?.type === 'percentage') {
      discountPct = validation.coupon.discount_value / 100
    }
  }

  const subtotal = products.reduce((sum, p) => sum + p.price, 0)
  const discount = subtotal * discountPct
  const platformFee = (subtotal - discount) * 0.1  // 10% platform fee
  const total = subtotal - discount

  // Get buyer stripe customer
  const { data: profile } = await db.from('profiles').select('email, full_name').eq('id', buyerId).single()
  if (!profile) throw new Error('Buyer profile not found')

  const { getOrCreateStripeCustomer } = await import('@/lib/stripe/client')
  const { data: sub } = await db.from('subscriptions').select('stripe_customer_id').eq('user_id', buyerId).single()
  const customerId = sub?.stripe_customer_id ?? await getOrCreateStripeCustomer(buyerId, profile.email)

  // Create order
  const { data: order, error: orderError } = await db
    .from('marketplace_orders')
    .insert({
      buyer_id: buyerId,
      status: 'pending',
      subtotal,
      discount,
      platform_fee: platformFee,
      total,
      currency: 'USD',
      coupon_code: couponCode ?? null,
    })
    .select()
    .single()

  if (orderError) throw orderError

  // Create order items
  const orderItems = products.map(p => {
    const storeData = p.creator_stores as { commission_rate?: number } | null
    const commissionRate = storeData?.commission_rate ?? 0.15
    const itemTotal = p.price * (1 - discountPct)
    return {
      order_id: order.id,
      product_id: p.id,
      creator_id: p.creator_id,
      store_id: p.store_id,
      title: p.title,
      price: p.price,
      quantity: 1,
      subtotal: itemTotal,
      commission_rate: commissionRate,
      commission_amount: itemTotal * commissionRate,
      creator_revenue: itemTotal * (1 - commissionRate),
    }
  })

  await db.from('marketplace_order_items').insert(orderItems)

  // Create payment intent (if total > 0)
  let paymentIntentId: string | null = null
  if (total > 0) {
    const pi = await createMarketplacePaymentIntent({
      amount: total,
      currency: 'usd',
      customerId,
      orderId: order.id,
    })
    paymentIntentId = pi.id

    await db.from('marketplace_orders')
      .update({ stripe_payment_intent_id: paymentIntentId })
      .eq('id', order.id)
  }

  return {
    order,
    client_secret: paymentIntentId ? (await import('@/lib/stripe/client')).stripe.paymentIntents.retrieve(paymentIntentId).then(pi => pi.client_secret) : null,
    total,
    is_free: total === 0,
  }
}

export async function fulfillOrder(orderId: string, paymentIntentId?: string) {
  const { data: order } = await db
    .from('marketplace_orders')
    .select('*, marketplace_order_items(*)')
    .eq('id', orderId)
    .single()

  if (!order) throw new Error('Order not found')

  // Update order status
  await db.from('marketplace_orders').update({
    status: 'completed',
    stripe_payment_intent_id: paymentIntentId ?? order.stripe_payment_intent_id,
    completed_at: new Date().toISOString(),
  }).eq('id', orderId)

  // Grant access to products
  const items = (order.marketplace_order_items ?? []) as Array<{
    product_id: string; creator_id: string; creator_revenue: number; id: string
  }>

  for (const item of items) {
    await db.from('user_purchases').upsert({
      user_id: order.buyer_id,
      product_id: item.product_id,
      order_item_id: item.id,
    }, { onConflict: 'user_id,product_id' })

    await db.from('marketplace_order_items').update({
      access_granted_at: new Date().toISOString(),
    }).eq('id', item.id)

    // Update purchase count
    await db.from('marketplace_products')
      .update({ purchase_count: db.rpc('increment', { x: 1 }) as unknown as number })
      .eq('id', item.product_id)
  }

  // Update creator store totals
  const creatorRevenues = items.reduce((acc, item) => {
    acc[item.creator_id] = (acc[item.creator_id] ?? 0) + item.creator_revenue
    return acc
  }, {} as Record<string, number>)

  for (const [creatorId, revenue] of Object.entries(creatorRevenues)) {
    await db.from('creator_stores')
      .update({
        total_sales: db.rpc('increment', { x: 1 }) as unknown as number,
        total_revenue: db.rpc('increment', { x: revenue }) as unknown as number,
      })
      .eq('user_id', creatorId)
  }

  // Send receipt email
  const { data: profile } = await db.from('profiles').select('email, display_name').eq('id', order.buyer_id).single()
  if (profile) {
    await sendEmail({
      to: profile.email,
      subject: 'Your Finora Purchase Confirmation',
      template: 'order_receipt',
      data: { name: profile.display_name, order_id: order.order_number, total: order.total },
    })
  }

  return order
}

// ── WISHLISTS ─────────────────────────────────────────────────

export async function toggleWishlist(userId: string, productId: string) {
  const { data: existing } = await db
    .from('marketplace_wishlists')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .single()

  if (existing) {
    await db.from('marketplace_wishlists').delete().eq('id', existing.id)
    await db.from('marketplace_products').update({ wishlist_count: db.rpc('decrement', { x: 1 }) as unknown as number }).eq('id', productId)
    return { wishlisted: false }
  } else {
    await db.from('marketplace_wishlists').insert({ user_id: userId, product_id: productId })
    await db.from('marketplace_products').update({ wishlist_count: db.rpc('increment', { x: 1 }) as unknown as number }).eq('id', productId)
    return { wishlisted: true }
  }
}

// ── REVIEWS ───────────────────────────────────────────────────

export async function createReview(params: {
  userId: string
  productId: string
  rating: number
  title?: string
  content?: string
}) {
  const { userId, productId, rating, title, content } = params

  // Verify purchase
  const { data: purchase } = await db
    .from('user_purchases')
    .select('id, order_item_id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .single()

  const { data: review, error } = await db
    .from('product_reviews')
    .upsert({
      product_id: productId,
      user_id: userId,
      order_item_id: purchase?.order_item_id ?? null,
      rating,
      title: title ?? null,
      content: content ?? null,
      is_verified_purchase: !!purchase,
    }, { onConflict: 'product_id,user_id' })
    .select()
    .single()

  if (error) throw error

  // Recalculate average rating
  const { data: ratings } = await db
    .from('product_reviews')
    .select('rating')
    .eq('product_id', productId)
    .eq('is_published', true)

  if (ratings) {
    const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
    await db.from('marketplace_products').update({
      average_rating: Math.round(avg * 10) / 10,
      rating_count: ratings.length,
    }).eq('id', productId)
  }

  return review
}

export async function getProductReviews(productId: string, page = 1, perPage = 10) {
  const from = (page - 1) * perPage

  const { data, count } = await db
    .from('product_reviews')
    .select('*, author:profiles!user_id(display_name, avatar_url, username)', { count: 'exact' })
    .eq('product_id', productId)
    .eq('is_published', true)
    .order('helpful_count', { ascending: false })
    .range(from, from + perPage - 1)

  return {
    data: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
  }
}

// ── CREATOR STORES ────────────────────────────────────────────

export async function createCreatorStore(userId: string, params: {
  store_name: string
  description?: string
  tagline?: string
}) {
  const slug = generateSlug(params.store_name)

  // Create Stripe Connect account
  const { data: profile } = await db.from('profiles').select('email').eq('id', userId).single()
  if (!profile) throw new Error('Profile not found')

  const account = await createConnectedAccount(profile.email)

  const { data: store, error } = await db
    .from('creator_stores')
    .insert({
      user_id: userId,
      store_name: params.store_name,
      slug,
      description: params.description ?? null,
      tagline: params.tagline ?? null,
      stripe_account_id: account.id,
      stripe_account_status: 'pending',
      is_active: false,
    })
    .select()
    .single()

  if (error) throw error

  // Update profile
  await db.from('profiles').update({ is_creator: true }).eq('id', userId)

  return store
}

export async function getCreatorOnboardingLink(userId: string) {
  const { data: store } = await db
    .from('creator_stores')
    .select('stripe_account_id')
    .eq('user_id', userId)
    .single()

  if (!store?.stripe_account_id) throw new Error('No Stripe account found')

  const link = await createAccountOnboardingLink(
    store.stripe_account_id,
    `${process.env.NEXT_PUBLIC_APP_URL}/creator/onboarding`,
    `${process.env.NEXT_PUBLIC_APP_URL}/creator/dashboard`
  )

  return link.url
}

export async function getCreatorDashboard(userId: string) {
  const { data: store } = await db
    .from('creator_stores')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!store) throw new Error('Creator store not found')

  const [{ data: products }, { data: orders }, { data: payouts }, { data: analytics }] = await Promise.all([
    db.from('marketplace_products').select('id, title, purchase_count, view_count, average_rating, price, status').eq('creator_id', userId).order('created_at', { ascending: false }),
    db.from('marketplace_order_items').select('*').eq('creator_id', userId).order('created_at', { ascending: false }).limit(10),
    db.from('creator_payouts').select('*').eq('creator_id', userId).order('created_at', { ascending: false }).limit(5),
    db.from('marketplace_analytics').select('*').eq('creator_id', userId).order('date', { ascending: false }).limit(30),
  ])

  const totalRevenue = (orders ?? []).reduce((sum, o) => sum + o.creator_revenue, 0)
  const pendingPayout = (payouts ?? [])
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0)

  return {
    store,
    products: products ?? [],
    recent_orders: orders ?? [],
    payouts: payouts ?? [],
    analytics: analytics ?? [],
    metrics: {
      total_revenue: totalRevenue,
      pending_payout: pendingPayout,
      total_sales: store.total_sales,
      average_rating: store.average_rating,
      total_products: (products ?? []).length,
      published_products: (products ?? []).filter(p => p.status === 'published').length,
    },
  }
}

// ── PAYOUTS ───────────────────────────────────────────────────

export async function processCreatorPayout(creatorId: string) {
  const { data: store } = await db
    .from('creator_stores')
    .select('stripe_account_id, commission_rate')
    .eq('user_id', creatorId)
    .single()

  if (!store?.stripe_account_id) throw new Error('No connected Stripe account')

  // Calculate pending revenue (last month completed orders)
  const lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  const periodStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1)
  const periodEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0)

  const { data: items } = await db
    .from('marketplace_order_items')
    .select('creator_revenue')
    .eq('creator_id', creatorId)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())

  if (!items?.length) return null

  const totalRevenue = items.reduce((sum, i) => sum + i.creator_revenue, 0)
  if (totalRevenue < 10) return null // Minimum payout threshold

  // Create Stripe transfer
  const transfer = await createCreatorTransfer({
    amount: totalRevenue,
    currency: 'usd',
    destinationAccountId: store.stripe_account_id,
    description: `Finora creator payout for ${periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    metadata: { creator_id: creatorId },
  })

  // Record payout
  const { data: payout } = await db.from('creator_payouts').insert({
    creator_id: creatorId,
    amount: totalRevenue,
    currency: 'USD',
    status: 'paid',
    stripe_transfer_id: transfer.id,
    period_start: periodStart.toISOString().split('T')[0],
    period_end: periodEnd.toISOString().split('T')[0],
    order_count: items.length,
    paid_at: new Date().toISOString(),
  }).select().single()

  return payout
}

// ── ADMIN MODERATION ──────────────────────────────────────────

export async function adminUpdateProductStatus(
  productId: string,
  status: ProductStatus,
  adminId: string,
  reason?: string
) {
  const { data: product } = await db
    .from('marketplace_products')
    .update({
      status,
      published_at: status === 'published' ? new Date().toISOString() : undefined,
      metadata: reason ? { rejection_reason: reason } : undefined,
    })
    .eq('id', productId)
    .select()
    .single()

  if (product) {
    await db.from('notifications').insert({
      user_id: product.creator_id,
      type: 'marketplace',
      channel: 'in_app',
      title: `Product ${status === 'published' ? 'Approved' : 'Status Updated'}`,
      body: status === 'published'
        ? `Your product "${product.title}" is now live on the marketplace!`
        : `Your product "${product.title}" status changed to ${status}. ${reason ? `Reason: ${reason}` : ''}`,
      action_url: `/marketplace/products/${product.slug}`,
    })
  }

  return product
}

// ── HELPERS ───────────────────────────────────────────────────

function generateSlug(title: string): string {
  const base = title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base}-${suffix}`
}
