import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, createAuditLog } from '@/lib/security/rbac'
import { z } from 'zod'

const updateSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
})

// GET /api/admin/cc/legal — list all documents
// GET /api/admin/cc/legal?slug=terms&history=1 — one document + its revision history
export const GET = withAdmin(async (req) => {
  const slug = req.nextUrl.searchParams.get('slug')
  const wantHistory = req.nextUrl.searchParams.get('history') === '1'
  const db = createAdminClient()

  if (slug) {
    const { data: doc, error } = await db.from('legal_documents').select('*').eq('slug', slug).single()
    if (error || !doc) return apiError('Document not found', 404)

    if (wantHistory) {
      const { data: revisions } = await db
        .from('legal_document_revisions')
        .select('id, version, updated_by, created_at')
        .eq('document_id', doc.id)
        .order('version', { ascending: false })
      return apiSuccess({ ...doc, revisions: revisions ?? [] })
    }
    return apiSuccess(doc)
  }

  const { data, error } = await db.from('legal_documents').select('id, slug, title, version, updated_at, published_at').order('slug')
  if (error) return apiError(error.message, 500)
  return apiSuccess(data ?? [])
})

// PATCH /api/admin/cc/legal — update a document by slug, snapshotting the
// previous version into legal_document_revisions first
export const PATCH = withAdmin(async (req, { userId }) => {
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed: ' + parsed.error.issues.map(i => i.message).join(', '), 400)

  const db = createAdminClient()
  const { data: existing, error: fetchError } = await db.from('legal_documents').select('*').eq('slug', parsed.data.slug).single()
  if (fetchError || !existing) return apiError('Document not found', 404)

  // Snapshot the CURRENT (pre-edit) content as a revision before overwriting.
  await db.from('legal_document_revisions').insert({
    document_id: existing.id,
    slug: existing.slug,
    title: existing.title,
    content: existing.content,
    version: existing.version,
    updated_by: existing.updated_by,
  })

  const { data, error } = await db
    .from('legal_documents')
    .update({
      title: parsed.data.title,
      content: parsed.data.content,
      version: existing.version + 1,
      updated_by: userId,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('slug', parsed.data.slug)
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  await createAuditLog({
    adminId: userId,
    action: 'legal_document.update',
    resourceType: 'legal_document',
    resourceId: existing.id,
    metadata: { slug: parsed.data.slug, new_version: existing.version + 1 },
  })

  return apiSuccess(data)
})
