'use client'

import { ReactNode } from 'react'
import { Lightbulb } from 'lucide-react'

interface ResultStatProps {
  label: string
  value: string
  color?: string
  sub?: string
  size?: 'md' | 'lg'
}

export function ResultStat({ label, value, color = 'var(--text-primary)', sub, size = 'md' }: ResultStatProps) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: size === 'lg' ? 32 : 20, fontWeight: 700, letterSpacing: '-0.03em',
        color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

interface InsightListProps {
  insights: string[]
}

export function InsightList({ insights }: InsightListProps) {
  if (insights.length === 0) return null
  return (
    <div style={{
      background: 'color-mix(in srgb, var(--text-green) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--text-green) 14%, transparent)',
      borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {insights.map((text, i) => (
        <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <Lightbulb size={14} color="var(--text-green)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</span>
        </div>
      ))}
    </div>
  )
}

export function ResultRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Array.isArray(children) ? children.length : 1}, 1fr)`, gap: 16 }}>
      {children}
    </div>
  )
}
