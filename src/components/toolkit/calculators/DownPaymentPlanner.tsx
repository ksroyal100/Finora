'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcDownPayment, DownPaymentInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: DownPaymentInput = { homePrice: 400000, downPaymentPct: 20, currentSavings: 15000, monthlySavings: 1500, annualRatePct: 4 }

export function DownPaymentPlanner() {
  const [input, setInput] = useState<DownPaymentInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<DownPaymentInput, ReturnType<typeof calcDownPayment>>('down-payment-planner')
  const result = useMemo(() => calcDownPayment(input), [input])

  const insights = useMemo(() => {
    if (result.monthsToGoal === 0) return ['You already have enough saved for this down payment.']
    if (result.monthsToGoal === -1) return ['At $0 monthly savings and 0% return, this goal is never reached — add a monthly contribution to see a timeline.']
    const years = result.monthsToGoal / 12
    return [`You'll hit your ${formatCurrency(result.targetDownPayment, 'USD', true)} down payment in ${result.monthsToGoal} months (about ${years.toFixed(1)} years).`]
  }, [result])

  const update = (patch: Partial<DownPaymentInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Down Payment Planner"
      categoryLabel="Real Estate"
      description="How long it takes to save your target down payment, given what you have saved and can put away each month."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Home Price" value={input.homePrice} onChange={v => update({ homePrice: v })} prefix="$" step={5000} />
          <NumberField label="Down Payment" value={input.downPaymentPct} onChange={v => update({ downPaymentPct: v })} suffix="%" max={50} showSlider />
          <NumberField label="Current Savings" value={input.currentSavings} onChange={v => update({ currentSavings: v })} prefix="$" step={500} />
          <NumberField label="Monthly Savings" value={input.monthlySavings} onChange={v => update({ monthlySavings: v })} prefix="$" step={50} />
          <NumberField label="Savings Account Return" value={input.annualRatePct} onChange={v => update({ annualRatePct: v })} suffix="%" step={0.25} max={10} showSlider />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Target Down Payment" value={formatCurrency(result.targetDownPayment, 'USD', true)} color="var(--text-green)" size="lg" />
              <ResultStat
                label="Time to Goal"
                value={result.monthsToGoal === -1 ? 'Not reachable' : result.monthsToGoal === 0 ? 'Already there' : `${result.monthsToGoal} mo`}
                color="var(--text-blue)" size="lg"
              />
            </div>
            {result.series.length > 1 && (
              <GrowthChart data={result.series} series={[{ key: 'balance', color: 'var(--text-green)', label: 'Savings' }]} />
            )}
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
