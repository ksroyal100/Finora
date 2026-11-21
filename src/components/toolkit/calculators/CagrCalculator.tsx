'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcCagr, CagrInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: CagrInput = { initialValue: 10000, finalValue: 25000, years: 7 }

export function CagrCalculator() {
  const [input, setInput] = useState<CagrInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<CagrInput, ReturnType<typeof calcCagr>>('cagr-calculator')
  const result = useMemo(() => calcCagr(input), [input])

  const chartData = useMemo(() => {
    const points = []
    for (let y = 0; y <= input.years; y++) {
      const value = input.initialValue * Math.pow(1 + result.cagrPct / 100, y)
      points.push({ year: y, label: `Yr ${y}`, value: Math.round(value) })
    }
    return points
  }, [input, result])

  const insights = useMemo(() => [
    `A ${result.cagrPct.toFixed(1)}% CAGR means this investment behaved as if it grew at a steady ${result.cagrPct.toFixed(1)}% every single year.`,
    result.cagrPct >= 15
      ? 'That\u2019s a strong annualized return — well above the long-run stock market average of roughly 7–10%.'
      : result.cagrPct >= 7
      ? 'That\u2019s in line with typical long-run equity market returns.'
      : 'That\u2019s below typical long-run equity returns — worth checking what drove the underperformance.',
  ], [result])

  const update = (patch: Partial<CagrInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="CAGR Calculator"
      categoryLabel="Investment Toolkit"
      description="Turn a start value, end value, and number of years into a single annualized growth rate."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Initial Value" value={input.initialValue} onChange={v => update({ initialValue: v })} prefix="$" step={500} />
          <NumberField label="Final Value" value={input.finalValue} onChange={v => update({ finalValue: v })} prefix="$" step={500} />
          <NumberField label="Number of Years" value={input.years} onChange={v => update({ years: v })} suffix="yrs" max={40} showSlider />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="CAGR" value={`${result.cagrPct.toFixed(2)}%`} color="var(--text-green)" size="lg" />
              <ResultStat label="Absolute Gain" value={formatCurrency(result.absoluteGain, 'USD', true)} />
              <ResultStat label="Total Return" value={`${result.absoluteGainPct.toFixed(1)}%`} color="var(--text-blue)" />
            </div>
            <GrowthChart data={chartData} series={[{ key: 'value', color: 'var(--text-green)', label: 'Value' }]} />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
