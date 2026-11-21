'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { formatCurrency } from '@/lib/utils'
import { calcRentalYield, RentalYieldInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: RentalYieldInput = { propertyValue: 350000, monthlyRent: 2200, annualExpenses: 6000 }

export function RentalYieldCalculator() {
  const [input, setInput] = useState<RentalYieldInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<RentalYieldInput, ReturnType<typeof calcRentalYield>>('rental-yield')
  const result = useMemo(() => calcRentalYield(input), [input])

  const insights = useMemo(() => {
    const list: string[] = []
    if (result.grossYieldPct >= 8) list.push('A gross yield above 8% is strong for most markets — worth double-checking your rent and expense assumptions are realistic.')
    else if (result.grossYieldPct < 4) list.push('Under 4% gross yield is on the low side for a pure rental play — you may be pricing in more appreciation than income.')
    list.push(`Expenses are eating ${input.monthlyRent > 0 ? ((input.annualExpenses / (input.monthlyRent * 12)) * 100).toFixed(0) : 0}% of your gross rental income.`)
    return list
  }, [input, result])

  const update = (patch: Partial<RentalYieldInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Rental Yield Calculator"
      categoryLabel="Real Estate"
      description="Gross and net rental yield on a property — the two most common quick-screen numbers for a rental deal."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Property Value" value={input.propertyValue} onChange={v => update({ propertyValue: v })} prefix="$" step={5000} />
          <NumberField label="Monthly Rent" value={input.monthlyRent} onChange={v => update({ monthlyRent: v })} prefix="$" step={50} />
          <NumberField label="Annual Expenses" value={input.annualExpenses} onChange={v => update({ annualExpenses: v })} prefix="$" step={250} hint="Tax, insurance, maintenance, HOA, etc." />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Gross Yield" value={`${result.grossYieldPct.toFixed(2)}%`} color="var(--text-green)" size="lg" />
              <ResultStat label="Net Yield" value={`${result.netYieldPct.toFixed(2)}%`} color="var(--text-blue)" size="lg" />
              <ResultStat label="Annual Gross Rent" value={formatCurrency(result.annualGrossRent, 'USD', true)} />
              <ResultStat label="Net Annual Income" value={formatCurrency(result.netAnnualIncome, 'USD', true)} />
            </div>
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
