'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcLumpSum, LumpSumInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: LumpSumInput = { investmentAmount: 25000, annualReturnPct: 9, years: 15 }

export function LumpSumCalculator() {
  const [input, setInput] = useState<LumpSumInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<LumpSumInput, ReturnType<typeof calcLumpSum>>('lump-sum-calculator')
  const result = useMemo(() => calcLumpSum(input), [input])

  const insights = useMemo(() => {
    const multiple = input.investmentAmount > 0 ? result.futureValue / input.investmentAmount : 0
    return [`A one-time ${formatCurrency(input.investmentAmount, 'USD', true)} investment grows ${multiple.toFixed(1)}x to ${formatCurrency(result.futureValue, 'USD', true)} over ${input.years} years at ${input.annualReturnPct}% annually.`]
  }, [input, result])

  const update = (patch: Partial<LumpSumInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Lump Sum Calculator"
      categoryLabel="Investment Toolkit"
      description="Project the growth of a one-time investment at a fixed annual return, no recurring contributions."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Investment Amount" value={input.investmentAmount} onChange={v => update({ investmentAmount: v })} prefix="$" step={500} />
          <NumberField label="Expected Annual Return" value={input.annualReturnPct} onChange={v => update({ annualReturnPct: v })} suffix="%" step={0.5} max={20} showSlider />
          <NumberField label="Time Horizon" value={input.years} onChange={v => update({ years: v })} suffix="yrs" max={40} showSlider />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Future Value" value={formatCurrency(result.futureValue, 'USD', true)} color="var(--text-green)" size="lg" />
              <ResultStat label="Total Gains" value={formatCurrency(result.totalGains, 'USD', true)} color="var(--text-blue)" size="lg" />
            </div>
            <GrowthChart data={result.series} series={[{ key: 'balance', color: 'var(--text-green)', label: 'Balance' }]} />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
