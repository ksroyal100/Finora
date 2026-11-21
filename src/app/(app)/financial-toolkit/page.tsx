'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Sparkles, Activity } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { ToolCard } from '@/components/toolkit/ToolCard'
import { TOOL_CATEGORIES, TOOLS, getLiveToolCount } from '@/lib/toolkit/registry'

export default function FinancialToolkitHub() {
  const [query, setQuery] = useState('')
  const liveCount = getLiveToolCount()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return TOOLS
    return TOOLS.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
  }, [query])

  return (
    <div className="page-container fade-in">
      <PageHeader
        eyebrow="New"
        title="Financial Toolkit"
        description={`Simulate, calculate, and plan every major financial decision — ${liveCount} calculators live today, more shipping every week.`}
      />

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 28, maxWidth: 480 }}>
        <Search size={15} color="var(--text-tertiary)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          className="input-field"
          placeholder="Search calculators — retirement, mortgage, debt…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ paddingLeft: 38 }}
        />
      </div>

      {/* AI Planner teaser */}
      <div
        className="card"
        style={{
          padding: 22, marginBottom: 28, display: 'flex', alignItems: 'center', gap: 16,
          background: 'linear-gradient(135deg, rgba(48,209,88,0.10), rgba(10,132,255,0.06))',
          border: '1px solid rgba(48,209,88,0.18)',
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: 'rgba(48,209,88,0.16)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Sparkles size={20} color="var(--text-green)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
            AI Financial Planner — coming soon
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Type a goal like "I want to retire at 50" and get a full plan: required savings, allocation, timeline, and probability of success.
          </div>
        </div>
        <span className="badge badge-gray" style={{ flexShrink: 0 }}>In development</span>
      </div>

      {query ? (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {filtered.map(tool => <ToolCard key={tool.slug} tool={tool} />)}
          </div>
        </div>
      ) : (
        TOOL_CATEGORIES.filter(c => c.id !== 'ai-planner').map(category => {
          const tools = TOOLS.filter(t => t.category === category.id)
          return (
            <div key={category.id} style={{ marginBottom: 32 }}>
              <div style={{ marginBottom: 14 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{category.label}</h2>
                <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '3px 0 0' }}>{category.description}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                {tools.map(tool => <ToolCard key={tool.slug} tool={tool} />)}
              </div>
            </div>
          )
        })
      )}

      {/* Live performance terminal */}
      {!query && (
        <Link href="/performance" style={{ textDecoration: 'none' }}>
          <div
            className="card"
            style={{
              padding: 22, marginTop: 8, display: 'flex', alignItems: 'center', gap: 16,
              background: 'linear-gradient(135deg, rgba(255,176,32,0.10), rgba(5,6,7,0.4))',
              border: '1px solid rgba(255,176,32,0.22)',
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,176,32,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Activity size={20} color="#FFB020" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Performance Terminal</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Track your net worth live: equity curve, risk meters, allocation heat grid, goal pacing and Monte Carlo projections.
              </div>
            </div>
            <span className="badge badge-green" style={{ flexShrink: 0 }}>Live</span>
          </div>
        </Link>
      )}
    </div>
  )
}
