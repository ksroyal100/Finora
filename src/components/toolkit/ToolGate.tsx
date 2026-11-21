'use client'

import Link from 'next/link'
import { Clock, Lock, Sparkles } from 'lucide-react'
import { ToolMeta, TOOL_CATEGORIES } from '@/lib/toolkit/registry'
import { ToolRenderer } from '@/components/toolkit/ToolRenderer'
import { useUserPlan } from '@/lib/toolkit/useUserPlan'

function CenteredCard({ tool, children }: { tool: ToolMeta; children: React.ReactNode }) {
  const categoryLabel = TOOL_CATEGORIES.find(c => c.id === tool.category)?.label ?? tool.category
  return (
    <div className="card" style={{ padding: 48, textAlign: 'center', maxWidth: 520, margin: '40px auto 0' }}>
      {children}
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--green-400)', marginBottom: 6 }}>
        {categoryLabel}
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>{tool.title}</h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>{tool.description}</p>
    </div>
  )
}

export function ToolGate({ tool }: { tool: ToolMeta }) {
  const { isPro, loading } = useUserPlan()

  if (tool.status !== 'live') {
    return (
      <CenteredCard tool={tool}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--overlay-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Clock size={22} color="var(--text-tertiary)" />
        </div>
      </CenteredCard>
    )
  }

  if (tool.tier === 'pro' && !loading && !isPro) {
    return (
      <CenteredCard tool={tool}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, margin: '0 auto 16px',
          background: 'color-mix(in srgb, var(--gold-400) 15%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Lock size={20} color="var(--text-gold)" />
        </div>
        <div className="badge-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 20 }}>
          <Sparkles size={11} /> PRO CALCULATOR
        </div>
        <div>
          <Link
            href="/billing"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--green-400)', color: '#000', fontWeight: 600, fontSize: 14,
              padding: '11px 22px', borderRadius: 10, textDecoration: 'none',
            }}
          >
            Upgrade to Pro
          </Link>
        </div>
      </CenteredCard>
    )
  }

  // Loading plan status for a pro tool — avoid a flash of the locked state
  if (tool.tier === 'pro' && loading) {
    return (
      <div style={{ maxWidth: 520, margin: '80px auto 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  return <ToolRenderer slug={tool.slug} />
}
