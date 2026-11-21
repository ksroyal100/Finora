'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcFire, FireInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: FireInput = {
  currentAge: 32, currentAnnualExpenses: 55000, currentInvestments: 60000,
  monthlySavings: 2500, expectedReturnPct: 7, inflationPct: 3, safeWithdrawalRatePct: 4,
}

export function FinancialFreedomTimeline() {
  const [input, setInput] = useState<FireInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<FireInput, ReturnType<typeof calcFire>>('financial-freedom-timeline')
  const result = useMemo(() => calcFire(input), [input])

  const insights = useMemo(() => {
    if (result.yearsToFire === null) return ['At this pace, financial independence isn\'t reached within 80 years — try increasing savings or expected return.']
    return [`Your timeline to financial freedom is ${result.yearsToFire} years — around age ${result.fireAge} — assuming your expenses and savings rate stay roughly the same.`]
  }, [result])

  const update = (patch: Partial<FireInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Financial Freedom Timeline"
      categoryLabel="Wealth Planning"
      description="The year-by-year path to the point where your investments can fully cover your expenses."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Current Age" value={input.currentAge} onChange={v => update({ currentAge: v })} max={80} showSlider />
          <NumberField label="Current Annual Expenses" value={input.currentAnnualExpenses} onChange={v => update({ currentAnnualExpenses: v })} prefix="$" step={1000} />
          <NumberField label="Current Investments" value={input.currentInvestments} onChange={v => update({ currentInvestments: v })} prefix="$" step={1000} />
          <NumberField label="Monthly Savings" value={input.monthlySavings} onChange={v => update({ monthlySavings: v })} prefix="$" step={100} />
          <NumberField label="Expected Annual Return" value={input.expectedReturnPct} onChange={v => update({ expectedReturnPct: v })} suffix="%" step={0.5} max={15} showSlider />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Freedom Number" value={formatCurrency(result.fireNumber, 'USD', true)} color="var(--text-green)" size="lg" />
              <ResultStat label="Years to Freedom" value={result.yearsToFire !== null ? `${result.yearsToFire} yrs` : '80+ yrs'} color="var(--text-blue)" size="lg" />
            </div>
            <GrowthChart data={result.series} series={[{ key: 'balance', color: 'var(--text-green)', label: 'Balance' }]} />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
