import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, getPagination, createAuditLog } from '@/lib/security/rbac'

// GET /api/admin/cc/community — community overview and moderation queue
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const section = url.searchParams.get('section') ?? 'overview'
  const db = createAdminClient()

  if (section === 'flagged_posts') {
    const { data, count, error } = await db
      .from('posts')
      .select('*, author:profiles!user_id(email, display_name)', { count: 'exact' })
      .eq('status', 'flagged')
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) return apiError(error.message, 500)
    return apiSuccess({ posts: data ?? [], total: count ?? 0, page, per_page: perPage })
  }

  if (section === 'flagged_comments') {
    const { data, count, error } = await db
      .from('post_comments')
      .select('*, author:profiles!user_id(email, display_name)', { count: 'exact' })
      .eq('is_flagged', true)
      .eq('is_removed', false)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) return apiError(error.message, 500)
    return apiSuccess({ comments: data ?? [], total: count ?? 0, page, per_page: perPage })
  }

  if (section === 'groups') {
    const { data, count, error } = await db
      .from('community_groups')
      .select('*, creator:profiles!creator_id(email, display_name)', { count: 'exact' })
      .order('member_count', { ascending: false })
      .range(from, to)
    if (error) return apiError(error.message, 500)
    return apiSuccess({ groups: data ?? [], total: count ?? 0, page, per_page: perPage })
  }

  // Overview stats
  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const [
    { count: totalPosts },
    { count: postsToday },
    { count: flaggedPosts },
    { count: totalGroups },
    { count: totalEvents },
    { count: totalComments },
    { data: topGroups },
    { data: recentPosts },
  ] = await Promise.all([
    db.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    db.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', last24h.toISOString()),
    db.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'flagged'),
    db.from('community_groups').select('*', { count: 'exact', head: true }),
    db.from('events').select('*', { count: 'exact', head: true }).eq('status', 'upcoming'),
    db.from('post_comments').select('*', { count: 'exact', head: true }).eq('is_removed', false),
    db.from('community_groups').select('name, member_count, post_count, is_verified').order('member_count', { ascending: false }).limit(5),
    db.from('posts').select('id, content, status, like_count, created_at, user_id').order('created_at', { ascending: false }).limit(10),
  ])

  return apiSuccess({
    stats: {
      total_posts: totalPosts ?? 0,
      posts_today: postsToday ?? 0,
      flagged_posts: flaggedPosts ?? 0,
      total_groups: totalGroups ?? 0,
      upcoming_events: totalEvents ?? 0,
      total_comments: totalComments ?? 0,
    },
    top_groups: topGroups ?? [],
    recent_posts: recentPosts ?? [],
  })
})

// POST /api/admin/cc/community — moderate content
export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const { action } = body
  const db = createAdminClient()

  if (action === 'remove_post') {
    const { post_id, reason } = body
    if (!post_id) return apiError('post_id required', 400)
    const { data: post } = await db.from('posts').select('user_id, title').eq('id', post_id).single()
    await db.from('posts').update({ status: 'removed' }).eq('id', post_id)
    if (post) {
      await db.from('notifications').insert({
        user_id: post.user_id, type: 'system', channel: 'in_app',
        title: 'Post Removed',
        body: `Your post was removed by our moderation team. ${reason ? `Reason: ${reason}` : ''}`,
      })
    }
    await createAuditLog({ adminId: userId, action: 'post_removed', resourceType: 'post', resourceId: post_id, newData: { reason } })
    return apiSuccess({ removed: true })
  }

  if (action === 'approve_post') {
    const { post_id } = body
    if (!post_id) return apiError('post_id required', 400)
    await db.from('posts').update({ status: 'published' }).eq('id', post_id)
    return apiSuccess({ approved: true })
  }

  if (action === 'remove_comment') {
    const { comment_id, reason } = body
    if (!comment_id) return apiError('comment_id required', 400)
    const { data: comment } = await db.from('post_comments').select('user_id, post_id').eq('id', comment_id).single()
    await db.from('post_comments').update({ is_removed: true }).eq('id', comment_id)
    if (comment) {
      await db.from('posts').update({ comment_count: db.rpc('decrement', { x: 1 }) as unknown as number }).eq('id', comment.post_id)
    }
    await createAuditLog({ adminId: userId, action: 'comment_removed', resourceType: 'comment', resourceId: comment_id })
    return apiSuccess({ removed: true })
  }

  if (action === 'pin_post') {
    const { post_id, pinned } = body
    if (!post_id) return apiError('post_id required', 400)
    await db.from('posts').update({ is_pinned: pinned ?? true }).eq('id', post_id)
    return apiSuccess({ pinned: pinned ?? true })
  }

  if (action === 'feature_post') {
    const { post_id, featured } = body
    if (!post_id) return apiError('post_id required', 400)
    await db.from('posts').update({ is_featured: featured ?? true }).eq('id', post_id)
    return apiSuccess({ featured: featured ?? true })
  }

  if (action === 'verify_group') {
    const { group_id } = body
    if (!group_id) return apiError('group_id required', 400)
    await db.from('community_groups').update({ is_verified: true }).eq('id', group_id)
    return apiSuccess({ verified: true })
  }

  if (action === 'delete_group') {
    const { group_id, reason } = body
    if (!group_id) return apiError('group_id required', 400)
    const { data: group } = await db.from('community_groups').select('creator_id, name').eq('id', group_id).single()
    await db.from('community_groups').delete().eq('id', group_id)
    if (group) {
      await db.from('notifications').insert({
        user_id: group.creator_id, type: 'system', channel: 'in_app',
        title: `Group Removed: ${group.name}`,
        body: `Your group was removed. ${reason ? `Reason: ${reason}` : ''}`,
      })
    }
    return apiSuccess({ deleted: true })
  }

  return apiError('Invalid action', 400)
})
