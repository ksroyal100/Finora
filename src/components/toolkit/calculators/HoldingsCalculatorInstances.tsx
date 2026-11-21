'use client'

import { GenericHoldingsCalculator, HoldingsCalculatorConfig } from './GenericHoldingsCalculator'

function make(config: HoldingsCalculatorConfig) {
  return function HoldingsCalculatorInstance() {
    return <GenericHoldingsCalculator config={config} />
  }
}

export const PortfolioAllocationCalculator = make({
  slug: 'portfolio-allocation',
  title: 'Portfolio Allocation',
  categoryLabel: 'Investment Toolkit',
  description: 'See your current asset allocation as percentages across all your holdings.',
  mode: 'allocation',
})

export const PortfolioReturnCalculator = make({
  slug: 'portfolio-return-calculator',
  title: 'Portfolio Return Calculator',
  categoryLabel: 'Investment Toolkit',
  description: 'Your blended expected return, weighted by how much is in each holding.',
  mode: 'return',
})

export const RiskAnalysisCalculator = make({
  slug: 'risk-analysis',
  title: 'Risk Analysis',
  categoryLabel: 'Investment Toolkit',
  description: 'A simple concentration-risk check — how much of your portfolio rides on any single holding.',
  mode: 'risk',
})

export const PortfolioRebalancingCalculator = make({
  slug: 'portfolio-rebalancing',
  title: 'Portfolio Rebalancing',
  categoryLabel: 'Investment Toolkit',
  description: 'Compare your current allocation against target percentages to see what has drifted.',
  mode: 'rebalancing',
})
