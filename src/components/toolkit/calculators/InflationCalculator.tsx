'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcInflation, InflationInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: InflationInput = { amount: 10000, annualInflationPct: 3.5, years: 20 }

export function InflationCalculator() {
  const [input, setInput] = useState<InflationInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<InflationInput, ReturnType<typeof calcInflation>>('inflation-calculator')
  const result = useMemo(() => calcInflation(input), [input])

  const insights = useMemo(() => [
    `${formatCurrency(input.amount, 'USD', true)} today will need to become ${formatCurrency(result.futureCost, 'USD', true)} in ${input.years} years just to buy the same things.`,
    `Put another way: today's ${formatCurrency(input.amount, 'USD', true)} will only buy what ${formatCurrency(result.purchasingPowerRemaining, 'USD', true)} buys today, once it's had ${input.years} years of inflation applied.`,
  ], [input, result])

  const update = (patch: Partial<InflationInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Inflation Calculator"
      categoryLabel="Wealth Planning"
      description="See how inflation erodes purchasing power over time — and what today's money will need to become to keep up."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Amount Today" value={input.amount} onChange={v => update({ amount: v })} prefix="$" step={500} />
          <NumberField label="Annual Inflation Rate" value={input.annualInflationPct} onChange={v => update({ annualInflationPct: v })} suffix="%" step={0.1} max={15} showSlider />
          <NumberField label="Time Horizon" value={input.years} onChange={v => update({ years: v })} suffix="yrs" max={50} showSlider />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Future Cost of Same Goods" value={formatCurrency(result.futureCost, 'USD', true)} color="var(--text-red)" size="lg" />
              <ResultStat label="Purchasing Power Lost" value={`${result.purchasingPowerLostPct.toFixed(1)}%`} color="var(--text-orange)" size="lg" />
            </div>
            <GrowthChart
              data={result.series}
              series={[
                { key: 'futureCost', color: 'var(--text-red)', label: 'Cost to Match Today' },
                { key: 'purchasingPower', color: 'var(--text-orange)', label: 'Value of Today\'s $', type: 'line' },
              ]}
            />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
