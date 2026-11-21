'use client'

import { useEffect, useState } from 'react'
import { Lightbulb, AlertTriangle, CheckCircle2, Info, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

interface Insight {
  id: string
  severity: 'positive' | 'info' | 'warning' | 'critical'
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
}

const SEVERITY_STYLE: Record<Insight['severity'], { color: string; bg: string; icon: typeof Lightbulb }> = {
  critical: { color: 'var(--text-red)', bg: 'rgba(255,69,58,0.08)', icon: AlertTriangle },
  warning: { color: 'var(--text-orange)', bg: 'rgba(255,159,10,0.08)', icon: AlertTriangle },
  info: { color: 'var(--text-blue)', bg: 'rgba(10,132,255,0.08)', icon: Info },
  positive: { color: 'var(--text-green)', bg: 'rgba(48,209,88,0.08)', icon: CheckCircle2 },
}

export function InsightsCard() {
  const [insights, setInsights] = useState<Insight[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return

        const res = await fetch(`${API_URL}/api/insights`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const body = await res.json()
        if (!cancelled) {
          if (res.ok && body.success) setInsights(body.data.insights)
          else setError(true)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Fail quiet — insights are a bonus layer, never block or clutter the dashboard if unavailable
  if (error) return null

  return (
    <div className="card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Lightbulb size={15} color="var(--text-green)" />
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>Insights</div>
      </div>

      {insights === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ height: 52, borderRadius: 10, background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : insights.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
          Nothing urgent right now — you're on track. Check back as your accounts update.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.map(insight => {
            const style = SEVERITY_STYLE[insight.severity]
            const Icon = style.icon
            return (
              <div key={insight.id} style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 10, background: style.bg }}>
                <Icon size={16} color={style.color} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{insight.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{insight.message}</div>
                  {insight.actionUrl && (
                    <Link href={insight.actionUrl} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: style.color, textDecoration: 'none', marginTop: 8 }}>
                      {insight.actionLabel ?? 'View'} <ArrowRight size={12} />
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
