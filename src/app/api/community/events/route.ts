import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError, getPagination } from '@/lib/security/rbac'
import { z } from 'zod'

const eventSchema = z.object({
  title: z.string().min(3).max(300),
  description: z.string().max(5000).optional(),
  event_type: z.enum(['online', 'in_person', 'hybrid']).default('online'),
  location: z.string().max(500).optional(),
  meeting_url: z.string().url().optional(),
  starts_at: z.string(),
  ends_at: z.string(),
  max_attendees: z.number().int().positive().optional(),
  is_free: z.boolean().default(true),
  price: z.number().min(0).default(0),
  group_id: z.string().uuid().optional(),
})

export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const status = url.searchParams.get('status') ?? 'upcoming'
  const myEvents = url.searchParams.get('mine') === 'true'
  const db = createAdminClient()

  let query = db
    .from('events')
    .select(`
      *,
      creator:profiles!creator_id(id, display_name, avatar_url, username),
      group:community_groups!group_id(id, name, slug)
    `, { count: 'exact' })

  if (status !== 'all') query = query.eq('status', status)
  if (myEvents) {
    const { data: attending } = await db.from('event_attendees').select('event_id').eq('user_id', userId)
    const ids = attending?.map(a => a.event_id) ?? []
    if (ids.length) query = query.in('id', ids)
    else return apiSuccess({ events: [], total: 0 })
  }

  const { data, count, error } = await query
    .order('starts_at', { ascending: true })
    .range(from, to)

  if (error) return apiError(error.message, 500)

  const eventIds = (data ?? []).map(e => e.id)
  const { data: attending } = await db.from('event_attendees').select('event_id').eq('user_id', userId).in('event_id', eventIds)
  const attendingSet = new Set(attending?.map(a => a.event_id))

  return apiSuccess({
    events: (data ?? []).map(e => ({ ...e, is_attending: attendingSet.has(e.id) })),
    total: count ?? 0, page, per_page: perPage,
  })
})

export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()

  if (body.action === 'rsvp') {
    const { event_id } = body
    if (!event_id) return apiError('event_id required', 400)
    const db = createAdminClient()
    const { data: event } = await db.from('events').select('max_attendees, attendee_count').eq('id', event_id).single()
    if (!event) return apiError('Event not found', 404)
    if (event.max_attendees && event.attendee_count >= event.max_attendees) return apiError('Event is full', 400)

    const { data: existing } = await db.from('event_attendees').select('id').eq('event_id', event_id).eq('user_id', userId).single()
    if (existing) {
      await db.from('event_attendees').update({ status: 'canceled' }).eq('id', existing.id)
      await db.from('events').update({ attendee_count: Math.max(0, event.attendee_count - 1) }).eq('id', event_id)
      return apiSuccess({ registered: false })
    }

    await db.from('event_attendees').insert({ event_id, user_id: userId, status: 'registered' })
    await db.from('events').update({ attendee_count: event.attendee_count + 1 }).eq('id', event_id)
    return apiSuccess({ registered: true })
  }

  const parsed = eventSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()
  const { data, error } = await db.from('events').insert({ creator_id: userId, status: 'upcoming', ...parsed.data }).select().single()
  if (error) return apiError(error.message, 500)
  return apiSuccess(data, 201)
})
