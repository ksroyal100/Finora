// Force all app pages to render on-demand (not at build time)
// so Supabase credentials are always available at runtime
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { SupportChatWidget } from '@/components/support/SupportChatWidget'
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // If Supabase isn't configured, the setup page will handle it via middleware
  let user = null
  let layoutUser = {
    display_name: 'User',
    email: '',
    avatar_url: undefined as string | undefined,
    plan: 'free',
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) redirect('/signin')
    user = authUser

    // Fetch profile + subscription in parallel
    const [{ data: profile }, { data: sub }] = await Promise.all([
      supabase
        .from('profiles')
        .select('display_name, full_name, email, avatar_url, username')
        .eq('id', authUser.id)
        .single(),
      supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', authUser.id)
        .single(),
    ])

    const plan = sub?.status === 'active' ? (sub.plan ?? 'free') : 'free'

    layoutUser = {
      display_name:
        profile?.display_name ??
        profile?.full_name ??
        authUser.email?.split('@')[0] ??
        'User',
      email:      profile?.email ?? authUser.email ?? '',
      avatar_url: profile?.avatar_url ?? undefined,
      plan,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // Missing credentials → middleware already redirected to /setup
    // Unauthenticated → redirect to signin
    if (!msg.includes('[Finora]')) {
      redirect('/signin')
    }
    // If env vars are missing just render children (middleware handles the redirect)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Sidebar user={layoutUser} />
      <div className="main-content" style={{ flex: 1 }}>
        <Topbar user={layoutUser} />
        <main style={{ paddingTop: 'var(--topbar-height)' }}>
          {children}
        </main>
      </div>
      <SupportChatWidget />
      <FeedbackWidget />
    </div>
  )
}
