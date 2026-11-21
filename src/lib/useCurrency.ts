// src/lib/useCurrency.ts
//
// Reads the user's preferred currency (profiles.currency — already settable
// via Settings). This is intentionally a small, opt-in hook rather than a
// context provider wrapping the whole app: existing components that already
// call formatCurrency(value, 'USD') keep working exactly as before. Any
// component can adopt real currency support by swapping in `const { currency }
// = useCurrency()` and passing it to formatCurrency instead of the literal
// 'USD' — a one-line, low-risk change per component, at your own pace.

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useCurrency() {
  const [currency, setCurrency] = useState('USD')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (!cancelled) setLoading(false); return }
        const { data } = await supabase.from('profiles').select('currency').eq('id', user.id).maybeSingle()
        if (!cancelled) {
          setCurrency(data?.currency || 'USD')
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return { currency, loading }
}
