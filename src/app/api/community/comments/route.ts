import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { z } from 'zod'

const commentSchema = z.object({
  post_id: z.string().uuid(),
  content: z.string().min(1).max(2000),
  parent_id: z.string().uuid().optional(),
})

export const GET = withAuth(async (req) => {
  const url = new URL(req.url)
  const postId = url.searchParams.get('post_id')
  if (!postId) return apiError('post_id required', 400)
  const { page, perPage, from, to } = getPagination(req)
  const db = createAdminClient()

  const { data, count, error } = await db
    .from('post_comments')
    .select(`
      *,
      author:profiles!user_id(id, display_name, username, avatar_url, is_verified)
    `, { count: 'exact' })
    .eq('post_id', postId)
    .eq('is_removed', false)
    .is('parent_id', null)
    .order('created_at', { ascending: true })
    .range(from, to)

  if (error) return apiError(error.message, 500)

  // Fetch replies for each top-level comment
  const commentIds = (data ?? []).map(c => c.id)
  const { data: replies } = await db
    .from('post_comments')
    .select(`*, author:profiles!user_id(id, display_name, username, avatar_url)`)
    .in('parent_id', commentIds)
    .eq('is_removed', false)
    .order('created_at', { ascending: true })

  const replyMap = (replies ?? []).reduce((acc, r) => {
    if (!acc[r.parent_id]) acc[r.parent_id] = []
    acc[r.parent_id].push(r)
    return acc
  }, {} as Record<string, typeof replies>)

  const enriched = (data ?? []).map(c => ({ ...c, replies: replyMap[c.id] ?? [] }))
  return apiSuccess({ comments: enriched, total: count ?? 0, page, per_page: perPage })
})

export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = commentSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()
  const { data, error } = await db
    .from('post_comments')
    .insert({ user_id: userId, ...parsed.data })
    .select(`*, author:profiles!user_id(id, display_name, username, avatar_url)`)
    .single()

  if (error) return apiError(error.message, 500)

  // Increment post comment count
  await db.from('posts').update({ comment_count: db.rpc('increment', { x: 1 }) as unknown as number }).eq('id', parsed.data.post_id)

  // Notify post author
  const { data: post } = await db.from('posts').select('user_id').eq('id', parsed.data.post_id).single()
  if (post && post.user_id !== userId) {
    const { data: commenter } = await db.from('profiles').select('display_name').eq('id', userId).single()
    await db.from('notifications').insert({
      user_id: post.user_id, type: 'community', channel: 'in_app',
      title: 'New Comment',
      body: `${commenter?.display_name ?? 'Someone'} commented on your post`,
      action_url: `/community/posts/${parsed.data.post_id}`,
    })
  }

  // Award reputation
  try {
    await db.from('reputation_points').insert({ user_id: userId, action: 'comment_created', points: 2, source_type: 'comment', source_id: data.id })
  } catch { /* non-critical */ }

  return apiSuccess(data, 201)
})

export const DELETE = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return apiError('Comment ID required', 400)
  const db = createAdminClient()
  await db.from('post_comments').update({ is_removed: true }).eq('id', id).eq('user_id', userId)
  return apiSuccess({ deleted: true })
})
