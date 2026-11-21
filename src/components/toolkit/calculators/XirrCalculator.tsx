'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { calcXirr, CashFlowEntry } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_FLOWS: CashFlowEntry[] = [
  { date: '2022-01-01', amount: -10000 },
  { date: '2023-06-01', amount: -5000 },
  { date: '2025-08-01', amount: 21000 },
]

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '8px 10px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%',
}

export function XirrCalculator() {
  const [flows, setFlows] = useState<CashFlowEntry[]>(DEFAULT_FLOWS)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<CashFlowEntry[], ReturnType<typeof calcXirr>>('xirr-calculator')
  const result = useMemo(() => calcXirr([...flows].sort((a, b) => a.date.localeCompare(b.date))), [flows])

  const updateFlow = (i: number, patch: Partial<CashFlowEntry>) =>
    setFlows(prev => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f))
  const addFlow = () => setFlows(prev => [...prev, { date: new Date().toISOString().slice(0, 10), amount: 1000 }])
  const removeFlow = (i: number) => setFlows(prev => prev.filter((_, idx) => idx !== i))

  const insights = useMemo(() => {
    if (result.ratePct === null) return ['These cash flows don\'t converge to a stable rate — check that you have at least one negative (invested) and one positive (returned) amount.']
    return [`XIRR accounts for the exact dates of each cash flow, so money invested longer counts differently than money invested briefly — more accurate than a simple average return for irregular investments.`]
  }, [result])

  return (
    <ToolShell
      title="XIRR Calculator"
      categoryLabel="Investment Toolkit"
      description="The true annualized return across irregular, dated cash flows — deposits, withdrawals, and a final value."
      scenarios={scenarios}
      onSave={name => save(name, flows, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setFlows(s.input)}
      inputsPanel={
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Cash Flows</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12 }}>Use negative amounts for money you put in, positive for money you received back.</div>
          {flows.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input type="date" value={f.date} onChange={e => updateFlow(i, { date: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
              <input type="number" value={f.amount} onChange={e => updateFlow(i, { amount: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, flex: 1 }} placeholder="Amount" />
              <button onClick={() => removeFlow(i)} disabled={flows.length <= 2} style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-red)', cursor: flows.length > 2 ? 'pointer' : 'not-allowed', opacity: flows.length > 2 ? 1 : 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button onClick={addFlow} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-green)', background: 'color-mix(in srgb, var(--text-green) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--text-green) 25%, transparent)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', marginTop: 4 }}>
            <Plus size={12} /> Add Cash Flow
          </button>
        </div>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <ResultStat
              label="Annualized Return (XIRR)"
              value={result.ratePct !== null ? `${result.ratePct.toFixed(2)}%` : 'Not calculable'}
              color={result.ratePct !== null && result.ratePct >= 0 ? 'var(--text-green)' : 'var(--text-red)'}
              size="lg"
            />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
