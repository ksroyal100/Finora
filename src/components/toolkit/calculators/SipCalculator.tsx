'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcSip, SipInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: SipInput = { monthlyInvestment: 500, annualReturnPct: 10, years: 15, annualStepUpPct: 0 }

export function SipCalculator() {
  const [input, setInput] = useState<SipInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<SipInput, ReturnType<typeof calcSip>>('sip-calculator')
  const result = useMemo(() => calcSip(input), [input])

  const insights = useMemo(() => {
    const list: string[] = []
    const gainShare = result.futureValue > 0 ? (result.totalGains / result.futureValue) * 100 : 0
    list.push(`${gainShare.toFixed(0)}% of your final corpus comes from market returns, not your own contributions.`)
    if (!input.annualStepUpPct) {
      const stepUp = calcSip({ ...input, annualStepUpPct: 10 })
      list.push(`Stepping up your SIP by 10% each year would grow this to ${formatCurrency(stepUp.futureValue, 'USD', true)} — ${formatCurrency(stepUp.futureValue - result.futureValue, 'USD', true)} more.`)
    }
    return list
  }, [input, result])

  const update = (patch: Partial<SipInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="SIP Calculator"
      categoryLabel="Investment Toolkit"
      description="Project a recurring monthly investment forward, with an optional annual step-up in contribution size."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Monthly Investment" value={input.monthlyInvestment} onChange={v => update({ monthlyInvestment: v })} prefix="$" step={50} />
          <NumberField label="Expected Annual Return" value={input.annualReturnPct} onChange={v => update({ annualReturnPct: v })} suffix="%" step={0.5} max={20} showSlider />
          <NumberField label="Time Horizon" value={input.years} onChange={v => update({ years: v })} suffix="yrs" max={40} showSlider />
          <NumberField label="Annual Step-Up" value={input.annualStepUpPct ?? 0} onChange={v => update({ annualStepUpPct: v })} suffix="%" max={25} showSlider hint="Increase contribution each year" />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Future Value" value={formatCurrency(result.futureValue, 'USD', true)} color="var(--text-green)" size="lg" />
              <ResultStat label="Total Invested" value={formatCurrency(result.totalInvested, 'USD', true)} />
              <ResultStat label="Total Gains" value={formatCurrency(result.totalGains, 'USD', true)} color="var(--text-blue)" />
            </div>
            <GrowthChart
              data={result.series}
              series={[
                { key: 'balance', color: 'var(--text-green)', label: 'Balance' },
                { key: 'invested', color: '#8E8E93', label: 'Invested', type: 'line' },
              ]}
            />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
