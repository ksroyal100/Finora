'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcMortgage, MortgageInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: MortgageInput = {
  homePrice: 400000, downPaymentPct: 20, annualRatePct: 6.5, termYears: 30,
  propertyTaxPctAnnual: 1.1, homeInsuranceAnnual: 1600, hoaMonthly: 0,
}

export function MortgageCalculator() {
  const [input, setInput] = useState<MortgageInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<MortgageInput, ReturnType<typeof calcMortgage>>('mortgage-calculator')
  const result = useMemo(() => calcMortgage(input), [input])

  const insights = useMemo(() => {
    const list: string[] = []
    const piShare = (result.principalAndInterest / result.totalMonthlyPayment) * 100
    list.push(`Principal & interest is ${piShare.toFixed(0)}% of your monthly payment — the rest is tax, insurance${input.hoaMonthly ? ', and HOA' : ''}.`)
    list.push(`Over ${input.termYears} years you'll pay ${formatCurrency(result.totalInterestOverLoan, 'USD', true)} in interest — ${((result.totalInterestOverLoan / result.loanAmount) * 100).toFixed(0)}% of the loan amount.`)
    const rule = result.totalMonthlyPayment * 12 / (input.homePrice > 0 ? 1 : 1)
    list.push(`A common guideline is keeping total housing cost under 28% of gross monthly income — check that against your budget.`)
    return list
  }, [input, result])

  const update = (patch: Partial<MortgageInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Mortgage Calculator"
      categoryLabel="Real Estate"
      description="Full monthly housing payment — principal, interest, property tax, and insurance — plus the amortization schedule."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Home Price" value={input.homePrice} onChange={v => update({ homePrice: v })} prefix="$" step={5000} />
          <NumberField label="Down Payment" value={input.downPaymentPct} onChange={v => update({ downPaymentPct: v })} suffix="%" max={100} showSlider hint={formatCurrency(input.homePrice * input.downPaymentPct / 100, 'USD', true)} />
          <NumberField label="Interest Rate" value={input.annualRatePct} onChange={v => update({ annualRatePct: v })} suffix="%" step={0.05} max={15} showSlider />
          <NumberField label="Loan Term" value={input.termYears} onChange={v => update({ termYears: v })} suffix="yrs" max={40} showSlider />
          <NumberField label="Property Tax" value={input.propertyTaxPctAnnual} onChange={v => update({ propertyTaxPctAnnual: v })} suffix="%/yr" step={0.05} max={5} showSlider />
          <NumberField label="Home Insurance" value={input.homeInsuranceAnnual} onChange={v => update({ homeInsuranceAnnual: v })} prefix="$" suffix="/yr" step={100} />
          <NumberField label="HOA Dues" value={input.hoaMonthly ?? 0} onChange={v => update({ hoaMonthly: v })} prefix="$" suffix="/mo" step={25} />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Total Monthly Payment" value={formatCurrency(result.totalMonthlyPayment, 'USD', true)} color="var(--text-green)" size="lg" />
              <ResultStat label="Loan Amount" value={formatCurrency(result.loanAmount, 'USD', true)} size="lg" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Principal & Interest" value={formatCurrency(result.principalAndInterest, 'USD', true)} />
              <ResultStat label="Property Tax" value={formatCurrency(result.monthlyTax, 'USD', true)} />
              <ResultStat label="Insurance" value={formatCurrency(result.monthlyInsurance, 'USD', true)} />
            </div>
            <GrowthChart data={result.series} series={[{ key: 'balance', color: 'var(--text-orange)', label: 'Remaining Balance' }]} />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
