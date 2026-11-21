import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, createAuditLog } from '@/lib/security/rbac'
import { z } from 'zod'

const updateSchema = z.object({
  title: z.string().max(300).optional(),
  content: z.string().min(1).optional(),
  status: z.enum(['draft', 'published', 'flagged', 'removed']).optional(),
  is_pinned: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
})

function getIdFromPath(req: Request) {
  const segments = new URL(req.url).pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

export const PATCH = withAdmin(async (req, { userId }) => {
  const id = getIdFromPath(req)
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed: ' + parsed.error.issues.map(i => i.message).join(', '), 400)

  const db = createAdminClient()
  const { data, error } = await db
    .from('posts')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  await createAuditLog({ adminId: userId, action: 'community_post.update', resourceType: 'post', resourceId: id, metadata: { changed_fields: Object.keys(parsed.data) } })

  return apiSuccess(data)
})

export const DELETE = withAdmin(async (req, { userId }) => {
  const id = getIdFromPath(req)
  const db = createAdminClient()
  const { error } = await db.from('posts').delete().eq('id', id)
  if (error) return apiError(error.message, 500)

  await createAuditLog({ adminId: userId, action: 'community_post.delete', resourceType: 'post', resourceId: id })

  return apiSuccess({ deleted: true })
})
