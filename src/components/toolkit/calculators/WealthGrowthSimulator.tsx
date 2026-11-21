'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'
import type { SeriesPoint } from '@/lib/toolkit/engine'

interface WealthGrowthInput { startingBalance: number; monthlyContribution: number; years: number; conservativeReturnPct: number; moderateReturnPct: number; aggressiveReturnPct: number }

function simulate(input: WealthGrowthInput) {
  const rates = { conservative: input.conservativeReturnPct, moderate: input.moderateReturnPct, aggressive: input.aggressiveReturnPct }
  const balances = { conservative: input.startingBalance, moderate: input.startingBalance, aggressive: input.startingBalance }
  const series: SeriesPoint[] = [{ year: 0, label: 'Now', conservative: input.startingBalance, moderate: input.startingBalance, aggressive: input.startingBalance }]

  for (let y = 1; y <= input.years; y++) {
    for (const key of ['conservative', 'moderate', 'aggressive'] as const) {
      const r = rates[key] / 100 / 12
      for (let m = 0; m < 12; m++) balances[key] = balances[key] * (1 + r) + input.monthlyContribution
    }
    series.push({ year: y, label: `Yr ${y}`, conservative: Math.round(balances.conservative), moderate: Math.round(balances.moderate), aggressive: Math.round(balances.aggressive) })
  }
  return { finalConservative: balances.conservative, finalModerate: balances.moderate, finalAggressive: balances.aggressive, series }
}

const DEFAULT_INPUT: WealthGrowthInput = { startingBalance: 20000, monthlyContribution: 800, years: 25, conservativeReturnPct: 4, moderateReturnPct: 7, aggressiveReturnPct: 10 }

export function WealthGrowthSimulator() {
  const [input, setInput] = useState<WealthGrowthInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<WealthGrowthInput, ReturnType<typeof simulate>>('wealth-growth-simulator')
  const result = useMemo(() => simulate(input), [input])

  const insights = useMemo(() => [
    `The gap between a conservative (${input.conservativeReturnPct}%) and aggressive (${input.aggressiveReturnPct}%) allocation is ${formatCurrency(result.finalAggressive - result.finalConservative, 'USD', true)} over ${input.years} years — the same contributions, a very different outcome.`,
  ], [input, result])

  const update = (patch: Partial<WealthGrowthInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Wealth Growth Simulator"
      categoryLabel="Wealth Planning"
      description="Compare conservative, moderate, and aggressive allocation strategies side by side with the same contributions."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Starting Balance" value={input.startingBalance} onChange={v => update({ startingBalance: v })} prefix="$" step={1000} />
          <NumberField label="Monthly Contribution" value={input.monthlyContribution} onChange={v => update({ monthlyContribution: v })} prefix="$" step={50} />
          <NumberField label="Time Horizon" value={input.years} onChange={v => update({ years: v })} suffix="yrs" max={40} showSlider />
          <NumberField label="Conservative Return" value={input.conservativeReturnPct} onChange={v => update({ conservativeReturnPct: v })} suffix="%" step={0.5} max={10} showSlider />
          <NumberField label="Moderate Return" value={input.moderateReturnPct} onChange={v => update({ moderateReturnPct: v })} suffix="%" step={0.5} max={12} showSlider />
          <NumberField label="Aggressive Return" value={input.aggressiveReturnPct} onChange={v => update({ aggressiveReturnPct: v })} suffix="%" step={0.5} max={16} showSlider />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Conservative" value={formatCurrency(result.finalConservative, 'USD', true)} color="var(--text-blue)" />
              <ResultStat label="Moderate" value={formatCurrency(result.finalModerate, 'USD', true)} color="var(--text-green)" size="lg" />
              <ResultStat label="Aggressive" value={formatCurrency(result.finalAggressive, 'USD', true)} color="var(--text-gold)" />
            </div>
            <GrowthChart
              data={result.series}
              series={[
                { key: 'conservative', color: 'var(--text-blue)', label: 'Conservative' },
                { key: 'moderate', color: 'var(--text-green)', label: 'Moderate' },
                { key: 'aggressive', color: 'var(--text-gold)', label: 'Aggressive' },
              ]}
            />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
