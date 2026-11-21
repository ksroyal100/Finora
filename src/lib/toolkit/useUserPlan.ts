'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type UserPlan = 'free' | 'pro' | 'plus' | 'elite'

const PLAN_RANK: Record<UserPlan, number> = { free: 0, pro: 1, plus: 2, elite: 3 }

export function planMeets(plan: UserPlan, minPlan: UserPlan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minPlan]
}

// Fails safe to 'free' — if we can't determine the plan (not logged in,
// query error, still loading), pro features stay locked rather than
// briefly/incorrectly unlocking.
export function useUserPlan() {
  const [plan, setPlan] = useState<UserPlan>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (!cancelled) { setPlan('free'); setLoading(false) }; return }

        const { data } = await supabase
          .from('subscriptions')
          .select('plan, status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single()

        if (!cancelled) {
          setPlan((data?.plan as UserPlan) ?? 'free')
          setLoading(false)
        }
      } catch {
        if (!cancelled) { setPlan('free'); setLoading(false) }
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { plan, loading, isPro: planMeets(plan, 'pro') }
}
