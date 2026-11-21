import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, createAuditLog } from '@/lib/security/rbac'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(300).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  summary: z.string().max(2000).optional().default(''),
  content: z.string().optional().default(''),
  report_type: z.enum(['market', 'stock', 'etf', 'real_estate', 'ai', 'software', 'startup', 'macro']).default('market'),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).default([]),
  thumbnail_url: z.string().url().optional().or(z.literal('')),
  required_plan: z.enum(['free', 'pro', 'plus', 'elite']).default('pro'),
})

// GET /api/admin/cc/research — list all reports (published + drafts)
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') ?? '1', 10)
  const perPage = 30
  const db = createAdminClient()

  const { data, error, count } = await db
    .from('research_reports')
    .select('id, title, slug, summary, report_type, category, tags, is_published, is_featured, view_count, save_count, published_at, created_at, author_id', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ reports: data ?? [], total: count ?? 0, page, per_page: perPage })
})

// POST /api/admin/cc/research — create a new report (draft by default)
export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed: ' + parsed.error.issues.map(i => i.message).join(', '), 400)

  const db = createAdminClient()
  const { data, error } = await db
    .from('research_reports')
    .insert({
      ...parsed.data,
      thumbnail_url: parsed.data.thumbnail_url || null,
      author_id: userId,
      is_published: false,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return apiError('A report with this slug already exists', 409)
    return apiError(error.message, 500)
  }

  await createAuditLog({ adminId: userId, action: 'research.create', resourceType: 'research_report', resourceId: data.id })

  return apiSuccess(data, 201)
})
