import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, createAuditLog } from '@/lib/security/rbac'
import { z } from 'zod'

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  summary: z.string().max(2000).optional(),
  content: z.string().optional(),
  report_type: z.enum(['market', 'stock', 'etf', 'real_estate', 'ai', 'software', 'startup', 'macro']).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  thumbnail_url: z.string().url().optional().or(z.literal('')),
  pdf_url: z.string().url().optional().or(z.literal('')),
  required_plan: z.enum(['free', 'pro', 'plus', 'elite']).optional(),
  is_published: z.boolean().optional(),
  is_featured: z.boolean().optional(),
})

function getIdFromPath(req: Request) {
  const segments = new URL(req.url).pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

export const GET = withAdmin(async (req) => {
  const id = getIdFromPath(req)
  const db = createAdminClient()
  const { data, error } = await db.from('research_reports').select('*').eq('id', id).single()
  if (error || !data) return apiError('Report not found', 404)
  return apiSuccess(data)
})

export const PATCH = withAdmin(async (req, { userId }) => {
  const id = getIdFromPath(req)
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed: ' + parsed.error.issues.map(i => i.message).join(', '), 400)

  const db = createAdminClient()
  const { data: existing } = await db.from('research_reports').select('is_published').eq('id', id).single()
  if (!existing) return apiError('Report not found', 404)

  const updates: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() }
  if (parsed.data.thumbnail_url === '') updates.thumbnail_url = null
  if (parsed.data.pdf_url === '') updates.pdf_url = null

  // First time being published — stamp published_at
  if (parsed.data.is_published === true && !existing.is_published) {
    updates.published_at = new Date().toISOString()
  }

  const { data, error } = await db.from('research_reports').update(updates).eq('id', id).select().single()
  if (error) return apiError(error.message, 500)

  await createAuditLog({
    adminId: userId,
    action: parsed.data.is_published !== undefined ? (parsed.data.is_published ? 'research.publish' : 'research.unpublish') : 'research.update',
    resourceType: 'research_report',
    resourceId: id,
  })

  return apiSuccess(data)
})

export const DELETE = withAdmin(async (req, { userId }) => {
  const id = getIdFromPath(req)
  const db = createAdminClient()
  const { error } = await db.from('research_reports').delete().eq('id', id)
  if (error) return apiError(error.message, 500)

  await createAuditLog({ adminId: userId, action: 'research.delete', resourceType: 'research_report', resourceId: id })

  return apiSuccess({ deleted: true })
})
