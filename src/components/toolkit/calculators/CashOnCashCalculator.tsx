'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { formatCurrency } from '@/lib/utils'
import { calcCashOnCash, CashOnCashInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: CashOnCashInput = { annualPreTaxCashFlow: 9600, totalCashInvested: 80000 }

export function CashOnCashCalculator() {
  const [input, setInput] = useState<CashOnCashInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<CashOnCashInput, ReturnType<typeof calcCashOnCash>>('cash-on-cash-return')
  const result = useMemo(() => calcCashOnCash(input), [input])

  const insights = useMemo(() => {
    if (result.cashOnCashReturnPct >= 10) return ['A cash-on-cash return above 10% is strong — typical for value-add deals or higher-leverage financing.']
    if (result.cashOnCashReturnPct <= 4) return ['Under 4% cash-on-cash is on the low end — check whether leverage or purchase price is limiting your actual cash returns.']
    return ['6–10% cash-on-cash is a common target range for a straightforward buy-and-hold rental.']
  }, [result])

  const update = (patch: Partial<CashOnCashInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Cash-on-Cash Return"
      categoryLabel="Real Estate"
      description="Your actual cash return relative to the cash you put in — the number that matters most if you financed the deal."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Annual Pre-Tax Cash Flow" value={input.annualPreTaxCashFlow} onChange={v => update({ annualPreTaxCashFlow: v })} prefix="$" step={250} hint="After mortgage, before taxes" />
          <NumberField label="Total Cash Invested" value={input.totalCashInvested} onChange={v => update({ totalCashInvested: v })} prefix="$" step={1000} hint="Down payment + closing costs + repairs" />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <ResultStat label="Cash-on-Cash Return" value={`${result.cashOnCashReturnPct.toFixed(2)}%`} color="var(--text-green)" size="lg" />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
