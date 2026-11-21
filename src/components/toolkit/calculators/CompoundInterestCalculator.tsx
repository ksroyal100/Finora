'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcCompoundInterest, CompoundInterestInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: CompoundInterestInput = {
  principal: 10000,
  monthlyContribution: 500,
  annualRatePct: 8,
  years: 20,
}

export function CompoundInterestCalculator() {
  const [input, setInput] = useState<CompoundInterestInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<CompoundInterestInput, ReturnType<typeof calcCompoundInterest>>('compound-interest')

  const result = useMemo(() => calcCompoundInterest(input), [input])

  const insights = useMemo(() => {
    const list: string[] = []
    const interestShare = result.futureValue > 0 ? (result.totalInterest / result.futureValue) * 100 : 0
    list.push(`${interestShare.toFixed(0)}% of your final balance is compound growth, not money you put in.`)
    const doublingRule = input.annualRatePct > 0 ? 72 / input.annualRatePct : Infinity
    if (Number.isFinite(doublingRule)) {
      list.push(`At ${input.annualRatePct}% your money roughly doubles every ${doublingRule.toFixed(1)} years (Rule of 72).`)
    }
    if (input.monthlyContribution > 0) {
      const withoutContributions = calcCompoundInterest({ ...input, monthlyContribution: 0 })
      const diff = result.futureValue - withoutContributions.futureValue
      list.push(`Your monthly contributions alone add ${formatCurrency(diff, 'USD', true)} to the final balance versus a one-time deposit.`)
    }
    return list
  }, [input, result])

  const update = (patch: Partial<CompoundInterestInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Compound Interest Calculator"
      categoryLabel="Wealth Planning"
      description="See how a starting amount and regular contributions compound into real wealth over time."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Starting Amount" value={input.principal} onChange={v => update({ principal: v })} prefix="$" step={500} />
          <NumberField label="Monthly Contribution" value={input.monthlyContribution} onChange={v => update({ monthlyContribution: v })} prefix="$" step={50} />
          <NumberField label="Expected Annual Return" value={input.annualRatePct} onChange={v => update({ annualRatePct: v })} suffix="%" step={0.5} max={20} showSlider />
          <NumberField label="Time Horizon" value={input.years} onChange={v => update({ years: v })} suffix="yrs" max={50} showSlider />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Future Value" value={formatCurrency(result.futureValue, 'USD', true)} color="var(--text-green)" size="lg" />
              <ResultStat label="Total Contributed" value={formatCurrency(result.totalContributions, 'USD', true)} />
              <ResultStat label="Total Growth" value={formatCurrency(result.totalInterest, 'USD', true)} color="var(--text-blue)" />
            </div>
            <GrowthChart
              data={result.series}
              series={[
                { key: 'balance', color: 'var(--text-green)', label: 'Balance' },
                { key: 'contributed', color: '#8E8E93', label: 'Contributed', type: 'line' },
              ]}
            />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
