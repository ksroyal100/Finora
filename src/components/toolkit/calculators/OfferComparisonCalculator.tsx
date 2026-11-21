'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { formatCurrency } from '@/lib/utils'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

interface Offer { baseSalary: number; signingBonus: number; annualBonusPct: number; equityAnnualValue: number; benefitsAnnualValue: number }
interface Comparison { offerA: Offer; offerB: Offer }

const DEFAULT_INPUT: Comparison = {
  offerA: { baseSalary: 130000, signingBonus: 10000, annualBonusPct: 10, equityAnnualValue: 15000, benefitsAnnualValue: 8000 },
  offerB: { baseSalary: 145000, signingBonus: 0, annualBonusPct: 5, equityAnnualValue: 5000, benefitsAnnualValue: 6000 },
}

function totalFirstYearValue(o: Offer): number {
  return o.baseSalary + o.signingBonus + o.baseSalary * (o.annualBonusPct / 100) + o.equityAnnualValue + o.benefitsAnnualValue
}
function totalOngoingAnnualValue(o: Offer): number {
  return o.baseSalary + o.baseSalary * (o.annualBonusPct / 100) + o.equityAnnualValue + o.benefitsAnnualValue
}

export function OfferComparisonCalculator() {
  const [input, setInput] = useState<Comparison>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<Comparison, { a: number; b: number }>('offer-comparison')

  const firstYearA = totalFirstYearValue(input.offerA)
  const firstYearB = totalFirstYearValue(input.offerB)
  const ongoingA = totalOngoingAnnualValue(input.offerA)
  const ongoingB = totalOngoingAnnualValue(input.offerB)

  const insights = useMemo(() => {
    const betterFirstYear = firstYearA >= firstYearB ? 'A' : 'B'
    const betterOngoing = ongoingA >= ongoingB ? 'A' : 'B'
    const list = [`Offer ${betterFirstYear} is worth more in year one (including signing bonus): ${formatCurrency(Math.abs(firstYearA - firstYearB), 'USD', true)} more.`]
    if (betterFirstYear !== betterOngoing) list.push(`But offer ${betterOngoing} is worth more every year after that — the signing bonus is a one-time sweetener, not the real comparison.`)
    return list
  }, [firstYearA, firstYearB, ongoingA, ongoingB])

  const updateA = (patch: Partial<Offer>) => setInput(prev => ({ ...prev, offerA: { ...prev.offerA, ...patch } }))
  const updateB = (patch: Partial<Offer>) => setInput(prev => ({ ...prev, offerB: { ...prev.offerB, ...patch } }))

  return (
    <ToolShell
      title="Offer Comparison"
      categoryLabel="Salary"
      description="Compare two job offers on total compensation, not just base salary — bonus, equity, and benefits included."
      scenarios={scenarios}
      onSave={name => save(name, input, { a: firstYearA, b: firstYearB })}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-green)', marginBottom: 10, textTransform: 'uppercase' }}>Offer A</div>
            <NumberField label="Base Salary" value={input.offerA.baseSalary} onChange={v => updateA({ baseSalary: v })} prefix="$" step={1000} />
            <NumberField label="Signing Bonus" value={input.offerA.signingBonus} onChange={v => updateA({ signingBonus: v })} prefix="$" step={500} />
            <NumberField label="Target Annual Bonus" value={input.offerA.annualBonusPct} onChange={v => updateA({ annualBonusPct: v })} suffix="%" max={50} showSlider />
            <NumberField label="Equity (Annual Value)" value={input.offerA.equityAnnualValue} onChange={v => updateA({ equityAnnualValue: v })} prefix="$" step={500} />
            <NumberField label="Benefits (Annual Value)" value={input.offerA.benefitsAnnualValue} onChange={v => updateA({ benefitsAnnualValue: v })} prefix="$" step={500} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-blue)', marginBottom: 10, textTransform: 'uppercase' }}>Offer B</div>
            <NumberField label="Base Salary" value={input.offerB.baseSalary} onChange={v => updateB({ baseSalary: v })} prefix="$" step={1000} />
            <NumberField label="Signing Bonus" value={input.offerB.signingBonus} onChange={v => updateB({ signingBonus: v })} prefix="$" step={500} />
            <NumberField label="Target Annual Bonus" value={input.offerB.annualBonusPct} onChange={v => updateB({ annualBonusPct: v })} suffix="%" max={50} showSlider />
            <NumberField label="Equity (Annual Value)" value={input.offerB.equityAnnualValue} onChange={v => updateB({ equityAnnualValue: v })} prefix="$" step={500} />
            <NumberField label="Benefits (Annual Value)" value={input.offerB.benefitsAnnualValue} onChange={v => updateB({ benefitsAnnualValue: v })} prefix="$" step={500} />
          </div>
        </div>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-green)', marginBottom: 10 }}>OFFER A</div>
                <ResultStat label="Year 1 Total" value={formatCurrency(firstYearA, 'USD', true)} color="var(--text-green)" size="lg" />
                <div style={{ height: 10 }} />
                <ResultStat label="Ongoing Annual Value" value={formatCurrency(ongoingA, 'USD', true)} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-blue)', marginBottom: 10 }}>OFFER B</div>
                <ResultStat label="Year 1 Total" value={formatCurrency(firstYearB, 'USD', true)} color="var(--text-blue)" size="lg" />
                <div style={{ height: 10 }} />
                <ResultStat label="Ongoing Annual Value" value={formatCurrency(ongoingB, 'USD', true)} />
              </div>
            </div>
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
