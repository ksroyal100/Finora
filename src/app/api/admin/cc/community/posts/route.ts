import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, createAuditLog } from '@/lib/security/rbac'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().max(300).optional(),
  content: z.string().min(1),
  type: z.enum(['text', 'image', 'video', 'link', 'poll']).default('text'),
  media_urls: z.array(z.string().url()).default([]),
  link_url: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  is_pinned: z.boolean().default(false),
  is_featured: z.boolean().default(false),
})

// GET /api/admin/cc/community/posts — list ALL posts regardless of status,
// so admins can see everything (not just flagged content), search, and
// manage the feed directly.
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') ?? '1', 10)
  const search = url.searchParams.get('search')
  const perPage = 30
  const db = createAdminClient()

  let query = db
    .from('posts')
    .select('id, user_id, title, content, type, status, is_pinned, is_featured, is_official, like_count, comment_count, view_count, tags, created_at', { count: 'exact' })
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  if (search) query = query.textSearch('content', search)

  const { data, error, count } = await query
  if (error) return apiError(error.message, 500)
  return apiSuccess({ posts: data ?? [], total: count ?? 0, page, per_page: perPage })
})

// POST /api/admin/cc/community/posts — create an official/admin post,
// pushed directly into the community feed (e.g. announcements, curated
// content) rather than waiting on user submissions.
export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed: ' + parsed.error.issues.map(i => i.message).join(', '), 400)

  const db = createAdminClient()
  const { data, error } = await db
    .from('posts')
    .insert({
      ...parsed.data,
      user_id: userId, // posted as the admin's own account — shows as an official post from a real, identifiable team member
      status: 'published',
      is_official: true,
    })
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  await createAuditLog({ adminId: userId, action: 'community_post.create', resourceType: 'post', resourceId: data.id })

  return apiSuccess(data, 201)
})
