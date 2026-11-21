'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcLoan, LoanInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: LoanInput = { principal: 25000, annualRatePct: 7.5, termYears: 5, extraMonthlyPayment: 0 }

export function LoanEmiCalculator() {
  const [input, setInput] = useState<LoanInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<LoanInput, ReturnType<typeof calcLoan>>('loan-emi')
  const result = useMemo(() => calcLoan(input), [input])

  const insights = useMemo(() => {
    const list: string[] = []
    list.push(`You'll pay ${formatCurrency(result.totalInterest, 'USD', true)} in interest over the life of this loan — ${((result.totalInterest / input.principal) * 100).toFixed(0)}% of the amount borrowed.`)
    if (input.extraMonthlyPayment && input.extraMonthlyPayment > 0 && result.monthsSaved > 0) {
      list.push(`That extra ${formatCurrency(input.extraMonthlyPayment, 'USD', true)}/mo pays this off ${Math.floor(result.monthsSaved / 12)}y ${result.monthsSaved % 12}mo sooner.`)
    } else {
      const withExtra = calcLoan({ ...input, extraMonthlyPayment: 100 })
      list.push(`An extra $100/mo would save ${formatCurrency(result.totalInterest - withExtra.totalInterest, 'USD', true)} in interest and pay it off ${withExtra.monthsSaved} months early.`)
    }
    return list
  }, [input, result])

  const update = (patch: Partial<LoanInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Loan EMI Calculator"
      categoryLabel="Loans"
      description="Your monthly payment, total interest, and the full amortization schedule for any fixed-rate loan."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Loan Amount" value={input.principal} onChange={v => update({ principal: v })} prefix="$" step={500} />
          <NumberField label="Annual Interest Rate" value={input.annualRatePct} onChange={v => update({ annualRatePct: v })} suffix="%" step={0.1} max={25} showSlider />
          <NumberField label="Loan Term" value={input.termYears} onChange={v => update({ termYears: v })} suffix="yrs" max={30} showSlider />
          <NumberField label="Extra Monthly Payment" value={input.extraMonthlyPayment ?? 0} onChange={v => update({ extraMonthlyPayment: v })} prefix="$" step={25} hint="Optional — pay it off faster" />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Monthly Payment" value={formatCurrency(result.emi, 'USD', true)} color="var(--text-green)" size="lg" />
              <ResultStat label="Total Interest" value={formatCurrency(result.totalInterest, 'USD', true)} color="var(--text-red)" />
              <ResultStat label="Payoff Time" value={`${Math.floor(result.payoffMonths / 12)}y ${result.payoffMonths % 12}m`} />
            </div>
            <GrowthChart data={result.series} series={[{ key: 'balance', color: 'var(--text-orange)', label: 'Remaining Balance' }]} />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
