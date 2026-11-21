import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logSecurityEvent, getClientIP } from '@/lib/security/rbac'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()

  // Capture identity before signing out — the session is gone afterward
  const { data: { user } } = await supabase.auth.getUser()

  await supabase.auth.signOut()

  if (user) {
    await logSecurityEvent({ userId: user.id, eventType: 'logout', severity: 'low', ipAddress: getClientIP(req) })
  }

  return NextResponse.json({ success: true })
}
