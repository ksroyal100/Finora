import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, createAuditLog } from '@/lib/security/rbac'
import { z } from 'zod'

const blockSchema = z.object({
  type: z.enum(['paragraph', 'heading', 'cta', 'divider', 'highlight']),
  text: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaUrl: z.string().optional(),
})

const createSchema = z.object({
  subject: z.string().min(1).max(200),
  preheader: z.string().max(200).optional().default(''),
  from_name: z.string().min(1).max(100).optional().default('Finora'),
  content: z.object({
    headline: z.string().min(1),
    intro: z.string().optional().default(''),
    blocks: z.array(blockSchema).default([]),
  }),
})

// GET /api/admin/cc/newsletters — list campaigns + current subscriber count
export const GET = withAdmin(async () => {
  const db = createAdminClient()

  const [{ data: newsletters, error }, { count: optedInUsers }, { count: anonSubscribers }] = await Promise.all([
    db.from('newsletters').select('*').order('created_at', { ascending: false }).limit(100),
    db
      .from('notification_preferences')
      .select('*', { count: 'exact', head: true })
      .eq('marketing_emails', true),
    db
      .from('newsletter_subscribers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'subscribed'),
  ])

  if (error) return apiError(error.message, 500)
  // Note: this is a simple sum, not deduplicated by email against opted-in
  // users (that dedup happens at actual send time). Treat this count as an
  // upper bound on recipients, not an exact figure.
  return apiSuccess({ newsletters: newsletters ?? [], subscriber_count: (optedInUsers ?? 0) + (anonSubscribers ?? 0) })
})

// POST /api/admin/cc/newsletters — create a new draft
export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed: ' + parsed.error.issues.map(i => i.message).join(', '), 400)

  const db = createAdminClient()
  const { data, error } = await db
    .from('newsletters')
    .insert({
      subject: parsed.data.subject,
      preheader: parsed.data.preheader,
      from_name: parsed.data.from_name,
      content: parsed.data.content,
      status: 'draft',
      created_by: userId,
    })
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  await createAuditLog({ adminId: userId, action: 'newsletter.create', resourceType: 'newsletter', resourceId: data.id })

  return apiSuccess(data, 201)
})
