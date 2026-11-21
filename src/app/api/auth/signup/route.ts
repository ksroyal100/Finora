import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { logSecurityEvent, getClientIP } from '@/lib/security/rbac'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(2).max(100).optional(),
  referral_code: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email, password, full_name, referral_code } = parsed.data
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?purpose=verify_email`,
      },
    })

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })

    if (data.user) {
      await logSecurityEvent({ userId: data.user.id, eventType: 'signup', severity: 'low', ipAddress: getClientIP(req) })
    }

    // Handle referral
    if (referral_code && data.user) {
      const admin = createAdminClient()
      const { data: referrer } = await admin
        .from('profiles')
        .select('id')
        .eq('referral_code', referral_code.toUpperCase())
        .single()
      if (referrer) {
        try {
          await admin.from('referrals').insert({ referrer_id: referrer.id, referred_id: data.user.id })
        } catch { /* non-critical */ }
        try {
          await admin.from('profiles').update({ referred_by: referrer.id }).eq('id', data.user.id)
        } catch { /* non-critical */ }
      }
    }

    return NextResponse.json({ success: true, data: { user: data.user, session: data.session } })
  } catch (err) {
    console.error('[Auth/Signup]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
