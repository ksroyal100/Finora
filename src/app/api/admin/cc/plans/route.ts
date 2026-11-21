import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, createAuditLog } from '@/lib/security/rbac'
import { z } from 'zod'

const updateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  price_monthly: z.number().min(0).optional(),
  price_yearly: z.number().min(0).optional(),
  stripe_price_monthly_id: z.string().max(200).optional().nullable(),
  stripe_price_yearly_id: z.string().max(200).optional().nullable(),
  features: z.array(z.string()).optional(),
  limits: z.record(z.union([z.number(), z.boolean(), z.string()])).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().optional(),
})

// GET /api/admin/cc/plans — list all plans, including inactive ones
export const GET = withAdmin(async () => {
  const db = createAdminClient()
  const { data, error } = await db.from('subscription_plans').select('*').order('sort_order')
  if (error) return apiError(error.message, 500)
  return apiSuccess(data ?? [])
})

// PATCH /api/admin/cc/plans?name=pro — update one plan by its name (free/pro/plus/elite)
export const PATCH = withAdmin(async (req, { userId }) => {
  const name = req.nextUrl.searchParams.get('name')
  if (!name) return apiError('Missing ?name= query param', 400)

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed: ' + parsed.error.issues.map(i => i.message).join(', '), 400)

  const db = createAdminClient()
  const { data, error } = await db
    .from('subscription_plans')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('name', name)
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  await createAuditLog({
    adminId: userId,
    action: 'subscription_plan.update',
    resourceType: 'subscription_plan',
    resourceId: data.id,
    metadata: { plan: name, changed_fields: Object.keys(parsed.data) },
  })

  return apiSuccess(data)
})
