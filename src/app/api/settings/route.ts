import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, requirePlan, apiSuccess, apiError } from '@/lib/security/rbac'
import { z } from 'zod'

const settingsSchema = z.object({
  timezone: z.string().optional(),
  currency: z.string().length(3).optional(),
  country_code: z.string().length(2).optional(),
  language: z.string().optional(),
  theme: z.enum(['dark', 'light', 'system']).optional(),
  compact_mode: z.boolean().optional(),
  show_balances: z.boolean().optional(),
  default_portfolio_id: z.string().uuid().optional(),
})

const securitySchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
})

// GET /api/settings — get user settings and profile
export const GET = withAuth(async (req, { userId }) => {
  const db = createAdminClient()

  const [{ data: profile }, { data: prefs }, { data: apiKeys }] = await Promise.all([
    db.from('profiles').select('timezone, currency, country_code, metadata, referral_code').eq('id', userId).single(),
    db.from('notification_preferences').select('*').eq('user_id', userId).single(),
    db.from('api_keys').select('id, name, last_four, scopes, last_used_at, created_at, expires_at, is_active').eq('user_id', userId).eq('is_active', true),
  ])

  return apiSuccess({
    profile: profile ?? {},
    notification_preferences: prefs ?? {},
    api_keys: apiKeys ?? [],
  })
})

// PATCH /api/settings — update settings
export const PATCH = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const db = createAdminClient()

  if (body.section === 'security') {
    const parsed = securitySchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed', 400)

    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = await createServerSupabaseClient()

    // Verify current password
    const { data: profile } = await db.from('profiles').select('email').eq('id', userId).single()
    if (!profile) return apiError('Profile not found', 404)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: parsed.data.current_password,
    })
    if (signInError) return apiError('Current password is incorrect', 400)

    const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password })
    if (error) return apiError(error.message, 400)

    const { logSecurityEvent } = await import('@/lib/security/rbac')
    await logSecurityEvent({ userId, eventType: 'password_changed', severity: 'low' })
    return apiSuccess({ updated: true, message: 'Password changed successfully' })
  }

  if (body.section === 'profile') {
    const parsed = settingsSchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed', 400)

    const { theme, compact_mode, show_balances, default_portfolio_id, ...profileUpdates } = parsed.data

    // Store UI preferences in metadata
    const uiPrefs: Record<string, unknown> = {}
    if (theme !== undefined) uiPrefs.theme = theme
    if (compact_mode !== undefined) uiPrefs.compact_mode = compact_mode
    if (show_balances !== undefined) uiPrefs.show_balances = show_balances
    if (default_portfolio_id !== undefined) uiPrefs.default_portfolio_id = default_portfolio_id

    const { data: existing } = await db.from('profiles').select('metadata').eq('id', userId).single()
    const updatedMetadata = { ...(existing?.metadata ?? {}), ...uiPrefs }

    const { data, error } = await db.from('profiles').update({
      ...profileUpdates,
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    }).eq('id', userId).select().single()

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  }

  return apiError('section must be profile or security', 400)
})

// POST /api/settings — manage API keys
export const POST = requirePlan('plus', async (req, { userId }) => {
  const body = await req.json()
  const { action } = body
  const db = createAdminClient()

  if (action === 'create_api_key') {
    const { name, scopes } = body
    if (!name) return apiError('name required', 400)

    const { generateSecureToken, hashString } = await import('@/lib/server-utils')
    const rawKey = `wos_${generateSecureToken(32)}`
    const keyHash = await hashString(rawKey)
    const lastFour = rawKey.slice(-4)

    const { data, error } = await db.from('api_keys').insert({
      user_id: userId,
      name,
      key_hash: keyHash,
      last_four: lastFour,
      scopes: scopes ?? ['read'],
    }).select('id, name, last_four, scopes, created_at').single()

    if (error) return apiError(error.message, 500)
    return apiSuccess({ ...data, key: rawKey, warning: 'Store this key securely — it will only be shown once' }, 201)
  }

  if (action === 'revoke_api_key') {
    const { key_id } = body
    if (!key_id) return apiError('key_id required', 400)
    await db.from('api_keys').update({ is_active: false }).eq('id', key_id).eq('user_id', userId)
    return apiSuccess({ revoked: true })
  }

  return apiError('action must be create_api_key or revoke_api_key', 400)
})
