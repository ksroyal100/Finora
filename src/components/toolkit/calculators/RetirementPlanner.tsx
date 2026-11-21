'use client'

import { useEffect, useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcRetirement, RetirementInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'
import { useSmartDefaults } from '@/lib/toolkit/useSmartDefaults'

const DEFAULT_INPUT: RetirementInput = {
  currentAge: 30,
  retirementAge: 65,
  lifeExpectancy: 90,
  currentSavings: 25000,
  monthlyContribution: 800,
  expectedReturnPct: 8,
  inflationPct: 3,
  desiredMonthlyIncomeToday: 5000,
}

export function RetirementPlanner() {
  const [input, setInput] = useState<RetirementInput>(DEFAULT_INPUT)
  const [appliedSmartDefaults, setAppliedSmartDefaults] = useState(false)
  const smart = useSmartDefaults()
  const { scenarios, save, remove, duplicate } = useToolkitHistory<RetirementInput, ReturnType<typeof calcRetirement>>('retirement-planner')
  const result = useMemo(() => calcRetirement(input), [input])

  // Pre-fill current savings from the user's real portfolio + net worth once, on load
  useEffect(() => {
    if (appliedSmartDefaults || smart.loading) return
    const investable = (smart.portfolioValue ?? 0) + (smart.totalAssets ?? 0) - (smart.totalLiabilities ?? 0)
    if (investable > 0) {
      setInput(prev => ({ ...prev, currentSavings: Math.round(Math.max(investable, 0)) }))
    }
    setAppliedSmartDefaults(true)
  }, [smart, appliedSmartDefaults])

  const insights = useMemo(() => {
    const list: string[] = []
    if (result.surplusOrGap >= 0) {
      list.push(`You're on track — projected to have ${formatCurrency(result.surplusOrGap, 'USD', true)} more than you need at retirement.`)
    } else {
      list.push(`You're projected to be ${formatCurrency(Math.abs(result.surplusOrGap), 'USD', true)} short. Adding ${formatCurrency(result.additionalMonthlyContributionNeeded, 'USD', true)}/mo would close the gap.`)
    }
    list.push(`In today's dollars you want ${formatCurrency(input.desiredMonthlyIncomeToday, 'USD', true)}/mo — inflation grows that to ${formatCurrency(result.monthlyIncomeAtRetirement, 'USD', true)}/mo by age ${input.retirementAge}.`)
    list.push(`Your money needs to last ${result.retirementDurationYears} years in retirement, to age ${input.lifeExpectancy}.`)
    return list
  }, [input, result])

  const update = (patch: Partial<RetirementInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Retirement Planner"
      categoryLabel="Wealth Planning"
      description="Work out the corpus you'll need in retirement, and whether your current plan gets you there."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Current Age" value={input.currentAge} onChange={v => update({ currentAge: v })} max={80} showSlider />
          <NumberField label="Retirement Age" value={input.retirementAge} onChange={v => update({ retirementAge: v })} max={85} showSlider />
          <NumberField label="Life Expectancy" value={input.lifeExpectancy} onChange={v => update({ lifeExpectancy: v })} max={110} showSlider />
          <NumberField
            label="Current Savings & Investments" value={input.currentSavings} onChange={v => update({ currentSavings: v })}
            prefix="$" step={1000}
            hint={smart.portfolioValue || smart.totalAssets ? 'Auto-filled from your account' : undefined}
          />
          <NumberField label="Monthly Contribution" value={input.monthlyContribution} onChange={v => update({ monthlyContribution: v })} prefix="$" step={50} />
          <NumberField label="Desired Monthly Income (today's $)" value={input.desiredMonthlyIncomeToday} onChange={v => update({ desiredMonthlyIncomeToday: v })} prefix="$" step={250} />
          <NumberField label="Expected Annual Return" value={input.expectedReturnPct} onChange={v => update({ expectedReturnPct: v })} suffix="%" step={0.5} max={15} showSlider />
          <NumberField label="Expected Inflation" value={input.inflationPct} onChange={v => update({ inflationPct: v })} suffix="%" step={0.25} max={10} showSlider />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Corpus Needed at Retirement" value={formatCurrency(result.requiredCorpus, 'USD', true)} color="var(--text-blue)" size="lg" />
              <ResultStat
                label="Projected Corpus"
                value={formatCurrency(result.projectedCorpus, 'USD', true)}
                color={result.surplusOrGap >= 0 ? 'var(--text-green)' : 'var(--text-red)'}
                size="lg"
              />
            </div>
            <GrowthChart
              data={result.series}
              series={[
                { key: 'balance', color: 'var(--text-green)', label: 'Projected' },
                { key: 'target', color: 'var(--text-blue)', label: 'Needed', type: 'line' },
              ]}
            />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
