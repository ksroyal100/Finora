'use client'

import { GenericGoalCalculator, GoalCalculatorConfig } from './GenericGoalCalculator'

function make(config: GoalCalculatorConfig) {
  return function GoalCalculatorInstance() {
    return <GenericGoalCalculator config={config} />
  }
}

export const DreamHomePlanner = make({
  slug: 'dream-home-planner',
  title: 'Dream Home Planner',
  categoryLabel: 'Goal Planning',
  description: 'Save toward the down payment on a future home purchase.',
  targetLabel: 'Down Payment Target',
  insightNoun: 'home down payment',
  defaultInput: { targetAmount: 80000, currentSavings: 10000, annualRatePct: 4, years: 5 },
})

export const LuxuryCarPlanner = make({
  slug: 'luxury-car-planner',
  title: 'Luxury Car Planner',
  categoryLabel: 'Goal Planning',
  description: 'Save toward a car purchase instead of financing the whole thing.',
  targetLabel: 'Car Price Target',
  insightNoun: 'car',
  defaultInput: { targetAmount: 45000, currentSavings: 5000, annualRatePct: 3, years: 3 },
})

export const BusinessFundPlanner = make({
  slug: 'business-fund',
  title: 'Business Fund',
  categoryLabel: 'Goal Planning',
  description: 'Build the capital you need to start a business without taking on debt.',
  targetLabel: 'Startup Capital Needed',
  insightNoun: 'business fund',
  defaultInput: { targetAmount: 50000, currentSavings: 5000, annualRatePct: 3, years: 4 },
})

export const TravelFundPlanner = make({
  slug: 'travel-fund',
  title: 'Travel Fund',
  categoryLabel: 'Goal Planning',
  description: 'Plan a recurring travel budget you actually save for ahead of time.',
  targetLabel: 'Trip Budget',
  insightNoun: 'trip',
  defaultInput: { targetAmount: 8000, currentSavings: 500, annualRatePct: 2, years: 1 },
})

export const MillionairePlanner = make({
  slug: 'millionaire-planner',
  title: 'Millionaire Planner',
  categoryLabel: 'Goal Planning',
  description: 'The realistic monthly savings path from where you are to a seven-figure net worth.',
  targetLabel: 'Target Net Worth',
  insightNoun: 'net worth target',
  defaultInput: { targetAmount: 1000000, currentSavings: 20000, annualRatePct: 8, years: 25 },
})

export const RetirementTimelinePlanner = make({
  slug: 'retirement-timeline',
  title: 'Retirement Timeline',
  categoryLabel: 'Goal Planning',
  description: 'Map the savings path to your retirement number by a specific date.',
  targetLabel: 'Retirement Corpus Target',
  insightNoun: 'retirement corpus',
  defaultInput: { targetAmount: 1500000, currentSavings: 50000, annualRatePct: 7, years: 25 },
})

export const ChildEducationFundPlanner = make({
  slug: 'child-education-fund',
  title: 'Child Education Fund',
  categoryLabel: 'Family',
  description: 'Save ahead of time for future tuition instead of relying on loans later.',
  targetLabel: 'Education Fund Target',
  insightNoun: "child's education fund",
  defaultInput: { targetAmount: 100000, currentSavings: 5000, annualRatePct: 5, years: 15 },
})

export const MarriageFundPlanner = make({
  slug: 'marriage-fund',
  title: 'Marriage Fund',
  categoryLabel: 'Family',
  description: 'Plan and save toward a wedding budget without last-minute debt.',
  targetLabel: 'Wedding Budget',
  insightNoun: 'wedding',
  defaultInput: { targetAmount: 30000, currentSavings: 3000, annualRatePct: 3, years: 2 },
})

export const VacationPlanner = make({
  slug: 'vacation-planner',
  title: 'Vacation Planner',
  categoryLabel: 'Family',
  description: 'Save toward a family vacation by a specific date.',
  targetLabel: 'Vacation Budget',
  insightNoun: 'vacation',
  defaultInput: { targetAmount: 6000, currentSavings: 500, annualRatePct: 2, years: 1 },
})

export const PassiveIncomePlanner = make({
  slug: 'passive-income-planner',
  title: 'Passive Income Planner',
  categoryLabel: 'Wealth Planning',
  description: 'The invested capital needed to eventually replace income with passive returns.',
  targetLabel: 'Capital Needed',
  insightNoun: 'passive-income target',
  defaultInput: { targetAmount: 500000, currentSavings: 25000, annualRatePct: 7, years: 20 },
})

export const InvestmentGoalPlanner = make({
  slug: 'investment-goal-planner',
  title: 'Investment Goal Planner',
  categoryLabel: 'Investment Toolkit',
  description: 'The monthly investment needed to reach any portfolio target by a given date.',
  targetLabel: 'Portfolio Target',
  insightNoun: 'portfolio target',
  defaultInput: { targetAmount: 250000, currentSavings: 15000, annualRatePct: 8, years: 15 },
})
