import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getClientIP, logSecurityEvent } from '@/lib/security/rbac'
import { z } from 'zod'

const requestSchema = z.object({
  email: z.string().email(),
})

const updateSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  access_token: z.string(),
})

// POST /api/auth/reset-password — request reset link
export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  try {
    const body = await req.json()

    // Update password (with token)
    if (body.access_token) {
      const parsed = updateSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: 'Validation failed' }, { status: 400 })
      }
      const supabase = await createServerSupabaseClient()
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
      return NextResponse.json({ success: true, message: 'Password updated successfully' })
    }

    // Request reset
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Valid email required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
    })

    if (error) {
      await logSecurityEvent({ eventType: 'password_reset_failed', severity: 'low', ipAddress: ip })
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }

    await logSecurityEvent({ eventType: 'password_reset_requested', severity: 'low', ipAddress: ip })
    // Always return success to prevent email enumeration
    return NextResponse.json({ success: true, message: 'If an account exists, a reset link has been sent' })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
