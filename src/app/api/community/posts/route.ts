import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { z } from 'zod'

const postSchema = z.object({
  content: z.string().min(1).max(5000),
  title: z.string().max(300).optional(),
  type: z.enum(['text', 'image', 'video', 'link', 'poll']).default('text'),
  group_id: z.string().uuid().optional(),
  media_urls: z.array(z.string().url()).max(10).default([]),
  link_url: z.string().url().optional(),
  tags: z.array(z.string().max(50)).max(10).default([]),
})

// GET /api/community/posts — feed or group posts
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const groupId = url.searchParams.get('group_id')
  const feedType = url.searchParams.get('feed') ?? 'discover'   // discover | following | trending
  const db = createAdminClient()

  let query = db
    .from('posts')
    .select(`
      *,
      author:profiles!user_id(id, display_name, username, avatar_url, is_verified),
      group:community_groups!group_id(id, name, slug, avatar_url)
    `, { count: 'exact' })
    .eq('status', 'published')

  if (groupId) {
    query = query.eq('group_id', groupId)
  } else if (feedType === 'following') {
    const { data: follows } = await db
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId)
    const followIds = follows?.map(f => f.following_id) ?? []
    if (followIds.length > 0) query = query.in('user_id', followIds)
    else return apiSuccess({ posts: [], total: 0 })
  } else if (feedType === 'trending') {
    query = query.order('like_count', { ascending: false }).order('comment_count', { ascending: false })
  }

  if (feedType !== 'trending') {
    query = query.order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
  }

  const { data, count, error } = await query.range(from, to)
  if (error) return apiError(error.message, 500)

  const posts = data ?? []
  const postIds = posts.map(p => p.id)

  // Batch-check likes and bookmarks for the current user
  const [{ data: likes }, { data: bookmarks }] = await Promise.all([
    db.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds),
    db.from('post_bookmarks').select('post_id').eq('user_id', userId).in('post_id', postIds),
  ])

  const likedIds = new Set(likes?.map(l => l.post_id))
  const bookmarkedIds = new Set(bookmarks?.map(b => b.post_id))

  const enriched = posts.map(p => ({
    ...p,
    is_liked: likedIds.has(p.id),
    is_bookmarked: bookmarkedIds.has(p.id),
    is_own: p.user_id === userId,
  }))

  return apiSuccess({ posts: enriched, total: count ?? 0, page, per_page: perPage })
})

// POST /api/community/posts
export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()

  // Verify group membership if posting to a group
  if (parsed.data.group_id) {
    const { data: member } = await db
      .from('group_members')
      .select('id')
      .eq('group_id', parsed.data.group_id)
      .eq('user_id', userId)
      .single()
    if (!member) return apiError('You must be a group member to post', 403)
  }

  const { data, error } = await db
    .from('posts')
    .insert({ user_id: userId, status: 'published', ...parsed.data })
    .select(`*, author:profiles!user_id(id, display_name, username, avatar_url)`)
    .single()

  if (error) return apiError(error.message, 500)

  // Update group post count
  if (parsed.data.group_id) {
    try {
      await db.rpc('increment_group_posts', { group_id: parsed.data.group_id })
    } catch { /* non-critical */ }
  }

  // Award reputation points for posting
  try {
    await db.from('reputation_points').insert({
      user_id: userId, action: 'post_created', points: 5,
      source_type: 'post', source_id: data.id,
    })
  } catch { /* non-critical */ }

  return apiSuccess(data, 201)
})

// PATCH /api/community/posts — edit post
export const PATCH = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const { id, content, title, tags, media_urls } = body
  if (!id) return apiError('Post ID required', 400)

  const db = createAdminClient()
  const { data, error } = await db
    .from('posts')
    .update({ content, title, tags, media_urls, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  if (!data) return apiError('Post not found or unauthorized', 404)
  return apiSuccess(data)
})

// DELETE /api/community/posts?id=xxx
export const DELETE = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return apiError('Post ID required', 400)

  const db = createAdminClient()
  const { error } = await db
    .from('posts')
    .update({ status: 'removed' })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ deleted: true })
})
