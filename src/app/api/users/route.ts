import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, withAdmin, apiSuccess, apiError, apiPaginated, getPagination, sanitizeFilterInput } from '@/lib/security/rbac'

// GET /api/users — admin user list
export const GET = withAdmin(async (req, { userId, isFounder }) => {
  const db = createAdminClient()
  const { page, perPage, from, to } = getPagination(req)
  const url = new URL(req.url)
  const search = url.searchParams.get('search') ?? ''
  const plan = url.searchParams.get('plan') ?? ''
  const role = url.searchParams.get('role') ?? ''
  const banned = url.searchParams.get('banned')

  let query = db
    .from('profiles')
    .select(
      `id, email, display_name, username, avatar_url, role, is_banned, created_at,
       subscriptions(plan, status)`,
      { count: 'exact' }
    )

  if (search) {
    query = query.or(`email.ilike.%${sanitizeFilterInput(search)}%,display_name.ilike.%${sanitizeFilterInput(search)}%,username.ilike.%${sanitizeFilterInput(search)}%`)
  }
  if (role) query = query.eq('role', role)
  if (banned === 'true') query = query.eq('is_banned', true)
  if (banned === 'false') query = query.eq('is_banned', false)
  if (plan) {
    query = query.eq('subscriptions.plan', plan)
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return apiError(error.message, 500)
  return apiPaginated(data ?? [], count ?? 0, page, perPage)
})
