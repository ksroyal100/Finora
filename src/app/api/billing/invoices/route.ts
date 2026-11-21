import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'

// GET /api/billing/invoices
export const GET = withAuth(async (req, { userId }) => {
  const { page, perPage, from, to } = getPagination(req)
  const db = createAdminClient()

  const { data, count, error } = await db
    .from('invoices')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ invoices: data ?? [], total: count ?? 0, page, per_page: perPage })
})
