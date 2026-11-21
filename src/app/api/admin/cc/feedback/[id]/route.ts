import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, createAuditLog } from '@/lib/security/rbac'
import { z } from 'zod'

const schema = z.object({ status: z.enum(['new', 'reviewed', 'archived']) })

export const PATCH = withAdmin(async (req, { userId }) => {
  const id = req.nextUrl.pathname.split('/').filter(Boolean).pop()
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Invalid status', 400)

  const db = createAdminClient()
  const { data, error } = await db.from('user_feedback').update({ status: parsed.data.status }).eq('id', id).select().single()
  if (error) return apiError(error.message, 500)

  await createAuditLog({ adminId: userId, action: 'feedback.status_update', resourceType: 'user_feedback', resourceId: id as string, metadata: { status: parsed.data.status } })

  return apiSuccess(data)
})
