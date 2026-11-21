import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError, getPagination, sanitizeFilterInput } from '@/lib/security/rbac'
import { z } from 'zod'

const groupSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  is_public: z.boolean().default(true),
  tags: z.array(z.string().max(30)).max(10).default([]),
  required_plan: z.enum(['free', 'pro', 'plus', 'elite']).default('free'),
})

// GET /api/community/groups — list groups
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const search = url.searchParams.get('search') ?? ''
  const myGroups = url.searchParams.get('mine') === 'true'
  const db = createAdminClient()

  let query = db
    .from('community_groups')
    .select(`
      *,
      creator:profiles!creator_id(display_name, username, avatar_url)
    `, { count: 'exact' })
    .eq('is_public', true)

  if (search) {
    query = query.or(`name.ilike.%${sanitizeFilterInput(search)}%,description.ilike.%${sanitizeFilterInput(search)}%`)
  }

  if (myGroups) {
    const { data: memberOf } = await db
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId)
    const groupIds = memberOf?.map(m => m.group_id) ?? []
    if (groupIds.length) query = query.in('id', groupIds)
    else return apiSuccess({ groups: [], total: 0 })
  }

  const { data, count, error } = await query
    .order('member_count', { ascending: false })
    .range(from, to)

  if (error) return apiError(error.message, 500)

  const groups = data ?? []
  const groupIds = groups.map(g => g.id)

  // Check membership for each group
  const { data: memberships } = await db
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .in('group_id', groupIds)

  const memberGroupIds = new Set(memberships?.map(m => m.group_id))

  return apiSuccess({
    groups: groups.map(g => ({ ...g, is_member: memberGroupIds.has(g.id) })),
    total: count ?? 0,
    page,
    per_page: perPage,
  })
})

// POST /api/community/groups — create group
export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const parsed = groupSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()
  const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) + '-' + Math.random().toString(36).slice(2, 6)

  const { data: group, error } = await db
    .from('community_groups')
    .insert({ creator_id: userId, slug, ...parsed.data, member_count: 1 })
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  // Auto-join creator as admin
  await db.from('group_members').insert({ group_id: group.id, user_id: userId, role: 'admin' })

  return apiSuccess(group, 201)
})
