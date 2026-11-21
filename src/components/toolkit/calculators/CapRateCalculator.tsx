'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { formatCurrency } from '@/lib/utils'
import { calcCapRate, CapRateInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: CapRateInput = { propertyValue: 400000, annualGrossIncome: 42000, annualOperatingExpenses: 15000 }

export function CapRateCalculator() {
  const [input, setInput] = useState<CapRateInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<CapRateInput, ReturnType<typeof calcCapRate>>('cap-rate')
  const result = useMemo(() => calcCapRate(input), [input])

  const insights = useMemo(() => {
    if (result.capRatePct >= 8) return ['A cap rate above 8% typically signals higher risk or a less competitive market — worth investigating why.']
    if (result.capRatePct <= 4) return ['A cap rate this low usually means a competitive, low-risk market — you\'re likely paying for appreciation potential, not current income.']
    return ['A cap rate in the 5–7% range is typical for a stabilized property in most US markets.']
  }, [result])

  const update = (patch: Partial<CapRateInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Cap Rate Calculator"
      categoryLabel="Real Estate"
      description="Net operating income as a percentage of property value — the standard way to compare income properties regardless of financing."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Property Value" value={input.propertyValue} onChange={v => update({ propertyValue: v })} prefix="$" step={5000} />
          <NumberField label="Annual Gross Income" value={input.annualGrossIncome} onChange={v => update({ annualGrossIncome: v })} prefix="$" step={500} />
          <NumberField label="Annual Operating Expenses" value={input.annualOperatingExpenses} onChange={v => update({ annualOperatingExpenses: v })} prefix="$" step={500} hint="Excludes mortgage payments" />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Cap Rate" value={`${result.capRatePct.toFixed(2)}%`} color="var(--text-green)" size="lg" />
              <ResultStat label="Net Operating Income" value={formatCurrency(result.netOperatingIncome, 'USD', true)} color="var(--text-blue)" size="lg" />
            </div>
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
