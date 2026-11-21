'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcPresentValue, PresentValueInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: PresentValueInput = { futureValue: 100000, annualRatePct: 8, years: 20 }

export function PresentValueCalculator() {
  const [input, setInput] = useState<PresentValueInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<PresentValueInput, ReturnType<typeof calcPresentValue>>('present-value')
  const result = useMemo(() => calcPresentValue(input), [input])

  const insights = useMemo(() => {
    const discountPct = input.futureValue > 0 ? (result.totalDiscount / input.futureValue) * 100 : 0
    return [`Waiting ${input.years} years to receive this money means it's worth ${discountPct.toFixed(0)}% less in today's dollars, at a ${input.annualRatePct}% discount rate.`]
  }, [input, result])

  const update = (patch: Partial<PresentValueInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Present Value Calculator"
      categoryLabel="Wealth Planning"
      description="What a future sum of money is actually worth in today's dollars, given a discount rate."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Future Value" value={input.futureValue} onChange={v => update({ futureValue: v })} prefix="$" step={1000} />
          <NumberField label="Discount Rate" value={input.annualRatePct} onChange={v => update({ annualRatePct: v })} suffix="%" step={0.5} max={20} showSlider hint="Your expected return elsewhere" />
          <NumberField label="Years Until Received" value={input.years} onChange={v => update({ years: v })} suffix="yrs" max={50} showSlider />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Present Value" value={formatCurrency(result.presentValue, 'USD', true)} color="var(--text-green)" size="lg" />
              <ResultStat label="Total Discount" value={formatCurrency(result.totalDiscount, 'USD', true)} color="var(--text-orange)" size="lg" />
            </div>
            <GrowthChart data={result.series} series={[{ key: 'value', color: 'var(--text-green)', label: 'Value' }]} />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
