'use client'

import { useMemo, useState } from 'react'
import { ToolShell } from '@/components/toolkit/ToolShell'
import { NumberField } from '@/components/toolkit/NumberField'
import { ResultStat, InsightList } from '@/components/toolkit/ResultStat'
import { GrowthChart } from '@/components/toolkit/GrowthChart'
import { formatCurrency } from '@/lib/utils'
import { calcRentVsBuy, RentVsBuyInput } from '@/lib/toolkit/engine'
import { useToolkitHistory } from '@/lib/toolkit/useToolkitHistory'

const DEFAULT_INPUT: RentVsBuyInput = {
  homePrice: 400000,
  downPaymentPct: 20,
  mortgageRatePct: 6.5,
  loanTermYears: 30,
  propertyTaxPctAnnual: 1.1,
  maintenancePctAnnual: 1,
  homeAppreciationPctAnnual: 3.5,
  monthlyRent: 2200,
  rentIncreasePctAnnual: 3,
  investmentReturnPctAnnual: 7,
  horizonYears: 10,
}

export function RentVsBuyCalculator() {
  const [input, setInput] = useState<RentVsBuyInput>(DEFAULT_INPUT)
  const { scenarios, save, remove, duplicate } = useToolkitHistory<RentVsBuyInput, ReturnType<typeof calcRentVsBuy>>('rent-vs-buy')
  const result = useMemo(() => calcRentVsBuy(input), [input])

  const insights = useMemo(() => {
    const list: string[] = []
    if (result.betterOption === 'buy') {
      list.push(`Buying builds ${formatCurrency(result.differenceAmount, 'USD', true)} more net worth than renting over ${input.horizonYears} years — mainly through home equity and appreciation.`)
    } else {
      list.push(`Renting and investing the difference builds ${formatCurrency(result.differenceAmount, 'USD', true)} more net worth over ${input.horizonYears} years in this scenario.`)
    }
    if (result.breakevenYear) {
      list.push(`Buying only pulls ahead after year ${result.breakevenYear} — leaving before then, renting likely wins.`)
    } else {
      list.push(`Renting stays ahead for the entire ${input.horizonYears}-year window you're comparing.`)
    }
    list.push('This model assumes the down payment and any monthly savings from renting get invested at your expected return — a real decision also weighs stability, flexibility, and lifestyle.')
    return list
  }, [input, result])

  const update = (patch: Partial<RentVsBuyInput>) => setInput(prev => ({ ...prev, ...patch }))

  return (
    <ToolShell
      title="Rent vs Buy"
      categoryLabel="Real Estate"
      description="Compare the net worth impact of buying a home versus renting and investing the difference."
      scenarios={scenarios}
      onSave={name => save(name, input, result)}
      onDuplicate={duplicate}
      onRemove={remove}
      onLoad={s => setInput(s.input)}
      inputsPanel={
        <>
          <NumberField label="Home Price" value={input.homePrice} onChange={v => update({ homePrice: v })} prefix="$" step={5000} />
          <NumberField label="Down Payment" value={input.downPaymentPct} onChange={v => update({ downPaymentPct: v })} suffix="%" max={100} showSlider />
          <NumberField label="Mortgage Rate" value={input.mortgageRatePct} onChange={v => update({ mortgageRatePct: v })} suffix="%" step={0.05} max={15} showSlider />
          <NumberField label="Loan Term" value={input.loanTermYears} onChange={v => update({ loanTermYears: v })} suffix="yrs" max={40} showSlider />
          <NumberField label="Property Tax" value={input.propertyTaxPctAnnual} onChange={v => update({ propertyTaxPctAnnual: v })} suffix="%/yr" step={0.05} max={5} showSlider />
          <NumberField label="Maintenance" value={input.maintenancePctAnnual} onChange={v => update({ maintenancePctAnnual: v })} suffix="%/yr" step={0.1} max={5} showSlider />
          <NumberField label="Home Appreciation" value={input.homeAppreciationPctAnnual} onChange={v => update({ homeAppreciationPctAnnual: v })} suffix="%/yr" step={0.25} max={10} showSlider />
          <NumberField label="Monthly Rent (equivalent home)" value={input.monthlyRent} onChange={v => update({ monthlyRent: v })} prefix="$" step={100} />
          <NumberField label="Rent Increase" value={input.rentIncreasePctAnnual} onChange={v => update({ rentIncreasePctAnnual: v })} suffix="%/yr" step={0.25} max={10} showSlider />
          <NumberField label="Investment Return (if renting)" value={input.investmentReturnPctAnnual} onChange={v => update({ investmentReturnPctAnnual: v })} suffix="%/yr" step={0.25} max={15} showSlider />
          <NumberField label="Time Horizon" value={input.horizonYears} onChange={v => update({ horizonYears: v })} suffix="yrs" max={30} showSlider />
        </>
      }
      resultsPanel={
        <>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <ResultStat label="Net Worth If Buying" value={formatCurrency(result.buyNetWorth, 'USD', true)} color={result.betterOption === 'buy' ? 'var(--text-green)' : 'var(--text-primary)'} size="lg" />
              <ResultStat label="Net Worth If Renting" value={formatCurrency(result.rentNetWorth, 'USD', true)} color={result.betterOption === 'rent' ? 'var(--text-green)' : 'var(--text-primary)'} size="lg" />
            </div>
            <GrowthChart
              data={result.series}
              series={[
                { key: 'buy', color: 'var(--text-green)', label: 'Buy' },
                { key: 'rent', color: 'var(--text-blue)', label: 'Rent + Invest' },
              ]}
            />
          </div>
          <InsightList insights={insights} />
        </>
      }
    />
  )
}
