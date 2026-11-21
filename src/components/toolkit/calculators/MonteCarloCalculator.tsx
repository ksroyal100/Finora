'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcMonteCarlo, MonteCarloInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: MonteCarloInput = { initialInvestment: 50000, annualContribution: 6000, years: 25, expectedReturnPct: 8, volatilityPct: 15, simulations: 500 }

export function MonteCarloCalculator() {
  const [input, setInput] = useState<MonteCarloInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<MonteCarloInput, ReturnType<typeof calcMonteCarlo>>('monte-carlo-simulation')
  const result = useMemo(() => calcMonteCarlo(input), [input])

  const insights = useMemo(() => [
    `Across ${input.simulations} simulated market paths, the median outcome is ${formatCurrency(result.median, 'USD', true)}, with a realistic range from ${formatCurrency(result.percentile10, 'USD', true)} (unlucky) to ${formatCurrency(result.percentile90, 'USD', true)} (lucky).`,
    `${result.successRatePct.toFixed(0)}% of simulated paths ended above your starting balance — this uses a simplified normal-distribution random walk, not real historical market sequences, so treat it as illustrative of *range*, not a precise forecast.`,
  ], [input, result])

  const update = (patch: Partial<MonteCarloInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Monte Carlo Simulation"
      categoryLabel="Investment Toolkit"
      description="A probabilistic range of outcomes for a portfolio, accounting for return volatility instead of a single fixed rate."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Initial Investment" value={input.initialInvestment} onChange={v => update({ initialInvestment: v })} prefix="$" step={1000} />
          <NumberField label="Annual Contribution" value={input.annualContribution} onChange={v => update({ annualContribution: v })} prefix="$" step={500} />
          <NumberField label="Time Horizon" value={input.years} onChange={v => update({ years: v })} suffix="yrs" max={40} showSlider />
          <NumberField label="Expected Annual Return" value={input.expectedReturnPct} onChange={v => update({ expectedReturnPct: v })} suffix="%" step={0.5} max={15} showSlider />
          <NumberField label="Volatility (Std. Deviation)" value={input.volatilityPct} onChange={v => update({ volatilityPct: v })} suffix="%" step={1} max={40} showSlider hint="~15% is typical for a diversified stock portfolio" />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="10th Percentile" value={formatCurrency(result.percentile10, 'USD', true)} color="var(--text-red)" />
              <ResultStat label="Median" value={formatCurrency(result.median, 'USD', true)} color="var(--text-green)" size="lg" />
              <ResultStat label="90th Percentile" value={formatCurrency(result.percentile90, 'USD', true)} color="var(--text-gold)" />
            </div>
            <GrowthChart data={result.series} series={[{ key: 'balance', color: 'var(--text-green)', label: 'Median Path' }]} />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
