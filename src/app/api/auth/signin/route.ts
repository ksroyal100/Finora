import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logSecurityEvent, getClientIP } from '@/lib/security/rbac'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

    if (error) {
      await logSecurityEvent({ eventType: 'failed_login', severity: 'medium', ipAddress: ip, metadata: { email: parsed.data.email } })
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 })
    }

    await logSecurityEvent({ userId: data.user.id, eventType: 'login', severity: 'low', ipAddress: ip })
    return NextResponse.json({ success: true, data: { user: data.user, session: data.session } })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
