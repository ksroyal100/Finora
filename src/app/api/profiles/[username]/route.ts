import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/profiles/[username] — public profile view
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  if (!username) return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 })

  const db = createAdminClient()

  const { data: profile, error } = await db
    .from('profiles')
    .select('id, display_name, username, avatar_url, bio, website, location, is_verified, is_creator, role, created_at')
    .eq('username', username)
    .eq('is_banned', false)
    .single()

  if (error || !profile) {
    return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
  }

  // Public stats
  const [
    { count: followerCount },
    { count: followingCount },
    { count: postCount },
    { data: store },
    { data: recentPosts },
  ] = await Promise.all([
    db.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
    db.from('user_follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
    db.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', profile.id).eq('status', 'published'),
    db.from('creator_stores').select('store_name, slug, is_verified, total_sales, average_rating').eq('user_id', profile.id).eq('is_active', true).single(),
    db.from('posts').select('id, content, type, like_count, comment_count, tags, created_at').eq('user_id', profile.id).eq('status', 'published').order('like_count', { ascending: false }).limit(3),
  ])

  return NextResponse.json({
    success: true,
    data: {
      ...profile,
      stats: {
        followers: followerCount ?? 0,
        following: followingCount ?? 0,
        posts: postCount ?? 0,
      },
      store: store ?? null,
      featured_posts: recentPosts ?? [],
    },
  })
}
