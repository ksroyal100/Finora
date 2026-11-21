// POST /api/notes/sync
// One round trip: apply the client's queued changes, then return everything that changed since the cursor.
//
// Security model (same as the rest of Finora's API): the user is authenticated by withAuth (Bearer token or
// cookie) and `userId` comes ONLY from that - never from the request body. Data access uses the service-role
// client with that explicit user id, and the SQL functions are executable by the service role only.
// All merge/conflict logic lives in Postgres (notes_apply_batch) so it is atomic under concurrent syncs.

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'
import { createAdminClient } from '@/lib/supabase/server'
import { NOTE_COLORS, NOTE_FIELDS, NOTE_LIMITS, type SyncResponse, type MutationResult, type ServerNote } from '@/lib/notes/types'

const MAX_MUTATIONS = 20
const MAX_BODY_CHARS = 3_000_000
const DEFAULT_PULL = 200

const uuid = z.string().uuid()

const mutationSchema = z.object({
  mutation_id: uuid,
  id: uuid,
  base_version: z.number().int().min(0).max(1_000_000),
  dirty: z.array(z.enum(NOTE_FIELDS)).max(NOTE_FIELDS.length),
  note: z.object({
    title: z.string().max(NOTE_LIMITS.title),
    content: z.string().max(NOTE_LIMITS.content),
    color: z.enum(NOTE_COLORS),
    labels: z.array(z.string().min(1).max(NOTE_LIMITS.label)).max(NOTE_LIMITS.labels),
    pinned: z.boolean(),
    archived: z.boolean(),
    deleted: z.boolean(),
  }),
  copy_id: uuid.optional(),
  client_updated_at: z.number().int().min(0).max(8.64e15).optional(),
})

const bodySchema = z.object({
  mutations: z.array(mutationSchema).max(MAX_MUTATIONS),
  cursor: z.object({
    ts: z.string().max(64).refine((v) => !Number.isNaN(Date.parse(v)), 'invalid timestamp'),
    id: uuid,
  }).nullable(),
  limit: z.number().int().min(1).max(500).optional(),
})

export const POST = withAuth(async (req: NextRequest, { userId }) => {
  const raw = await req.text()
  if (raw.length > MAX_BODY_CHARS) return apiError('Payload too large', 413, 'PAYLOAD_TOO_LARGE')

  let json: unknown
  try { json = JSON.parse(raw) } catch { return apiError('Invalid JSON', 400, 'BAD_REQUEST') }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return apiError('Invalid sync request', 400, 'VALIDATION_ERROR')
  const { mutations, cursor } = parsed.data
  const limit = parsed.data.limit ?? DEFAULT_PULL

  const db = createAdminClient()

  // 1) apply queued changes (atomic merge in Postgres)
  let results: MutationResult[] = []
  if (mutations.length > 0) {
    const { data, error } = await db.rpc('notes_apply_batch', { p_user: userId, p_mutations: mutations })
    if (error) {
      console.error('[notes/sync] apply failed:', error.message)
      return apiError('Sync failed', 500, 'SYNC_FAILED')
    }
    results = (data ?? []) as MutationResult[]
  }

  // 2) pull changes since the cursor (limit + 1 tells us whether there is more)
  const { data: pulled, error: pullError } = await db.rpc('notes_pull', {
    p_user: userId,
    p_ts: cursor?.ts ?? null,
    p_id: cursor?.id ?? null,
    p_limit: limit + 1,
  })
  if (pullError) {
    console.error('[notes/sync] pull failed:', pullError.message)
    return apiError('Sync failed', 500, 'SYNC_FAILED')
  }
  const all = (pulled ?? []) as ServerNote[]
  const hasMore = all.length > limit
  const changes = hasMore ? all.slice(0, limit) : all
  const last = changes[changes.length - 1]

  const body: SyncResponse = {
    results,
    changes,
    cursor: last ? { ts: last.updated_at, id: last.id } : cursor,
    has_more: hasMore,
    server_time: new Date().toISOString(),
  }
  return apiSuccess(body)
}, {
  // Own bucket: sync runs in the background (debounced + polled), so it must not eat the 60/min budget that every
  // other authenticated endpoint shares for the same IP (think an office behind one NAT). The client also throttles itself.
  rateLimit: { key: 'notes-sync', limit: 150 },
})
