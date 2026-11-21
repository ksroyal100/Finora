import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withFounder, apiSuccess, apiError, getPagination, sanitizeFilterInput } from '@/lib/security/rbac'
import { createAuditLog } from '@/lib/security/rbac'
import { z } from 'zod'

const docSchema = z.object({
  title: z.string().min(3).max(300),
  document_type: z.enum(['business_plan', 'strategy', 'acquisition_target', 'investment_opportunity', 'company_vision', 'confidential_report', 'financial_projection', 'legal', 'other']),
  content: z.string().optional(),
  summary: z.string().max(2000).optional(),
  tags: z.array(z.string()).max(20).default([]),
  priority: z.number().min(1).max(5).default(3),
})

// GET /api/admin/cc/vault — list vault documents
export const GET = withFounder(async (req, { userId }) => {
  const url = new URL(req.url)
  const { page, perPage, from, to } = getPagination(req)
  const type = url.searchParams.get('type') ?? ''
  const search = url.searchParams.get('search') ?? ''
  const db = createAdminClient()

  let query = db
    .from('vault_documents')
    .select('id, title, slug, document_type, summary, tags, priority, is_encrypted, last_accessed_at, created_at, updated_at', { count: 'exact' })
    .order('priority', { ascending: false })
    .order('updated_at', { ascending: false })

  if (type) query = query.eq('document_type', type)
  if (search) query = query.or(`title.ilike.%${sanitizeFilterInput(search)}%,summary.ilike.%${sanitizeFilterInput(search)}%`)

  const { data, count, error } = await query.range(from, to)
  if (error) return apiError(error.message, 500)

  await createAuditLog({ adminId: userId, action: 'vault_list_accessed', resourceType: 'vault' })

  return apiSuccess({ documents: data ?? [], total: count ?? 0, page, per_page: perPage })
})

// POST /api/admin/cc/vault — create vault document
export const POST = withFounder(async (req, { userId }) => {
  const body = await req.json()
  const parsed = docSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const db = createAdminClient()
  const slug = parsed.data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80) + '-' + Date.now().toString(36)

  const { data, error } = await db.from('vault_documents').insert({
    ...parsed.data,
    slug,
    is_encrypted: true,
    created_by: userId,
  }).select().single()

  if (error) return apiError(error.message, 500)

  await createAuditLog({
    adminId: userId,
    action: 'vault_document_created',
    resourceType: 'vault_document',
    resourceId: data.id,
    newData: { title: data.title, type: data.document_type },
  })

  return apiSuccess(data, 201)
})

// PATCH /api/admin/cc/vault — update vault document
export const PATCH = withFounder(async (req, { userId }) => {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return apiError('Document ID required', 400)

  const db = createAdminClient()
  const { data, error } = await db.from('vault_documents').update({
    ...updates,
    updated_at: new Date().toISOString(),
  }).eq('id', id).select().single()

  if (error) return apiError(error.message, 500)

  await createAuditLog({
    adminId: userId,
    action: 'vault_document_updated',
    resourceType: 'vault_document',
    resourceId: id,
  })

  return apiSuccess(data)
})

// DELETE /api/admin/cc/vault?id=xxx
export const DELETE = withFounder(async (req, { userId }) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return apiError('Document ID required', 400)

  const db = createAdminClient()
  const { data: doc } = await db.from('vault_documents').select('title').eq('id', id).single()
  await db.from('vault_documents').delete().eq('id', id)

  await createAuditLog({
    adminId: userId,
    action: 'vault_document_deleted',
    resourceType: 'vault_document',
    resourceId: id,
    oldData: { title: doc?.title },
  })

  return apiSuccess({ deleted: true })
})
