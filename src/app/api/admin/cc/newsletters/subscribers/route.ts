import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, createAuditLog } from '@/lib/security/rbac'
import { z } from 'zod'

// GET /api/admin/cc/newsletters/subscribers — list anonymous (landing-page)
// subscribers, with optional search. Registered opted-in users are visible
// via the Users admin page (they're profiles with a preference flag, not
// a separate subscriber record) — this covers the ones with no account.
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') ?? '1', 10)
  const search = url.searchParams.get('search')
  const perPage = 50
  const db = createAdminClient()

  let query = db
    .from('newsletter_subscribers')
    .select('*', { count: 'exact' })
    .order('subscribed_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  if (search) query = query.ilike('email', `%${search}%`)

  const { data, error, count } = await query
  if (error) return apiError(error.message, 500)
  return apiSuccess({ subscribers: data ?? [], total: count ?? 0, page, per_page: perPage })
})

// POST /api/admin/cc/newsletters/subscribers — manually add a subscriber
export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const parsed = z.object({ email: z.string().email() }).safeParse(body)
  if (!parsed.success) return apiError('Please provide a valid email address', 400)

  const db = createAdminClient()
  const { data, error } = await db
    .from('newsletter_subscribers')
    .upsert(
      { email: parsed.data.email.toLowerCase().trim(), status: 'subscribed', source: 'admin_added', subscribed_at: new Date().toISOString(), unsubscribed_at: null },
      { onConflict: 'email' },
    )
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  await createAuditLog({ adminId: userId, action: 'newsletter_subscriber.add', resourceType: 'newsletter_subscriber', resourceId: data.id })

  return apiSuccess(data, 201)
})

// DELETE /api/admin/cc/newsletters/subscribers?id=... — remove a subscriber
export const DELETE = withAdmin(async (req, { userId }) => {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return apiError('Missing ?id= query param', 400)

  const db = createAdminClient()
  const { error } = await db.from('newsletter_subscribers').delete().eq('id', id)
  if (error) return apiError(error.message, 500)

  await createAuditLog({ adminId: userId, action: 'newsletter_subscriber.remove', resourceType: 'newsletter_subscriber', resourceId: id })

  return apiSuccess({ deleted: true })
})
