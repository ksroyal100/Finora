'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcFire, FireInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: FireInput = {
  currentAge: 28,
  currentAnnualExpenses: 40000,
  currentInvestments: 30000,
  monthlySavings: 2000,
  expectedReturnPct: 7,
  inflationPct: 3,
  safeWithdrawalRatePct: 4,
}

export function FireCalculator() {
  const [input, setInput] = useState<FireInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<FireInput, ReturnType<typeof calcFire>>('fire-calculator')
  const result = useMemo(() => calcFire(input), [input])

  const insights = useMemo(() => {
    const list: string[] = []
    list.push(`Your FIRE number is ${formatCurrency(result.fireNumber, 'USD', true)} — ${input.safeWithdrawalRatePct}% of that covers your current annual expenses indefinitely.`)
    if (result.yearsToFire !== null) {
      list.push(`At this savings rate you reach financial independence in ${result.yearsToFire} years, around age ${result.fireAge}.`)
      const withExtra = calcFire({ ...input, monthlySavings: input.monthlySavings + 500 })
      if (withExtra.yearsToFire !== null && result.yearsToFire) {
        const yearsSaved = result.yearsToFire - withExtra.yearsToFire
        if (yearsSaved > 0) list.push(`Saving an extra $500/mo would get you there ${yearsSaved} year${yearsSaved === 1 ? '' : 's'} sooner.`)
      }
    } else {
      list.push('At this savings rate, FIRE isn\u2019t reached within 80 years — try increasing monthly savings or expected return.')
    }
    return list
  }, [input, result])

  const update = (patch: Partial<FireInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="FIRE Calculator"
      categoryLabel="Wealth Planning"
      description="Financial Independence, Retire Early — find your number and the year you'll hit it."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Current Age" value={input.currentAge} onChange={v => update({ currentAge: v })} max={70} showSlider />
          <NumberField label="Current Annual Expenses" value={input.currentAnnualExpenses} onChange={v => update({ currentAnnualExpenses: v })} prefix="$" step={1000} />
          <NumberField label="Current Investments" value={input.currentInvestments} onChange={v => update({ currentInvestments: v })} prefix="$" step={1000} />
          <NumberField label="Monthly Savings" value={input.monthlySavings} onChange={v => update({ monthlySavings: v })} prefix="$" step={100} />
          <NumberField label="Expected Annual Return" value={input.expectedReturnPct} onChange={v => update({ expectedReturnPct: v })} suffix="%" step={0.5} max={15} showSlider />
          <NumberField label="Expected Inflation" value={input.inflationPct} onChange={v => update({ inflationPct: v })} suffix="%" step={0.25} max={10} showSlider />
          <NumberField label="Safe Withdrawal Rate" value={input.safeWithdrawalRatePct} onChange={v => update({ safeWithdrawalRatePct: v })} suffix="%" step={0.25} max={8} showSlider hint="4% is the classic rule" />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Your FIRE Number" value={formatCurrency(result.fireNumber, 'USD', true)} color="var(--text-green)" size="lg" />
              <ResultStat
                label="Years to FIRE"
                value={result.yearsToFire !== null ? `${result.yearsToFire} yrs (age ${result.fireAge})` : '80+ yrs'}
                color="var(--text-blue)" size="lg"
              />
            </div>
            <GrowthChart
              data={result.series}
              series={[
                { key: 'balance', color: 'var(--text-green)', label: 'Net Worth' },
                { key: 'fireNumber', color: 'var(--text-orange)', label: 'FIRE Number', type: 'line' },
              ]}
            />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
