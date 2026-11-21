'use client'

import { GenericRatioCalculator, RatioCalculatorConfig } from './GenericRatioCalculator'
import { formatCurrency } from '@/lib/utils'

const money = (v: number) => formatCurrency(v, 'USD', true)

const config: RatioCalculatorConfig = {
  slug: 'tax-saving-planner',
  title: 'Tax Saving Planner',
  categoryLabel: 'Tax Planning',
  description: 'Estimate the tax impact of common pre-tax contribution levers — 401(k), HSA, and traditional IRA.',
  fields: [
    { key: 'marginalTaxRatePct', label: 'Marginal Tax Rate', defaultValue: 24, suffix: '%', step: 1, max: 40, showSlider: true, hint: 'Your combined federal + state bracket' },
    { key: 'annual401k', label: 'Annual 401(k) Contribution', defaultValue: 8000, prefix: '$', step: 500, hint: '2024 limit is $23,000 ($30,500 if 50+)' },
    { key: 'annualHsa', label: 'Annual HSA Contribution', defaultValue: 3000, prefix: '$', step: 250, hint: '2024 individual limit is $4,150' },
    { key: 'annualIra', label: 'Annual Traditional IRA Contribution', defaultValue: 3000, prefix: '$', step: 250, hint: '2024 limit is $7,000 ($8,000 if 50+)' },
  ],
  compute: v => {
    const totalPreTax = v.annual401k + v.annualHsa + v.annualIra
    const estimatedTaxSavings = totalPreTax * (v.marginalTaxRatePct / 100)
    return { totalPreTax, estimatedTaxSavings }
  },
  resultStats: [
    { key: 'totalPreTax', label: 'Total Pre-Tax Contributions', format: money },
    { key: 'estimatedTaxSavings', label: 'Estimated Tax Savings', format: money, color: 'var(--text-green)', size: 'lg' },
  ],
  insights: (v, r) => [
    `Contributing ${money(r.totalPreTax)} pre-tax at a ${v.marginalTaxRatePct}% marginal rate saves roughly ${money(r.estimatedTaxSavings)} in taxes this year — on top of the money still being yours, just growing tax-advantaged.`,
    'This is a simplified estimate of the marginal-rate effect, not a full return — it doesn\'t account for phase-outs, AMT, or how contributions might shift your bracket.',
  ],
}

export function TaxSavingPlanner() {
  return <GenericRatioCalculator config={config} />
}
