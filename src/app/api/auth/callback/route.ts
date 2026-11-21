import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const purpose = searchParams.get('purpose')
  const error = searchParams.get('error')
  const errorDesc = searchParams.get('error_description')

  if (error) {
    return NextResponse.redirect(`${origin}/signin?error=${encodeURIComponent(errorDesc ?? error)}`)
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError) {
      if (purpose === 'verify_email' && data.user) {
        // Fire-and-forget — never let audit logging block the redirect
        logEmailVerified(data.user.id).catch(() => {})
      }

      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/signin?error=auth_callback_failed`)
}

async function logEmailVerified(userId: string) {
  const admin = createServiceRoleClient()
  await admin.from('security_events').insert({
    user_id: userId,
    event_type: 'email_verified',
    severity: 'low',
    description: 'User confirmed their email address',
  })
}
