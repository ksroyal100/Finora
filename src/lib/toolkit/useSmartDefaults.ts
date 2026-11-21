// src/lib/toolkit/useSmartDefaults.ts
//
// Reads the user's existing Finora data so calculators can pre-fill instead
// of asking for numbers the platform already has. Best-effort and read-only —
// every field is optional and every query fails soft, since a calculator must
// work perfectly fine for a brand-new account with no data yet.

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface SmartDefaults {
  loading: boolean
  monthlyExpenses: number | null
  monthlyIncome: number | null
  cashSavings: number | null
  totalAssets: number | null
  totalLiabilities: number | null
  portfolioValue: number | null
  currentAge: number | null
}

export function useSmartDefaults(): SmartDefaults {
  const [state, setState] = useState<SmartDefaults>({
    loading: true,
    monthlyExpenses: null,
    monthlyIncome: null,
    cashSavings: null,
    totalAssets: null,
    totalLiabilities: null,
    portfolioValue: null,
    currentAge: null,
  })

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (!cancelled) setState(s => ({ ...s, loading: false })); return }

        const [budgetRes, assetsRes, liabilitiesRes, portfolioRes] = await Promise.all([
          supabase.from('budgets').select('total_income, total_spent').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('assets').select('type, value').eq('user_id', user.id).eq('is_active', true),
          supabase.from('liabilities').select('balance').eq('user_id', user.id).eq('is_active', true),
          supabase.from('portfolios').select('total_value').eq('user_id', user.id).eq('is_default', true).maybeSingle(),
        ])

        const assets = assetsRes.data ?? []
        const cashSavings = assets.filter((a: any) => a.type === 'cash').reduce((s: number, a: any) => s + (a.value ?? 0), 0)
        const totalAssets = assets.reduce((s: number, a: any) => s + (a.value ?? 0), 0)
        const totalLiabilities = (liabilitiesRes.data ?? []).reduce((s: number, l: any) => s + (l.balance ?? 0), 0)

        if (!cancelled) {
          setState({
            loading: false,
            monthlyExpenses: budgetRes.data?.total_spent ?? null,
            monthlyIncome: budgetRes.data?.total_income ?? null,
            cashSavings: assets.length > 0 ? cashSavings : null,
            totalAssets: assets.length > 0 ? totalAssets : null,
            totalLiabilities: (liabilitiesRes.data ?? []).length > 0 ? totalLiabilities : null,
            portfolioValue: portfolioRes.data?.total_value ?? null,
            currentAge: null,
          })
        }
      } catch {
        if (!cancelled) setState(s => ({ ...s, loading: false }))
      }
    })()

    return () => { cancelled = true }
  }, [])

  return state
}
