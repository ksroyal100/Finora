'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { formatCurrency } from '@/lib/utils'
import { calcIncomeTax, IncomeTaxInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: IncomeTaxInput = { grossAnnualIncome: 85000, standardDeduction: 14600 }

export function IncomeTaxCalculator() {
  const [input, setInput] = useState<IncomeTaxInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<IncomeTaxInput, ReturnType<typeof calcIncomeTax>>('income-tax')
  const result = useMemo(() => calcIncomeTax(input), [input])

  const insights = [
    'Uses 2024 single-filer federal brackets only — no state tax, credits, itemized deductions, or filing-status adjustments are modeled. Treat this as a directional estimate, not a filing calculation.',
  ]

  const update = (patch: Partial<IncomeTaxInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Income Tax Calculator"
      categoryLabel="Tax Planning"
      description="Estimate federal income tax using actual progressive brackets, not a single flat rate."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Gross Annual Income" value={input.grossAnnualIncome} onChange={v => update({ grossAnnualIncome: v })} prefix="$" step={1000} />
          <NumberField label="Standard Deduction" value={input.standardDeduction} onChange={v => update({ standardDeduction: v })} prefix="$" step={100} hint="2024 single-filer standard deduction is $14,600" />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <ResultStat label="Taxable Income" value={formatCurrency(result.taxableIncome, 'USD', true)} />
              <ResultStat label="Total Federal Tax" value={formatCurrency(result.totalTax, 'USD', true)} color="var(--text-red)" size="lg" />
              <ResultStat label="Effective Tax Rate" value={`${result.effectiveRatePct.toFixed(1)}%`} color="var(--text-orange)" />
              <ResultStat label="After-Tax Income" value={formatCurrency(result.afterTaxIncome, 'USD', true)} color="var(--text-green)" size="lg" />
            </div>
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
