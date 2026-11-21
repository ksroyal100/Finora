import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'

// POST /api/community/follow — follow or unfollow a user
export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const { target_user_id } = body
  if (!target_user_id) return apiError('target_user_id required', 400)
  if (target_user_id === userId) return apiError('Cannot follow yourself', 400)

  const db = createAdminClient()
  const { data: existing } = await db
    .from('user_follows')
    .select('id')
    .eq('follower_id', userId)
    .eq('following_id', target_user_id)
    .single()

  if (existing) {
    await db.from('user_follows').delete().eq('id', existing.id)
    return apiSuccess({ following: false, target_user_id })
  }

  await db.from('user_follows').insert({ follower_id: userId, following_id: target_user_id })

  // Notify the followed user
  const { data: follower } = await db.from('profiles').select('display_name').eq('id', userId).single()
  await db.from('notifications').insert({
    user_id: target_user_id,
    type: 'community',
    channel: 'in_app',
    title: 'New Follower',
    body: `${follower?.display_name ?? 'Someone'} started following you`,
    action_url: `/community/users/${userId}`,
  })

  return apiSuccess({ following: true, target_user_id })
})

// GET /api/community/follow — get followers or following
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const type = url.searchParams.get('type') ?? 'following'  // following | followers
  const targetId = url.searchParams.get('user_id') ?? userId
  const db = createAdminClient()

  if (type === 'followers') {
    const { data, error } = await db
      .from('user_follows')
      .select('follower:profiles!follower_id(id, display_name, username, avatar_url, is_verified)')
      .eq('following_id', targetId)
      .order('created_at', { ascending: false })
    if (error) return apiError(error.message, 500)
    return apiSuccess(data?.map(d => d.follower) ?? [])
  }

  const { data, error } = await db
    .from('user_follows')
    .select('following:profiles!following_id(id, display_name, username, avatar_url, is_verified)')
    .eq('follower_id', targetId)
    .order('created_at', { ascending: false })
  if (error) return apiError(error.message, 500)
  return apiSuccess(data?.map(d => d.following) ?? [])
})
