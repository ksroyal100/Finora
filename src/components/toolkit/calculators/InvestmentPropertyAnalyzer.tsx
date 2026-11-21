'use client'

import { GenericRatioCalculator, RatioCalculatorConfig } from './GenericRatioCalculator'
import { formatCurrency } from '@/lib/utils'

const money = (v: number) => formatCurrency(v, 'USD', true)
const pct = (v: number) => `${v.toFixed(2)}%`

const config: RatioCalculatorConfig = {
  slug: 'investment-property-analyzer',
  title: 'Investment Property Analyzer',
  categoryLabel: 'Real Estate',
  description: 'A full first-pass screen on a rental deal: cash flow, cap rate, and cash-on-cash return in one place.',
  fields: [
    { key: 'purchasePrice', label: 'Purchase Price', defaultValue: 350000, prefix: '$', step: 5000 },
    { key: 'downPaymentPct', label: 'Down Payment', defaultValue: 20, suffix: '%', max: 100, showSlider: true },
    { key: 'closingCosts', label: 'Closing Costs', defaultValue: 8000, prefix: '$', step: 500 },
    { key: 'monthlyRent', label: 'Monthly Rent', defaultValue: 2600, prefix: '$', step: 50 },
    { key: 'monthlyMortgage', label: 'Monthly Mortgage Payment', defaultValue: 1450, prefix: '$', step: 50 },
    { key: 'monthlyOperatingExpenses', label: 'Monthly Operating Expenses', defaultValue: 500, prefix: '$', step: 25, hint: 'Tax, insurance, maintenance, management' },
  ],
  compute: v => {
    const downPayment = v.purchasePrice * (v.downPaymentPct / 100)
    const cashInvested = downPayment + v.closingCosts
    const monthlyCashFlow = v.monthlyRent - v.monthlyMortgage - v.monthlyOperatingExpenses
    const annualCashFlow = monthlyCashFlow * 12
    const annualGrossIncome = v.monthlyRent * 12
    const annualOperatingExpenses = v.monthlyOperatingExpenses * 12
    const noi = annualGrossIncome - annualOperatingExpenses
    const capRatePct = v.purchasePrice > 0 ? (noi / v.purchasePrice) * 100 : 0
    const cashOnCashPct = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0
    return { cashInvested, monthlyCashFlow, annualCashFlow, noi, capRatePct, cashOnCashPct }
  },
  resultStats: [
    { key: 'cashInvested', label: 'Total Cash Needed', format: money },
    { key: 'monthlyCashFlow', label: 'Monthly Cash Flow', format: money, color: 'var(--text-green)', size: 'lg' },
    { key: 'capRatePct', label: 'Cap Rate', format: pct, color: 'var(--text-blue)' },
    { key: 'cashOnCashPct', label: 'Cash-on-Cash Return', format: pct, color: 'var(--text-gold)', size: 'lg' },
  ],
  insights: (v, r) => {
    const list: string[] = []
    list.push(r.monthlyCashFlow >= 0
      ? `This deal nets ${money(r.monthlyCashFlow)}/month after debt service and expenses.`
      : `This deal runs ${money(-r.monthlyCashFlow)}/month negative — you'd be subsidizing it out of pocket.`)
    if (r.cashOnCashPct >= 8) list.push(`${r.cashOnCashPct.toFixed(1)}% cash-on-cash is a strong return relative to most passive alternatives.`)
    return list
  },
}

export function InvestmentPropertyAnalyzer() {
  return <GenericRatioCalculator config={config} />
}
