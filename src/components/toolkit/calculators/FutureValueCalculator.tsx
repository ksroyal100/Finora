'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcFutureValue, FutureValueInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: FutureValueInput = { presentValue: 10000, annualRatePct: 8, years: 20 }

export function FutureValueCalculator() {
  const [input, setInput] = useState<FutureValueInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<FutureValueInput, ReturnType<typeof calcFutureValue>>('future-value')
  const result = useMemo(() => calcFutureValue(input), [input])

  const insights = useMemo(() => {
    const list: string[] = []
    const multiple = input.presentValue > 0 ? result.futureValue / input.presentValue : 0
    list.push(`Your money multiplies ${multiple.toFixed(1)}x over ${input.years} years at ${input.annualRatePct}% annually.`)
    const doublingYears = input.annualRatePct > 0 ? 72 / input.annualRatePct : Infinity
    if (Number.isFinite(doublingYears)) list.push(`At this rate, your money roughly doubles every ${doublingYears.toFixed(1)} years (Rule of 72).`)
    return list
  }, [input, result])

  const update = (patch: Partial<FutureValueInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Future Value Calculator"
      categoryLabel="Wealth Planning"
      description="What a lump sum today grows to by a future date, at a given rate of return."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Present Value" value={input.presentValue} onChange={v => update({ presentValue: v })} prefix="$" step={500} />
          <NumberField label="Expected Annual Return" value={input.annualRatePct} onChange={v => update({ annualRatePct: v })} suffix="%" step={0.5} max={20} showSlider />
          <NumberField label="Time Horizon" value={input.years} onChange={v => update({ years: v })} suffix="yrs" max={50} showSlider />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Future Value" value={formatCurrency(result.futureValue, 'USD', true)} color="var(--text-green)" size="lg" />
              <ResultStat label="Total Growth" value={formatCurrency(result.totalGrowth, 'USD', true)} color="var(--text-blue)" size="lg" />
            </div>
            <GrowthChart data={result.series} series={[{ key: 'value', color: 'var(--text-green)', label: 'Value' }]} />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
