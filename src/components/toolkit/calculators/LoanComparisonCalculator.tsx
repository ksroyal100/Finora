'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { formatCurrency } from '@/lib/utils'
import { calcLoan, LoanInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

interface Comparison { loanA: LoanInput; loanB: LoanInput }
const DEFAULT_INPUT: Comparison = {
  loanA: { principal: 30000, annualRatePct: 6.5, termYears: 5 },
  loanB: { principal: 30000, annualRatePct: 5.5, termYears: 6 },
}

export function LoanComparisonCalculator() {
  const [input, setInput] = useState<Comparison>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<Comparison, { a: ReturnType<typeof calcLoan>; b: ReturnType<typeof calcLoan> }>('loan-comparison')

  const a = useMemo(() => calcLoan(input.loanA), [input.loanA])
  const b = useMemo(() => calcLoan(input.loanB), [input.loanB])

  const insights = useMemo(() => {
    const cheaper = a.totalInterest <= b.totalInterest ? 'A' : 'B'
    const diff = Math.abs(a.totalInterest - b.totalInterest)
    return [`Loan ${cheaper} costs ${formatCurrency(diff, 'USD', true)} less in total interest over its full term — but check the monthly payment difference too, since a longer term can lower EMI while costing more overall.`]
  }, [a, b])

  const updateA = (patch: Partial<LoanInput>) => setInput(prev => ({ ...prev, loanA: { ...prev.loanA, ...patch } }))
  const updateB = (patch: Partial<LoanInput>) => setInput(prev => ({ ...prev, loanB: { ...prev.loanB, ...patch } }))

  return (
    <ToolShell
      title="Loan Comparison"
      categoryLabel="Loans"
      description="Compare two loan offers side by side — monthly payment, total interest, and total cost."
      scenarios={scenarios}
      onSave={name => save(name, input, { a, b })}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-green)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Loan A</div>
            <NumberField label="Principal" value={input.loanA.principal} onChange={v => updateA({ principal: v })} prefix="$" step={500} />
            <NumberField label="Interest Rate" value={input.loanA.annualRatePct} onChange={v => updateA({ annualRatePct: v })} suffix="%" step={0.1} max={25} showSlider />
            <NumberField label="Term" value={input.loanA.termYears} onChange={v => updateA({ termYears: v })} suffix="yrs" max={30} showSlider />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-blue)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Loan B</div>
            <NumberField label="Principal" value={input.loanB.principal} onChange={v => updateB({ principal: v })} prefix="$" step={500} />
            <NumberField label="Interest Rate" value={input.loanB.annualRatePct} onChange={v => updateB({ annualRatePct: v })} suffix="%" step={0.1} max={25} showSlider />
            <NumberField label="Term" value={input.loanB.termYears} onChange={v => updateB({ termYears: v })} suffix="yrs" max={30} showSlider />
          </div>
        </div>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-green)', marginBottom: 10 }}>LOAN A</div>
                <ResultStat label="Monthly Payment" value={formatCurrency(a.emi, 'USD', true)} color="var(--text-green)" size="lg" />
                <div style={{ height: 10 }} />
                <ResultStat label="Total Interest" value={formatCurrency(a.totalInterest, 'USD', true)} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-blue)', marginBottom: 10 }}>LOAN B</div>
                <ResultStat label="Monthly Payment" value={formatCurrency(b.emi, 'USD', true)} color="var(--text-blue)" size="lg" />
                <div style={{ height: 10 }} />
                <ResultStat label="Total Interest" value={formatCurrency(b.totalInterest, 'USD', true)} />
              </div>
            </div>
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
