import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, createAuditLog } from '@/lib/security/rbac'
import { z } from 'zod'

const blockSchema = z.object({
  type: z.enum(['paragraph', 'heading', 'cta', 'divider', 'highlight']),
  text: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaUrl: z.string().optional(),
})

const updateSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  preheader: z.string().max(200).optional(),
  from_name: z.string().min(1).max(100).optional(),
  content: z.object({
    headline: z.string().min(1),
    intro: z.string().optional().default(''),
    blocks: z.array(blockSchema).default([]),
  }).optional(),
})

export const GET = withAdmin(async (req) => {
  const id = req.nextUrl.pathname.split('/').filter(Boolean).pop()
  const db = createAdminClient()
  const { data, error } = await db.from('newsletters').select('*').eq('id', id).single()
  if (error || !data) return apiError('Newsletter not found', 404)

  let sample_error: string | null = null
  if (data.failed_count > 0) {
    const { data: failedRow } = await db
      .from('newsletter_recipients')
      .select('error')
      .eq('newsletter_id', id)
      .eq('status', 'failed')
      .limit(1)
      .single()
    sample_error = failedRow?.error ?? null
  }

  return apiSuccess({ ...data, sample_error })
})

export const PATCH = withAdmin(async (req, { userId }) => {
  const id = req.nextUrl.pathname.split('/').filter(Boolean).pop()
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed: ' + parsed.error.issues.map(i => i.message).join(', '), 400)

  const db = createAdminClient()
  const { data: existing } = await db.from('newsletters').select('status').eq('id', id).single()
  if (!existing) return apiError('Newsletter not found', 404)
  if (existing.status !== 'draft' && existing.status !== 'failed') return apiError('Only draft or failed campaigns can be edited', 409)

  const { data, error } = await db
    .from('newsletters')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  await createAuditLog({ adminId: userId, action: 'newsletter.update', resourceType: 'newsletter', resourceId: id })

  return apiSuccess(data)
})

export const DELETE = withAdmin(async (req, { userId }) => {
  const id = req.nextUrl.pathname.split('/').filter(Boolean).pop()
  const db = createAdminClient()
  const { data: existing } = await db.from('newsletters').select('status').eq('id', id).single()
  if (!existing) return apiError('Newsletter not found', 404)
  if (existing.status === 'sending') return apiError('Cannot delete a campaign that is currently sending', 409)

  const { error } = await db.from('newsletters').delete().eq('id', id)
  if (error) return apiError(error.message, 500)

  await createAuditLog({ adminId: userId, action: 'newsletter.delete', resourceType: 'newsletter', resourceId: id })

  return apiSuccess({ deleted: true })
})
