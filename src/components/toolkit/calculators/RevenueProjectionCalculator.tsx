'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'
import type { SeriesPoint } from '@/lib/toolkit/engine'

interface RevenueProjectionInput { currentMrr: number; monthlyGrowthPct: number; months: number }

function project(input: RevenueProjectionInput) {
  const series: SeriesPoint[] = []
  let mrr = input.currentMrr
  for (let m = 0; m <= input.months; m++) {
    series.push({ year: m, label: m === 0 ? 'Now' : `Mo ${m}`, mrr: Math.round(mrr * 100) / 100 })
    mrr *= 1 + input.monthlyGrowthPct / 100
  }
  const finalMrr = (series[series.length - 1]?.mrr as number) ?? input.currentMrr
  return { finalMrr, finalArr: finalMrr * 12, series }
}

const DEFAULT_INPUT: RevenueProjectionInput = { currentMrr: 20000, monthlyGrowthPct: 8, months: 24 }

export function RevenueProjectionCalculator() {
  const [input, setInput] = useState<RevenueProjectionInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<RevenueProjectionInput, ReturnType<typeof project>>('revenue-projection')
  const result = useMemo(() => project(input), [input])

  const insights = useMemo(() => [
    `At ${input.monthlyGrowthPct}% month-over-month growth, your MRR compounds from ${formatCurrency(input.currentMrr, 'USD', true)} to ${formatCurrency(result.finalMrr, 'USD', true)} over ${input.months} months.`,
    'This assumes a constant growth rate — real growth curves usually slow as you scale, so treat this as a best-case trajectory.',
  ], [input, result])

  const update = (patch: Partial<RevenueProjectionInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Revenue Projection"
      categoryLabel="Startup & Business"
      description="Project future MRR/ARR forward from a constant month-over-month growth rate."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Current MRR" value={input.currentMrr} onChange={v => update({ currentMrr: v })} prefix="$" step={500} />
          <NumberField label="Monthly Growth Rate" value={input.monthlyGrowthPct} onChange={v => update({ monthlyGrowthPct: v })} suffix="%" step={0.5} max={30} showSlider />
          <NumberField label="Projection Length" value={input.months} onChange={v => update({ months: v })} suffix="mo" max={60} showSlider />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Projected MRR" value={formatCurrency(result.finalMrr, 'USD', true)} color="var(--text-green)" size="lg" />
              <ResultStat label="Projected ARR" value={formatCurrency(result.finalArr, 'USD', true)} color="var(--text-blue)" size="lg" />
            </div>
            <GrowthChart data={result.series} series={[{ key: 'mrr', color: 'var(--text-green)', label: 'MRR' }]} />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
