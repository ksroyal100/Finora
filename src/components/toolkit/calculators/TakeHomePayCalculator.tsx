'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { formatCurrency } from '@/lib/utils'
import { calcTakeHomePay, TakeHomePayInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: TakeHomePayInput = { grossAnnualSalary: 85000, effectiveTaxRatePct: 24, preTaxDeductionsMonthly: 400 }

export function TakeHomePayCalculator() {
  const [input, setInput] = useState<TakeHomePayInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<TakeHomePayInput, ReturnType<typeof calcTakeHomePay>>('salary-breakdown')
  const result = useMemo(() => calcTakeHomePay(input), [input])

  const insights = useMemo(() => [
    `This is a simplified estimate using one flat effective tax rate — it doesn't model tax brackets, state taxes, filing status, or credits. Use it to compare offers directionally, not to file taxes.`,
  ], [])

  const update = (patch: Partial<TakeHomePayInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Salary Breakdown"
      categoryLabel="Salary"
      description="A quick, simplified estimate of monthly take-home pay from a gross salary — useful for comparing offers, not for tax filing."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Gross Annual Salary" value={input.grossAnnualSalary} onChange={v => update({ grossAnnualSalary: v })} prefix="$" step={1000} />
          <NumberField label="Effective Tax Rate" value={input.effectiveTaxRatePct} onChange={v => update({ effectiveTaxRatePct: v })} suffix="%" step={0.5} max={50} showSlider hint="Combined federal + state, as a flat estimate" />
          <NumberField label="Pre-Tax Deductions (Monthly)" value={input.preTaxDeductionsMonthly} onChange={v => update({ preTaxDeductionsMonthly: v })} prefix="$" step={25} hint="401(k), health insurance, HSA, etc." />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <ResultStat label="Monthly Take-Home" value={formatCurrency(result.monthlyTakeHome, 'USD', true)} color="var(--text-green)" size="lg" />
              <ResultStat label="Annual Take-Home" value={formatCurrency(result.annualTakeHome, 'USD', true)} color="var(--text-blue)" size="lg" />
              <ResultStat label="Annual Tax Paid (est.)" value={formatCurrency(result.annualTaxPaid, 'USD', true)} color="var(--text-red)" />
              <ResultStat label="Annual Pre-Tax Deductions" value={formatCurrency(result.annualPreTaxDeductions, 'USD', true)} />
            </div>
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
