'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcSwp, SwpInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: SwpInput = { corpus: 500000, monthlyWithdrawal: 2500, annualRatePct: 6 }

export function SwpCalculator() {
  const [input, setInput] = useState<SwpInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<SwpInput, ReturnType<typeof calcSwp>>('swp-calculator')
  const result = useMemo(() => calcSwp(input), [input])

  const insights = useMemo(() => {
    if (result.monthsLasting === -1) return [`At ${formatCurrency(input.monthlyWithdrawal, 'USD', true)}/month, growth at ${input.annualRatePct}% outpaces withdrawals — this corpus can sustain withdrawals indefinitely.`]
    const years = result.monthsLasting / 12
    return [`At ${formatCurrency(input.monthlyWithdrawal, 'USD', true)}/month, this corpus lasts ${result.monthsLasting} months (about ${years.toFixed(1)} years) before running out.`]
  }, [input, result])

  const update = (patch: Partial<SwpInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="SWP Calculator"
      categoryLabel="Investment Toolkit"
      description="How long an invested lump sum lasts under regular monthly withdrawals — the reverse of a SIP."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Starting Corpus" value={input.corpus} onChange={v => update({ corpus: v })} prefix="$" step={5000} />
          <NumberField label="Monthly Withdrawal" value={input.monthlyWithdrawal} onChange={v => update({ monthlyWithdrawal: v })} prefix="$" step={100} />
          <NumberField label="Expected Annual Return" value={input.annualRatePct} onChange={v => update({ annualRatePct: v })} suffix="%" step={0.5} max={15} showSlider />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <ResultStat
              label="Corpus Lasts"
              value={result.monthsLasting === -1 ? 'Indefinitely' : `${result.monthsLasting} months`}
              color="var(--text-green)" size="lg"
            />
            {result.series.length > 1 && (
              <div style={{ marginTop: 16 }}>
                <GrowthChart data={result.series} series={[{ key: 'balance', color: 'var(--text-green)', label: 'Balance' }]} />
              </div>
            )}
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
