'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcDebtPayoff, Debt } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

interface DebtPayoffState {
  debts: Debt[]
  extraMonthlyPayment: number
  strategy: 'snowball' | 'avalanche'
}

const DEFAULT_INPUT: DebtPayoffState = {
  debts: [
    { id: 'd1', name: 'Credit Card', balance: 4500, aprPct: 22, minPayment: 120 },
    { id: 'd2', name: 'Car Loan', balance: 12000, aprPct: 6.5, minPayment: 260 },
    { id: 'd3', name: 'Student Loan', balance: 18000, aprPct: 5, minPayment: 200 },
  ],
  extraMonthlyPayment: 300,
  strategy: 'avalanche',
}

export function DebtPayoffPlanner() {
  const [input, setInput] = useState<DebtPayoffState>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<DebtPayoffState, ReturnType<typeof calcDebtPayoff>>('debt-payoff-planner')

  const result = useMemo(() => calcDebtPayoff(input.debts, input.extraMonthlyPayment, input.strategy), [input])
  const alt = useMemo(() => calcDebtPayoff(input.debts, input.extraMonthlyPayment, input.strategy === 'snowball' ? 'avalanche' : 'snowball'), [input])

  const insights = useMemo(() => {
    const list: string[] = []
    const years = Math.floor(result.monthsToPayoff / 12)
    const months = result.monthsToPayoff % 12
    list.push(`Debt-free in ${years > 0 ? `${years}y ` : ''}${months}mo, paying ${formatCurrency(result.totalInterestPaid, 'USD', true)} in total interest.`)
    const interestDiff = result.totalInterestPaid - alt.totalInterestPaid
    if (Math.abs(interestDiff) > 1) {
      const cheaper = interestDiff > 0 ? (input.strategy === 'snowball' ? 'avalanche' : 'snowball') : input.strategy
      list.push(`${cheaper === 'avalanche' ? 'Avalanche' : 'Snowball'} saves ${formatCurrency(Math.abs(interestDiff), 'USD', true)} in interest versus the other strategy — though snowball often keeps motivation higher by clearing small balances first.`)
    }
    if (input.extraMonthlyPayment === 0) {
      list.push('Adding any extra monthly payment on top of minimums will meaningfully cut both time and interest.')
    }
    return list
  }, [input, result, alt])

  const updateDebt = (id: string, patch: Partial<Debt>) =>
    setInput(prev => ({ ...prev, debts: prev.debts.map(d => (d.id === id ? { ...d, ...patch } : d)) }))

  const addDebt = () =>
    setInput(prev => ({
      ...prev,
      debts: [...prev.debts, { id: `d${Date.now()}`, name: 'New Debt', balance: 1000, aprPct: 15, minPayment: 50 }],
    }))

  const removeDebt = (id: string) =>
    setInput(prev => ({ ...prev, debts: prev.debts.filter(d => d.id !== id) }))

  return (
    <ToolShell
      title="Debt Payoff Planner"
      categoryLabel="Loans"
      description="Compare the snowball and avalanche payoff strategies against your real debts, side by side."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
            <button
              className={`btn btn-sm ${input.strategy === 'avalanche' ? 'btn-green' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setInput(prev => ({ ...prev, strategy: 'avalanche' }))}
            >
              Avalanche
            </button>
            <button
              className={`btn btn-sm ${input.strategy === 'snowball' ? 'btn-green' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setInput(prev => ({ ...prev, strategy: 'snowball' }))}
            >
              Snowball
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: -10, marginBottom: 18, lineHeight: 1.5 }}>
            {input.strategy === 'avalanche'
              ? 'Avalanche: extra payments target the highest-interest debt first — mathematically cheapest.'
              : 'Snowball: extra payments target the smallest balance first — quick wins, easier to stick with.'}
          </p>

          <NumberField label="Extra Monthly Payment" value={input.extraMonthlyPayment} onChange={v => setInput(prev => ({ ...prev, extraMonthlyPayment: v }))} prefix="$" step={25} />

          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {input.debts.map(debt => (
              <div key={debt.id} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    className="input-field" value={debt.name} onChange={e => updateDebt(debt.id, { name: e.target.value })}
                    style={{ height: 34, fontSize: 13, flex: 1 }}
                  />
                  <button className="btn btn-ghost btn-sm" style={{ width: 34, height: 34, padding: 0, color: 'var(--text-red)' }} onClick={() => removeDebt(debt.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  <MiniField label="Balance" value={debt.balance} onChange={v => updateDebt(debt.id, { balance: v })} />
                  <MiniField label="APR %" value={debt.aprPct} onChange={v => updateDebt(debt.id, { aprPct: v })} />
                  <MiniField label="Min Pmt" value={debt.minPayment} onChange={v => updateDebt(debt.id, { minPayment: v })} />
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 10 }} onClick={addDebt}>
            <Plus size={13} /> Add Debt
          </button>
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat
                label="Debt-Free In"
                value={`${Math.floor(result.monthsToPayoff / 12)}y ${result.monthsToPayoff % 12}m`}
                color="var(--text-green)" size="lg"
              />
              <ResultStat label="Total Interest Paid" value={formatCurrency(result.totalInterestPaid, 'USD', true)} color="var(--text-red)" size="lg" />
            </div>
            <GrowthChart data={result.series} series={[{ key: 'balance', color: 'var(--text-orange)', label: 'Total Debt Remaining' }]} />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}

function MiniField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3 }}>{label}</div>
      <input
        className="input-field" type="number" value={value}
        onChange={e => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
        style={{ height: 32, fontSize: 12, padding: '0 8px' }}
      />
    </div>
  )
}
