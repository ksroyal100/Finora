'use client'

import Link from 'next/link'
import { ArrowUpRight, Clock, Lock } from 'lucide-react'
import { ToolMeta } from '@/lib/toolkit/registry'

export function ToolCard({ tool }: { tool: ToolMeta }) {
  const isLive = tool.status === 'live'
  const isPro = tool.tier === 'pro'

  const content = (
    <div
      className="card"
      style={{
        padding: 18, height: '100%', display: 'flex', flexDirection: 'column', gap: 10,
        cursor: isLive ? 'pointer' : 'default',
        opacity: isLive ? 1 : 0.55,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{tool.title}</div>
        {!isLive ? (
          <span className="badge badge-gray" style={{ fontSize: 10, padding: '2px 7px', flexShrink: 0, gap: 3 }}>
            <Clock size={10} /> Soon
          </span>
        ) : isPro ? (
          <span className="badge badge-gold" style={{ fontSize: 10, padding: '2px 7px', flexShrink: 0, gap: 3 }}>
            <Lock size={9} /> Pro
          </span>
        ) : (
          <ArrowUpRight size={15} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
        )}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.5, margin: 0 }}>{tool.description}</p>
    </div>
  )

  if (!isLive) return content
  return (
    <Link href={`/financial-toolkit/${tool.slug}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      {content}
    </Link>
  )
}
