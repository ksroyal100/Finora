'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { formatCurrency } from '@/lib/utils'
import { calcPortfolioMetrics, Holding } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_HOLDINGS: Holding[] = [
  { name: 'US Stocks', value: 40000, expectedReturnPct: 9 },
  { name: 'International Stocks', value: 15000, expectedReturnPct: 8 },
  { name: 'Bonds', value: 20000, expectedReturnPct: 4 },
  { name: 'Cash', value: 5000, expectedReturnPct: 4.5 },
]

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '8px 10px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%',
}

const PALETTE = ['var(--text-green)', 'var(--text-blue)', 'var(--text-gold)', 'var(--text-orange)', 'var(--text-red)', 'var(--text-yellow)']

export interface HoldingsCalculatorConfig {
  slug: string
  title: string
  categoryLabel: string
  description: string
  mode: 'allocation' | 'return' | 'risk' | 'rebalancing'
}

export function GenericHoldingsCalculator({ config }: { config: HoldingsCalculatorConfig }) {
  const [holdings, setHoldings] = useState<Holding[]>(DEFAULT_HOLDINGS)
  const [targets, setTargets] = useState<Record<string, number>>({ 'US Stocks': 50, 'International Stocks': 15, 'Bonds': 25, 'Cash': 10 })
  const { scenarios, save, remove, duplicate } = useToolkitHistory<Holding[], ReturnType<typeof calcPortfolioMetrics>>(config.slug)
  const result = useMemo(() => calcPortfolioMetrics(holdings), [holdings])

  const update = (i: number, patch: Partial<Holding>) => setHoldings(prev => prev.map((h, idx) => idx === i ? { ...h, ...patch } : h))
  const addHolding = () => setHoldings(prev => [...prev, { name: `Holding ${prev.length + 1}`, value: 1000, expectedReturnPct: 7 }])
  const removeHolding = (i: number) => setHoldings(prev => prev.filter((_, idx) => idx !== i))

  const insights = useMemo(() => {
    if (config.mode === 'risk') {
      const list = [`Your largest position is ${result.largestPositionPct.toFixed(0)}% of the portfolio.`]
      if (result.largestPositionPct > 40) list.push('A single position over 40% is high concentration risk — a drop in that one holding disproportionately affects your whole portfolio.')
      return list
    }
    if (config.mode === 'return') {
      return [`Your weighted expected return across ${result.holdingsCount} holdings is ${result.weightedReturnPct.toFixed(2)}% annually, based on the return assumptions you entered per holding.`]
    }
    if (config.mode === 'rebalancing') {
      const drifts = result.allocations.map(a => ({ name: a.name, drift: a.weightPct - (targets[a.name] ?? a.weightPct) }))
      const biggest = drifts.reduce((max, d) => Math.abs(d.drift) > Math.abs(max.drift) ? d : max, drifts[0] ?? { name: '', drift: 0 })
      if (Math.abs(biggest.drift) < 3) return ['Your allocation is close to target across all holdings — no urgent rebalancing needed.']
      return [`${biggest.name} has drifted ${biggest.drift > 0 ? 'above' : 'below'} target by ${Math.abs(biggest.drift).toFixed(1)} percentage points — the largest rebalancing gap in your portfolio.`]
    }
    return [`Total portfolio value: ${formatCurrency(result.totalValue, 'USD', true)} across ${result.holdingsCount} holdings.`]
  }, [config.mode, result, targets])

  return (
    <ToolShell
      title={config.title}
      categoryLabel={config.categoryLabel}
      description={config.description}
      scenarios={scenarios}
      onSave={name => save(name, holdings, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setHoldings(s.input)}
      inputsPanel={
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Holdings</div>
          {holdings.map((h, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: config.mode === 'rebalancing' ? '2fr 1fr 1fr auto' : '2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input value={h.name} onChange={e => update(i, { name: e.target.value })} style={inputStyle} placeholder="Name" />
              <input type="number" value={h.value} onChange={e => update(i, { value: parseFloat(e.target.value) || 0 })} style={inputStyle} placeholder="Value $" />
              {config.mode !== 'rebalancing' && (
                <input type="number" value={h.expectedReturnPct} onChange={e => update(i, { expectedReturnPct: parseFloat(e.target.value) || 0 })} style={inputStyle} placeholder="Return %" />
              )}
              {config.mode === 'rebalancing' && (
                <input type="number" value={targets[h.name] ?? 0} onChange={e => setTargets(prev => ({ ...prev, [h.name]: parseFloat(e.target.value) || 0 }))} style={inputStyle} placeholder="Target %" />
              )}
              <button onClick={() => removeHolding(i)} disabled={holdings.length <= 1} style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-red)', cursor: holdings.length > 1 ? 'pointer' : 'not-allowed', opacity: holdings.length > 1 ? 1 : 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button onClick={addHolding} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-green)', background: 'color-mix(in srgb, var(--text-green) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--text-green) 25%, transparent)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', marginTop: 4 }}>
            <Plus size={12} /> Add Holding
          </button>
        </div>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Total Value" value={formatCurrency(result.totalValue, 'USD', true)} color="var(--text-blue)" size="lg" />
              {config.mode === 'return' && <ResultStat label="Weighted Return" value={`${result.weightedReturnPct.toFixed(2)}%`} color="var(--text-green)" size="lg" />}
              {config.mode === 'risk' && <ResultStat label="Largest Position" value={`${result.largestPositionPct.toFixed(1)}%`} color="var(--text-orange)" size="lg" />}
              {(config.mode === 'allocation' || config.mode === 'rebalancing') && <ResultStat label="Holdings" value={result.holdingsCount.toString()} size="lg" />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.allocations.map((a, i) => (
                <div key={a.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{a.name}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {a.weightPct.toFixed(1)}%{config.mode === 'rebalancing' && targets[a.name] !== undefined ? ` (target ${targets[a.name]}%)` : ''}
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                    <div style={{ width: `${a.weightPct}%`, height: '100%', background: PALETTE[i % PALETTE.length], borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
