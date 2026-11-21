'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcSavingsGoal, SavingsGoalInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: SavingsGoalInput = { targetAmount: 50000, currentSavings: 5000, annualRatePct: 4, years: 5 }

export function SavingsGoalPlanner() {
  const [input, setInput] = useState<SavingsGoalInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<SavingsGoalInput, ReturnType<typeof calcSavingsGoal>>('savings-goal-planner')
  const result = useMemo(() => calcSavingsGoal(input), [input])

  const insights = useMemo(() => {
    const list: string[] = []
    list.push(`Saving ${formatCurrency(result.requiredMonthlySavings, 'USD', true)}/month gets you to ${formatCurrency(input.targetAmount, 'USD', true)} in ${input.years} years.`)
    const gainShare = result.totalContributions + result.totalGrowth > 0 ? (result.totalGrowth / (result.totalContributions + result.totalGrowth)) * 100 : 0
    list.push(`${gainShare.toFixed(0)}% of your final balance comes from growth, not contributions.`)
    return list
  }, [input, result])

  const update = (patch: Partial<SavingsGoalInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Savings Goal Planner"
      categoryLabel="Wealth Planning"
      description="Reverse-engineer the monthly savings needed to reach any target amount by a given date."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Target Amount" value={input.targetAmount} onChange={v => update({ targetAmount: v })} prefix="$" step={1000} />
          <NumberField label="Current Savings" value={input.currentSavings} onChange={v => update({ currentSavings: v })} prefix="$" step={500} />
          <NumberField label="Expected Annual Return" value={input.annualRatePct} onChange={v => update({ annualRatePct: v })} suffix="%" step={0.5} max={15} showSlider />
          <NumberField label="Time to Goal" value={input.years} onChange={v => update({ years: v })} suffix="yrs" max={40} showSlider />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Required Monthly Savings" value={formatCurrency(result.requiredMonthlySavings, 'USD', true)} color="var(--text-green)" size="lg" />
              <ResultStat label="Total Growth" value={formatCurrency(result.totalGrowth, 'USD', true)} color="var(--text-blue)" size="lg" />
            </div>
            <GrowthChart data={result.series} series={[{ key: 'balance', color: 'var(--text-green)', label: 'Balance' }]} />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
