'use client'

import { useEffect, useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcEmergencyFund, EmergencyFundInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'
import { useSmartDefaults } from '@/lib/toolkit/useSmartDefaults'

const DEFAULT_INPUT: EmergencyFundInput = {
  monthlyExpenses: 3200,
  targetMonths: 6,
  currentSavings: 2000,
  monthlySavingsContribution: 300,
  savingsAccountReturnPct: 4,
}

export function EmergencyFundPlanner() {
  const [input, setInput] = useState<EmergencyFundInput>(DEFAULT_INPUT)
  const [appliedSmartDefaults, setAppliedSmartDefaults] = useState(false)
  const smart = useSmartDefaults()
  const { scenarios, save, remove, duplicate } = useToolkitHistory<EmergencyFundInput, ReturnType<typeof calcEmergencyFund>>('emergency-fund-planner')
  const result = useMemo(() => calcEmergencyFund(input), [input])

  // Pull real numbers from the user's budget + cash assets once, on load
  useEffect(() => {
    if (appliedSmartDefaults || smart.loading) return
    setInput(prev => ({
      ...prev,
      monthlyExpenses: smart.monthlyExpenses && smart.monthlyExpenses > 0 ? Math.round(smart.monthlyExpenses) : prev.monthlyExpenses,
      currentSavings: smart.cashSavings !== null ? Math.round(smart.cashSavings) : prev.currentSavings,
    }))
    setAppliedSmartDefaults(true)
  }, [smart, appliedSmartDefaults])

  const insights = useMemo(() => {
    const list: string[] = []
    list.push(`You currently have ${result.currentCoverageMonths.toFixed(1)} months of expenses covered — the goal is ${input.targetMonths}.`)
    if (result.shortfall > 0 && result.monthsToTarget !== null) {
      list.push(`Saving ${formatCurrency(input.monthlySavingsContribution, 'USD', true)}/mo gets you to your target in ${result.monthsToTarget} months.`)
    } else if (result.shortfall <= 0) {
      list.push('You\u2019ve already hit your emergency fund target — consider directing extra savings toward investing instead.')
    }
    if (input.targetMonths < 3) list.push('Most planners recommend at least 3–6 months of expenses as a baseline safety net.')
    return list
  }, [input, result])

  const update = (patch: Partial<EmergencyFundInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Emergency Fund Planner"
      categoryLabel="Wealth Planning"
      description="Right-size your safety net and see exactly how long it'll take to fill it, using your real expenses."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField
            label="Monthly Expenses" value={input.monthlyExpenses} onChange={v => update({ monthlyExpenses: v })}
            prefix="$" step={100}
            hint={smart.monthlyExpenses ? 'Auto-filled from your budget' : undefined}
          />
          <NumberField label="Target Coverage" value={input.targetMonths} onChange={v => update({ targetMonths: v })} suffix="mo" max={12} showSlider />
          <NumberField
            label="Current Emergency Savings" value={input.currentSavings} onChange={v => update({ currentSavings: v })}
            prefix="$" step={100}
            hint={smart.cashSavings !== null ? 'Auto-filled from your cash assets' : undefined}
          />
          <NumberField label="Monthly Contribution" value={input.monthlySavingsContribution} onChange={v => update({ monthlySavingsContribution: v })} prefix="$" step={25} />
          <NumberField label="Savings Account Return" value={input.savingsAccountReturnPct ?? 0} onChange={v => update({ savingsAccountReturnPct: v })} suffix="%" step={0.25} max={6} showSlider />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Target Fund" value={formatCurrency(result.targetAmount, 'USD', true)} color="var(--text-green)" size="lg" />
              <ResultStat label="Current Coverage" value={`${result.currentCoverageMonths.toFixed(1)} mo`} />
              <ResultStat label="Time to Target" value={result.monthsToTarget !== null ? `${result.monthsToTarget} mo` : '20+ yrs'} color="var(--text-blue)" />
            </div>
            <GrowthChart
              data={result.series}
              series={[
                { key: 'balance', color: 'var(--text-green)', label: 'Fund Balance' },
                { key: 'target', color: 'var(--text-blue)', label: 'Target', type: 'line' },
              ]}
            />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
