'use client'

import { GenericRatioCalculator, RatioCalculatorConfig } from './GenericRatioCalculator'
import { formatCurrency } from '@/lib/utils'

function make(config: RatioCalculatorConfig) {
  return function RatioCalculatorInstance() {
    return <GenericRatioCalculator config={config} />
  }
}

const money = (v: number) => formatCurrency(v, 'USD', true)
const pct = (v: number) => `${v.toFixed(1)}%`

// ── Salary ───────────────────────────────────────────────────
export const HourlyRateCalculator = make({
  slug: 'hourly-rate', title: 'Hourly Rate', categoryLabel: 'Salary',
  description: 'Convert an annual salary into an effective hourly rate, accounting for actual hours worked.',
  fields: [
    { key: 'annualSalary', label: 'Annual Salary', defaultValue: 75000, prefix: '$', step: 1000 },
    { key: 'hoursPerWeek', label: 'Hours Worked per Week', defaultValue: 45, step: 1, max: 80, showSlider: true },
    { key: 'weeksPerYear', label: 'Weeks Worked per Year', defaultValue: 48, step: 1, max: 52, showSlider: true, hint: 'Excludes unpaid time off' },
  ],
  compute: v => ({ hourlyRate: v.annualSalary / (v.hoursPerWeek * v.weeksPerYear) }),
  resultStats: [{ key: 'hourlyRate', label: 'Effective Hourly Rate', format: money, color: 'var(--text-green)', size: 'lg' }],
  insights: (v, r) => [`Working ${v.hoursPerWeek} hrs/week, you're effectively earning ${money(r.hourlyRate)}/hour — useful for comparing against contract or freelance rates.`],
})

export const FreelanceRateCalculator = make({
  slug: 'freelance-rate', title: 'Freelance Rate', categoryLabel: 'Salary',
  description: 'Back into the hourly rate you need to charge to hit a target income, accounting for unbillable time and overhead.',
  fields: [
    { key: 'targetIncome', label: 'Target Annual Income', defaultValue: 90000, prefix: '$', step: 1000 },
    { key: 'billablePctOfWeek', label: 'Billable Hours (% of work week)', defaultValue: 65, suffix: '%', max: 100, showSlider: true, hint: 'Time actually spent on paid client work' },
    { key: 'hoursPerWeek', label: 'Work Hours per Week', defaultValue: 40, step: 1, max: 70, showSlider: true },
    { key: 'weeksPerYear', label: 'Working Weeks per Year', defaultValue: 46, step: 1, max: 52, showSlider: true },
    { key: 'annualOverhead', label: 'Annual Business Overhead', defaultValue: 6000, prefix: '$', step: 250, hint: 'Software, insurance, taxes set-aside, etc.' },
  ],
  compute: v => {
    const billableHours = v.hoursPerWeek * (v.billablePctOfWeek / 100) * v.weeksPerYear
    const requiredRevenue = v.targetIncome + v.annualOverhead
    return { billableHours, requiredHourlyRate: billableHours > 0 ? requiredRevenue / billableHours : 0 }
  },
  resultStats: [
    { key: 'requiredHourlyRate', label: 'Required Hourly Rate', format: money, color: 'var(--text-green)', size: 'lg' },
    { key: 'billableHours', label: 'Billable Hours / Year', format: v => v.toFixed(0) },
  ],
  insights: (v, r) => [`Only ${v.billablePctOfWeek}% of your time is billable, so you need to charge ${money(r.requiredHourlyRate)}/hour to actually net ${money(v.targetIncome)} after overhead.`],
})

export const PromotionImpactCalculator = make({
  slug: 'promotion-impact', title: 'Promotion Impact', categoryLabel: 'Salary',
  description: 'The compounded lifetime value of a raise — a higher salary this year raises the base for every raise after it.',
  fields: [
    { key: 'currentSalary', label: 'Current Salary', defaultValue: 80000, prefix: '$', step: 1000 },
    { key: 'raisePct', label: 'Raise', defaultValue: 15, suffix: '%', max: 50, showSlider: true },
    { key: 'yearsRemaining', label: 'Years Left in Career', defaultValue: 25, max: 45, showSlider: true },
    { key: 'annualGrowthPct', label: 'Typical Annual Raise Otherwise', defaultValue: 3, suffix: '%', step: 0.5, max: 10, showSlider: true },
  ],
  compute: v => {
    let withPromo = v.currentSalary * (1 + v.raisePct / 100)
    let without = v.currentSalary
    let totalWith = 0, totalWithout = 0
    for (let y = 0; y < v.yearsRemaining; y++) {
      totalWith += withPromo
      totalWithout += without
      withPromo *= 1 + v.annualGrowthPct / 100
      without *= 1 + v.annualGrowthPct / 100
    }
    return { lifetimeValue: totalWith - totalWithout, newSalary: v.currentSalary * (1 + v.raisePct / 100) }
  },
  resultStats: [
    { key: 'newSalary', label: 'New Salary', format: money, color: 'var(--text-green)' },
    { key: 'lifetimeValue', label: 'Lifetime Value of This Raise', format: money, color: 'var(--text-gold)', size: 'lg' },
  ],
  insights: (v, r) => [`A one-time ${v.raisePct}% raise is worth ${money(r.lifetimeValue)} over the rest of your career, because every future raise compounds on top of it.`],
})

// ── Startup & Business ──────────────────────────────────────
export const RunwayCalculator = make({
  slug: 'runway-calculator', title: 'Runway Calculator', categoryLabel: 'Startup & Business',
  description: 'How many months of cash you have left at your current burn rate.',
  fields: [
    { key: 'cashInBank', label: 'Cash in Bank', defaultValue: 500000, prefix: '$', step: 10000 },
    { key: 'monthlyBurn', label: 'Monthly Net Burn', defaultValue: 45000, prefix: '$', step: 1000 },
  ],
  compute: v => ({ monthsOfRunway: v.monthlyBurn > 0 ? v.cashInBank / v.monthlyBurn : Infinity }),
  resultStats: [{ key: 'monthsOfRunway', label: 'Months of Runway', format: v => Number.isFinite(v) ? v.toFixed(1) : '∞', color: 'var(--text-green)', size: 'lg' }],
  insights: (v, r) => [Number.isFinite(r.monthsOfRunway) ? `At ${money(v.monthlyBurn)}/month burn, you have ${r.monthsOfRunway.toFixed(1)} months before running out of cash — most investors want to see 12-18+ months at your next raise.` : 'You have $0 net burn — cash is flat or growing.'],
})

export const BurnRateCalculator = make({
  slug: 'burn-rate', title: 'Burn Rate', categoryLabel: 'Startup & Business',
  description: 'Your net monthly cash outflow — the number that determines runway.',
  fields: [
    { key: 'monthlyExpenses', label: 'Monthly Expenses', defaultValue: 60000, prefix: '$', step: 1000 },
    { key: 'monthlyRevenue', label: 'Monthly Revenue', defaultValue: 15000, prefix: '$', step: 500 },
  ],
  compute: v => ({ netBurn: v.monthlyExpenses - v.monthlyRevenue }),
  resultStats: [{ key: 'netBurn', label: 'Net Monthly Burn', format: money, color: 'var(--text-red)', size: 'lg' }],
  insights: (v, r) => [r.netBurn > 0 ? `You're burning ${money(r.netBurn)}/month — revenue covers ${((v.monthlyRevenue / v.monthlyExpenses) * 100).toFixed(0)}% of expenses.` : `Revenue exceeds expenses by ${money(-r.netBurn)}/month — you're cash-flow positive.`],
})

export const BreakEvenCalculator = make({
  slug: 'break-even-calculator', title: 'Break-even Calculator', categoryLabel: 'Startup & Business',
  description: 'The unit sales or revenue you need to cover fixed costs exactly.',
  fields: [
    { key: 'fixedCosts', label: 'Monthly Fixed Costs', defaultValue: 20000, prefix: '$', step: 500 },
    { key: 'pricePerUnit', label: 'Price per Unit', defaultValue: 50, prefix: '$', step: 1 },
    { key: 'variableCostPerUnit', label: 'Variable Cost per Unit', defaultValue: 20, prefix: '$', step: 1 },
  ],
  compute: v => {
    const contributionMargin = v.pricePerUnit - v.variableCostPerUnit
    const breakEvenUnits = contributionMargin > 0 ? v.fixedCosts / contributionMargin : Infinity
    return { breakEvenUnits, breakEvenRevenue: breakEvenUnits * v.pricePerUnit }
  },
  resultStats: [
    { key: 'breakEvenUnits', label: 'Break-even Units / Month', format: v => Number.isFinite(v) ? Math.ceil(v).toString() : '—', color: 'var(--text-green)', size: 'lg' },
    { key: 'breakEvenRevenue', label: 'Break-even Revenue / Month', format: v => Number.isFinite(v) ? money(v) : '—' },
  ],
  insights: () => ['Break-even is where contribution margin (price minus variable cost) times units sold exactly covers fixed costs — every unit beyond this is profit.'],
})

export const MrrCalculator = make({
  slug: 'mrr-calculator', title: 'MRR Calculator', categoryLabel: 'Startup & Business',
  description: 'Monthly recurring revenue from your active subscriber base.',
  fields: [
    { key: 'subscribers', label: 'Active Subscribers', defaultValue: 500, step: 10 },
    { key: 'avgMonthlyPrice', label: 'Average Price per Subscriber', defaultValue: 29, prefix: '$', step: 1 },
  ],
  compute: v => ({ mrr: v.subscribers * v.avgMonthlyPrice, arr: v.subscribers * v.avgMonthlyPrice * 12 }),
  resultStats: [
    { key: 'mrr', label: 'MRR', format: money, color: 'var(--text-green)', size: 'lg' },
    { key: 'arr', label: 'Implied ARR', format: money, color: 'var(--text-blue)' },
  ],
  insights: () => ['MRR is the single most-watched SaaS metric — it turns lumpy revenue into a smooth, comparable monthly number.'],
})

export const ArrCalculator = make({
  slug: 'arr-calculator', title: 'ARR Calculator', categoryLabel: 'Startup & Business',
  description: 'Annualized recurring revenue from your current MRR.',
  fields: [{ key: 'mrr', label: 'Current MRR', defaultValue: 40000, prefix: '$', step: 500 }],
  compute: v => ({ arr: v.mrr * 12 }),
  resultStats: [{ key: 'arr', label: 'ARR', format: money, color: 'var(--text-green)', size: 'lg' }],
  insights: (v, r) => [`At ${money(v.mrr)} MRR, you're running at a ${money(r.arr)} annualized rate.`],
})

export const LtvCalculator = make({
  slug: 'ltv-calculator', title: 'LTV Calculator', categoryLabel: 'Startup & Business',
  description: 'Lifetime value of an average customer, based on revenue and retention.',
  fields: [
    { key: 'avgMonthlyRevenue', label: 'Avg Monthly Revenue per Customer', defaultValue: 50, prefix: '$', step: 1 },
    { key: 'grossMarginPct', label: 'Gross Margin', defaultValue: 80, suffix: '%', max: 100, showSlider: true },
    { key: 'monthlyChurnPct', label: 'Monthly Churn Rate', defaultValue: 3, suffix: '%', step: 0.1, max: 20, showSlider: true },
  ],
  compute: v => {
    const avgLifetimeMonths = v.monthlyChurnPct > 0 ? 1 / (v.monthlyChurnPct / 100) : Infinity
    const ltv = v.avgMonthlyRevenue * (v.grossMarginPct / 100) * avgLifetimeMonths
    return { ltv, avgLifetimeMonths }
  },
  resultStats: [
    { key: 'ltv', label: 'Customer LTV', format: v => Number.isFinite(v) ? money(v) : '—', color: 'var(--text-green)', size: 'lg' },
    { key: 'avgLifetimeMonths', label: 'Avg Customer Lifetime', format: v => Number.isFinite(v) ? `${v.toFixed(0)} mo` : '—' },
  ],
  insights: (v, r) => [Number.isFinite(r.ltv) ? `At ${v.monthlyChurnPct}% monthly churn, customers stick around ~${r.avgLifetimeMonths.toFixed(0)} months, worth ${money(r.ltv)} in gross-margin terms.` : 'With 0% churn, lifetime value is technically unbounded — use a realistic churn rate.'],
})

export const CacCalculator = make({
  slug: 'cac-calculator', title: 'CAC Calculator', categoryLabel: 'Startup & Business',
  description: 'What it actually costs you to acquire one paying customer.',
  fields: [
    { key: 'salesMarketingSpend', label: 'Sales & Marketing Spend (period)', defaultValue: 50000, prefix: '$', step: 1000 },
    { key: 'newCustomers', label: 'New Customers Acquired', defaultValue: 200, step: 5 },
  ],
  compute: v => ({ cac: v.newCustomers > 0 ? v.salesMarketingSpend / v.newCustomers : 0 }),
  resultStats: [{ key: 'cac', label: 'CAC', format: money, color: 'var(--text-orange)', size: 'lg' }],
  insights: (v, r) => [`You spent ${money(v.salesMarketingSpend)} to acquire ${v.newCustomers} customers — ${money(r.cac)} each.`],
})

export const LtvCacRatioCalculator = make({
  slug: 'ltv-cac-ratio', title: 'LTV:CAC Ratio', categoryLabel: 'Startup & Business',
  description: 'The single most important unit-economics health check for a subscription business.',
  fields: [
    { key: 'ltv', label: 'Customer LTV', defaultValue: 1200, prefix: '$', step: 50 },
    { key: 'cac', label: 'Customer Acquisition Cost', defaultValue: 300, prefix: '$', step: 25 },
  ],
  compute: v => ({ ratio: v.cac > 0 ? v.ltv / v.cac : 0 }),
  resultStats: [{ key: 'ratio', label: 'LTV:CAC Ratio', format: v => `${v.toFixed(1)}x`, color: 'var(--text-green)', size: 'lg' }],
  insights: (v, r) => [r.ratio >= 3 ? `${r.ratio.toFixed(1)}x is healthy — the classic target is 3x or higher.` : `${r.ratio.toFixed(1)}x is below the typical 3x healthy threshold — you're spending too much to acquire customers relative to what they're worth.`],
})

export const ChurnCalculator = make({
  slug: 'churn-calculator', title: 'Churn Calculator', categoryLabel: 'Startup & Business',
  description: 'Revenue and logo churn rate for a given period.',
  fields: [
    { key: 'customersStart', label: 'Customers at Start of Period', defaultValue: 1000, step: 10 },
    { key: 'customersLost', label: 'Customers Lost', defaultValue: 30, step: 1 },
    { key: 'mrrStart', label: 'MRR at Start of Period', defaultValue: 50000, prefix: '$', step: 500 },
    { key: 'mrrLost', label: 'MRR Lost to Churn', defaultValue: 1800, prefix: '$', step: 50 },
  ],
  compute: v => ({
    logoChurnPct: v.customersStart > 0 ? (v.customersLost / v.customersStart) * 100 : 0,
    revenueChurnPct: v.mrrStart > 0 ? (v.mrrLost / v.mrrStart) * 100 : 0,
  }),
  resultStats: [
    { key: 'logoChurnPct', label: 'Logo Churn', format: pct, color: 'var(--text-red)', size: 'lg' },
    { key: 'revenueChurnPct', label: 'Revenue Churn', format: pct, color: 'var(--text-orange)', size: 'lg' },
  ],
  insights: (v, r) => [r.logoChurnPct > 5 ? 'Over 5% monthly logo churn is high for most B2B SaaS — worth digging into why customers are leaving.' : 'Under 5% monthly churn is a reasonable range for most subscription businesses.'],
})

export const SaasValuationCalculator = make({
  slug: 'saas-valuation', title: 'SaaS Valuation', categoryLabel: 'Startup & Business',
  description: 'A quick revenue-multiple valuation estimate — a starting point for a conversation, not an appraisal.',
  fields: [
    { key: 'arr', label: 'Annual Recurring Revenue', defaultValue: 1200000, prefix: '$', step: 10000 },
    { key: 'growthRatePct', label: 'YoY Growth Rate', defaultValue: 40, suffix: '%', max: 200, showSlider: true },
    { key: 'revenueMultiple', label: 'Revenue Multiple', defaultValue: 6, step: 0.5, max: 20, showSlider: true, hint: 'Higher growth typically supports a higher multiple' },
  ],
  compute: v => ({ estimatedValuation: v.arr * v.revenueMultiple }),
  resultStats: [{ key: 'estimatedValuation', label: 'Estimated Valuation', format: money, color: 'var(--text-gold)', size: 'lg' }],
  insights: (v) => [`At ${v.growthRatePct}% growth, a ${v.revenueMultiple}x multiple is a common starting range — actual multiples vary widely by margin, retention, and market conditions.`],
})

export const StartupValuationCalculator = make({
  slug: 'startup-valuation', title: 'Startup Valuation', categoryLabel: 'Startup & Business',
  description: 'Compare a revenue-multiple estimate against a simple discounted-exit approach for an early-stage company.',
  fields: [
    { key: 'currentRevenue', label: 'Current Annual Revenue', defaultValue: 200000, prefix: '$', step: 10000 },
    { key: 'revenueMultiple', label: 'Revenue Multiple', defaultValue: 4, step: 0.5, max: 15, showSlider: true },
    { key: 'projectedExitValue', label: 'Projected Exit Value (in N years)', defaultValue: 20000000, prefix: '$', step: 500000 },
    { key: 'yearsToExit', label: 'Years to Exit', defaultValue: 6, max: 12, showSlider: true },
    { key: 'discountRatePct', label: 'Discount Rate', defaultValue: 30, suffix: '%', step: 1, max: 60, showSlider: true, hint: 'Venture-stage discount rates run high (25-40%+)' },
  ],
  compute: v => ({
    revenueMultipleValue: v.currentRevenue * v.revenueMultiple,
    discountedExitValue: v.projectedExitValue / Math.pow(1 + v.discountRatePct / 100, v.yearsToExit),
  }),
  resultStats: [
    { key: 'revenueMultipleValue', label: 'Revenue-Multiple Estimate', format: money, color: 'var(--text-green)' },
    { key: 'discountedExitValue', label: 'Discounted Exit-Value Estimate', format: money, color: 'var(--text-gold)' },
  ],
  insights: () => ['Early-stage valuation is inherently a negotiation, not a formula — these two approaches are common reference points, not a single "right" answer.'],
})

export const PricingSimulatorCalculator = make({
  slug: 'pricing-simulator', title: 'Pricing Simulator', categoryLabel: 'Startup & Business',
  description: 'Model how a price change affects revenue, assuming a simple demand response.',
  fields: [
    { key: 'currentPrice', label: 'Current Price', defaultValue: 49, prefix: '$', step: 1 },
    { key: 'currentUnitsSold', label: 'Current Monthly Units Sold', defaultValue: 400, step: 10 },
    { key: 'newPrice', label: 'New Price', defaultValue: 59, prefix: '$', step: 1 },
    { key: 'demandElasticityPct', label: 'Expected Demand Drop', defaultValue: 12, suffix: '%', max: 80, showSlider: true, hint: 'How much unit sales fall for this price increase' },
  ],
  compute: v => {
    const currentRevenue = v.currentPrice * v.currentUnitsSold
    const newUnits = v.currentUnitsSold * (1 - v.demandElasticityPct / 100)
    const newRevenue = v.newPrice * newUnits
    return { currentRevenue, newRevenue, revenueDelta: newRevenue - currentRevenue }
  },
  resultStats: [
    { key: 'newRevenue', label: 'Projected New Revenue', format: money, color: 'var(--text-green)', size: 'lg' },
    { key: 'revenueDelta', label: 'Revenue Change', format: v => `${v >= 0 ? '+' : ''}${money(v)}`, color: 'var(--text-blue)' },
  ],
  insights: (v, r) => [r.revenueDelta >= 0 ? `Even with a ${v.demandElasticityPct}% drop in units sold, the price increase grows revenue by ${money(r.revenueDelta)}/month.` : `A ${v.demandElasticityPct}% demand drop outweighs the price increase — revenue falls by ${money(-r.revenueDelta)}/month. Your actual demand elasticity is the key unknown here.`],
})

// ── Loans ────────────────────────────────────────────────────
export const DebtToIncomeCalculator = make({
  slug: 'debt-to-income-ratio', title: 'Debt-to-Income Ratio', categoryLabel: 'Loans',
  description: 'Your DTI ratio — one of the first numbers a lender checks on any loan application.',
  fields: [
    { key: 'monthlyDebtPayments', label: 'Total Monthly Debt Payments', defaultValue: 1200, prefix: '$', step: 50, hint: 'Rent/mortgage, car, student loans, credit cards, etc.' },
    { key: 'grossMonthlyIncome', label: 'Gross Monthly Income', defaultValue: 6500, prefix: '$', step: 100 },
  ],
  compute: v => ({ dtiPct: v.grossMonthlyIncome > 0 ? (v.monthlyDebtPayments / v.grossMonthlyIncome) * 100 : 0 }),
  resultStats: [{ key: 'dtiPct', label: 'Debt-to-Income Ratio', format: pct, color: 'var(--text-green)', size: 'lg' }],
  insights: (v, r) => [r.dtiPct <= 36 ? `${r.dtiPct.toFixed(1)}% is in the range most lenders consider healthy (under 36%).` : r.dtiPct <= 43 ? `${r.dtiPct.toFixed(1)}% is workable for many mortgage programs but on the higher side (most cap around 43%).` : `${r.dtiPct.toFixed(1)}% is above what most conventional lenders will approve — paying down debt or increasing income would help.`],
})

// ── Tax Planning (simplified — flat-rate estimates, not a bracket engine) ──
export const CapitalGainsTaxCalculator = make({
  slug: 'capital-gains-tax', title: 'Capital Gains Tax', categoryLabel: 'Tax Planning',
  description: 'A simplified short-term vs long-term capital gains estimate — actual rates depend on your full tax situation.',
  fields: [
    { key: 'purchasePrice', label: 'Purchase Price', defaultValue: 10000, prefix: '$', step: 500 },
    { key: 'salePrice', label: 'Sale Price', defaultValue: 15000, prefix: '$', step: 500 },
    { key: 'shortTermRatePct', label: 'Short-Term Rate (your ordinary income bracket)', defaultValue: 24, suffix: '%', max: 40, showSlider: true },
    { key: 'longTermRatePct', label: 'Long-Term Rate (held over 1 year)', defaultValue: 15, suffix: '%', max: 25, showSlider: true },
  ],
  compute: v => {
    const gain = v.salePrice - v.purchasePrice
    return { gain, shortTermTax: gain * (v.shortTermRatePct / 100), longTermTax: gain * (v.longTermRatePct / 100) }
  },
  resultStats: [
    { key: 'gain', label: 'Capital Gain', format: money, color: 'var(--text-blue)' },
    { key: 'shortTermTax', label: 'If Short-Term', format: money, color: 'var(--text-red)' },
    { key: 'longTermTax', label: 'If Long-Term', format: money, color: 'var(--text-green)', size: 'lg' },
  ],
  insights: (v, r) => [`Holding past one year moves this from short-term to long-term rates, saving ${money(r.shortTermTax - r.longTermTax)} in this example.`],
})

export const ClosingCostEstimator = make({
  slug: 'closing-cost-estimator', title: 'Closing Cost Estimator', categoryLabel: 'Real Estate',
  description: 'A rough estimate of fees due at closing — actual costs vary significantly by state and lender.',
  fields: [
    { key: 'homePrice', label: 'Home Price', defaultValue: 400000, prefix: '$', step: 5000 },
    { key: 'closingCostPct', label: 'Estimated Closing Cost %', defaultValue: 3, suffix: '%', step: 0.25, max: 6, showSlider: true, hint: 'Typically 2-5% of the home price' },
  ],
  compute: v => ({ estimatedClosingCosts: v.homePrice * (v.closingCostPct / 100) }),
  resultStats: [{ key: 'estimatedClosingCosts', label: 'Estimated Closing Costs', format: money, color: 'var(--text-orange)', size: 'lg' }],
  insights: () => ['Closing costs typically include lender fees, title insurance, appraisal, escrow, and local transfer taxes — get a real Loan Estimate from your lender for an exact number.'],
})

export const CashFlowCalculator = make({
  slug: 'cash-flow-calculator', title: 'Cash Flow Calculator', categoryLabel: 'Real Estate',
  description: 'Monthly cash flow on a rental after mortgage and operating expenses.',
  fields: [
    { key: 'monthlyRent', label: 'Monthly Rent', defaultValue: 2400, prefix: '$', step: 50 },
    { key: 'monthlyMortgage', label: 'Monthly Mortgage Payment', defaultValue: 1500, prefix: '$', step: 50 },
    { key: 'monthlyExpenses', label: 'Other Monthly Expenses', defaultValue: 400, prefix: '$', step: 25, hint: 'Insurance, tax escrow, maintenance reserve, management' },
  ],
  compute: v => ({ monthlyCashFlow: v.monthlyRent - v.monthlyMortgage - v.monthlyExpenses }),
  resultStats: [{ key: 'monthlyCashFlow', label: 'Monthly Cash Flow', format: money, color: 'var(--text-green)', size: 'lg' }],
  insights: (v, r) => [r.monthlyCashFlow >= 0 ? `This property nets ${money(r.monthlyCashFlow)}/month after debt service and expenses.` : `This property is running ${money(-r.monthlyCashFlow)}/month negative — you'd be subsidizing it out of pocket.`],
})

export const PropertyRoiCalculator = make({
  slug: 'property-roi', title: 'Property ROI', categoryLabel: 'Real Estate',
  description: 'Total return on a property including both cash flow and price appreciation.',
  fields: [
    { key: 'cashInvested', label: 'Total Cash Invested', defaultValue: 80000, prefix: '$', step: 1000 },
    { key: 'annualCashFlow', label: 'Annual Cash Flow', defaultValue: 6000, prefix: '$', step: 250 },
    { key: 'annualAppreciation', label: 'Annual Appreciation (dollar amount)', defaultValue: 12000, prefix: '$', step: 500, hint: 'Property value × expected appreciation rate' },
  ],
  compute: v => ({ totalAnnualReturn: v.annualCashFlow + v.annualAppreciation, roiPct: v.cashInvested > 0 ? ((v.annualCashFlow + v.annualAppreciation) / v.cashInvested) * 100 : 0 }),
  resultStats: [
    { key: 'totalAnnualReturn', label: 'Total Annual Return', format: money, color: 'var(--text-blue)' },
    { key: 'roiPct', label: 'Total ROI', format: pct, color: 'var(--text-green)', size: 'lg' },
  ],
  insights: () => ['Total ROI combines cash-on-cash return with paper appreciation — appreciation is unrealized until you sell or refinance, so weight cash flow more heavily if you need liquidity.'],
})

// ── Investment (simplified point-estimates) ─────────────────
export const DividendIncomeCalculator = make({
  slug: 'dividend-income-calculator', title: 'Dividend Income Calculator', categoryLabel: 'Investment Toolkit',
  description: 'Project dividend income and what reinvesting it does to your position over time.',
  fields: [
    { key: 'portfolioValue', label: 'Portfolio Value', defaultValue: 100000, prefix: '$', step: 5000 },
    { key: 'dividendYieldPct', label: 'Dividend Yield', defaultValue: 3.5, suffix: '%', step: 0.1, max: 12, showSlider: true },
    { key: 'years', label: 'Years Reinvested', defaultValue: 15, max: 40, showSlider: true },
    { key: 'dividendGrowthPct', label: 'Annual Dividend Growth', defaultValue: 5, suffix: '%', step: 0.5, max: 15, showSlider: true },
  ],
  compute: v => {
    let value = v.portfolioValue
    let annualIncome = v.portfolioValue * (v.dividendYieldPct / 100)
    for (let y = 0; y < v.years; y++) {
      value += annualIncome
      annualIncome *= 1 + v.dividendGrowthPct / 100
    }
    return { currentAnnualIncome: v.portfolioValue * (v.dividendYieldPct / 100), futureAnnualIncome: annualIncome, futurePortfolioValue: value }
  },
  resultStats: [
    { key: 'currentAnnualIncome', label: 'Current Annual Dividend Income', format: money },
    { key: 'futureAnnualIncome', label: 'Future Annual Dividend Income', format: money, color: 'var(--text-green)', size: 'lg' },
    { key: 'futurePortfolioValue', label: 'Portfolio Value (Reinvested)', format: money, color: 'var(--text-blue)' },
  ],
  insights: () => ['This assumes dividends are fully reinvested and the yield-on-original-cost grows with the dividend growth rate — a simplification of how real dividend growth investing compounds.'],
})

export const ExpectedReturnSimulator = make({
  slug: 'expected-return-simulator', title: 'Expected Return Simulator', categoryLabel: 'Investment Toolkit',
  description: 'A range of outcomes for a portfolio under optimistic, base-case, and pessimistic return assumptions.',
  fields: [
    { key: 'initialInvestment', label: 'Initial Investment', defaultValue: 50000, prefix: '$', step: 1000 },
    { key: 'years', label: 'Time Horizon', defaultValue: 20, max: 40, showSlider: true },
    { key: 'pessimisticReturnPct', label: 'Pessimistic Annual Return', defaultValue: 3, suffix: '%', step: 0.5, max: 15, showSlider: true },
    { key: 'baseReturnPct', label: 'Base-Case Annual Return', defaultValue: 8, suffix: '%', step: 0.5, max: 15, showSlider: true },
    { key: 'optimisticReturnPct', label: 'Optimistic Annual Return', defaultValue: 12, suffix: '%', step: 0.5, max: 20, showSlider: true },
  ],
  compute: v => ({
    pessimisticValue: v.initialInvestment * Math.pow(1 + v.pessimisticReturnPct / 100, v.years),
    baseValue: v.initialInvestment * Math.pow(1 + v.baseReturnPct / 100, v.years),
    optimisticValue: v.initialInvestment * Math.pow(1 + v.optimisticReturnPct / 100, v.years),
  }),
  resultStats: [
    { key: 'pessimisticValue', label: 'Pessimistic Case', format: money, color: 'var(--text-red)' },
    { key: 'baseValue', label: 'Base Case', format: money, color: 'var(--text-green)', size: 'lg' },
    { key: 'optimisticValue', label: 'Optimistic Case', format: money, color: 'var(--text-gold)' },
  ],
  insights: () => ['Three fixed-rate scenarios, not a statistical distribution — for a proper range of probability-weighted outcomes, see the Monte Carlo Simulation.'],
})

// ── Wealth Planning ──────────────────────────────────────────
export const NetWorthCalculator = make({
  slug: 'net-worth-calculator', title: 'Net Worth Calculator', categoryLabel: 'Wealth Planning',
  description: 'A quick manual snapshot of assets minus liabilities. For a live number pulled from your actual accounts, see the Net Worth page.',
  fields: [
    { key: 'cash', label: 'Cash & Savings', defaultValue: 15000, prefix: '$', step: 500 },
    { key: 'investments', label: 'Investments & Retirement Accounts', defaultValue: 60000, prefix: '$', step: 1000 },
    { key: 'realEstate', label: 'Real Estate Value', defaultValue: 0, prefix: '$', step: 5000 },
    { key: 'otherAssets', label: 'Other Assets', defaultValue: 5000, prefix: '$', step: 500 },
    { key: 'mortgageDebt', label: 'Mortgage Debt', defaultValue: 0, prefix: '$', step: 5000 },
    { key: 'otherDebt', label: 'Other Debt', defaultValue: 8000, prefix: '$', step: 500, hint: 'Credit cards, student loans, auto loans' },
  ],
  compute: v => {
    const totalAssets = v.cash + v.investments + v.realEstate + v.otherAssets
    const totalLiabilities = v.mortgageDebt + v.otherDebt
    return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities }
  },
  resultStats: [
    { key: 'totalAssets', label: 'Total Assets', format: money, color: 'var(--text-green)' },
    { key: 'totalLiabilities', label: 'Total Liabilities', format: money, color: 'var(--text-red)' },
    { key: 'netWorth', label: 'Net Worth', format: money, color: 'var(--text-blue)', size: 'lg' },
  ],
  insights: (v, r) => [`Net worth = ${money(r.totalAssets)} in assets minus ${money(r.totalLiabilities)} in liabilities = ${money(r.netWorth)}.`],
})

// ── Family ───────────────────────────────────────────────────
export const FamilyBudgetPlanner = make({
  slug: 'family-budget-planner', title: 'Family Budget Planner', categoryLabel: 'Family',
  description: 'A simple household budget check across income and major expense categories.',
  fields: [
    { key: 'householdIncome', label: 'Monthly Household Income', defaultValue: 8000, prefix: '$', step: 100 },
    { key: 'housing', label: 'Housing', defaultValue: 2000, prefix: '$', step: 50 },
    { key: 'transportation', label: 'Transportation', defaultValue: 700, prefix: '$', step: 25 },
    { key: 'food', label: 'Food & Groceries', defaultValue: 900, prefix: '$', step: 25 },
    { key: 'childcareOther', label: 'Childcare & Other Fixed Costs', defaultValue: 1200, prefix: '$', step: 50 },
  ],
  compute: v => {
    const totalExpenses = v.housing + v.transportation + v.food + v.childcareOther
    return { totalExpenses, remaining: v.householdIncome - totalExpenses, savingsRatePct: v.householdIncome > 0 ? ((v.householdIncome - totalExpenses) / v.householdIncome) * 100 : 0 }
  },
  resultStats: [
    { key: 'totalExpenses', label: 'Total Monthly Expenses', format: money },
    { key: 'remaining', label: 'Remaining for Savings/Discretionary', format: money, color: 'var(--text-green)', size: 'lg' },
    { key: 'savingsRatePct', label: 'Implied Savings Rate', format: pct, color: 'var(--text-blue)' },
  ],
  insights: (v, r) => [r.remaining >= 0 ? `You have ${money(r.remaining)}/month left after these core categories — a ${r.savingsRatePct.toFixed(0)}% savings rate if all of it goes to savings.` : `Expenses exceed income by ${money(-r.remaining)}/month in this breakdown — worth reviewing the largest categories.`],
})

// ── Cost of living (simplified — manual index ratio, not a real city database) ──
export const CostOfLivingComparisonCalculator = make({
  slug: 'cost-of-living-comparison', title: 'Cost of Living Comparison', categoryLabel: 'Salary',
  description: 'What a salary is really worth in a new city, using a cost-of-living index ratio you provide.',
  fields: [
    { key: 'currentSalary', label: 'Current Salary', defaultValue: 90000, prefix: '$', step: 1000 },
    { key: 'currentCityIndex', label: 'Current City Cost Index', defaultValue: 100, step: 1, hint: 'Use 100 as your baseline city' },
    { key: 'newCityIndex', label: 'New City Cost Index', defaultValue: 145, step: 1, hint: 'Look up cost-of-living indices online — e.g. Numbeo' },
  ],
  compute: v => ({ equivalentSalary: v.currentCityIndex > 0 ? v.currentSalary * (v.newCityIndex / v.currentCityIndex) : v.currentSalary }),
  resultStats: [{ key: 'equivalentSalary', label: 'Equivalent Salary in New City', format: money, color: 'var(--text-green)', size: 'lg' }],
  insights: (v, r) => [`To maintain the same lifestyle, ${money(v.currentSalary)} in your current city is roughly equivalent to ${money(r.equivalentSalary)} in the new city, based on the index ratio you entered.`],
})

export const EmiCalculatorAlias = make({
  slug: 'emi-calculator', title: 'EMI Calculator', categoryLabel: 'Loans',
  description: 'Equated monthly installment for any loan — same math as the Loan EMI calculator, here under its common alternate name.',
  fields: [
    { key: 'loanAmount', label: 'Loan Amount', defaultValue: 20000, prefix: '$', step: 500 },
    { key: 'annualRatePct', label: 'Annual Interest Rate', defaultValue: 9, suffix: '%', step: 0.25, max: 30, showSlider: true },
    { key: 'termYears', label: 'Loan Term', defaultValue: 5, suffix: 'yrs', max: 30, showSlider: true },
  ],
  compute: v => {
    const r = v.annualRatePct / 100 / 12
    const n = v.termYears * 12
    const emi = r === 0 ? v.loanAmount / n : (v.loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    return { emi, totalPayment: emi * n, totalInterest: emi * n - v.loanAmount }
  },
  resultStats: [
    { key: 'emi', label: 'Monthly EMI', format: money, color: 'var(--text-green)', size: 'lg' },
    { key: 'totalInterest', label: 'Total Interest', format: money, color: 'var(--text-red)' },
  ],
  insights: (v, r) => [`Over ${v.termYears} years you'll pay ${money(r.totalInterest)} in interest on top of the ${money(v.loanAmount)} borrowed.`],
})

export const AfterTaxIncomeAlias = make({
  slug: 'after-tax-income', title: 'After-Tax Income', categoryLabel: 'Tax Planning',
  description: 'What actually lands in your account after taxes and pre-tax deductions — a simplified flat-rate estimate.',
  fields: [
    { key: 'grossAnnualSalary', label: 'Gross Annual Salary', defaultValue: 85000, prefix: '$', step: 1000 },
    { key: 'effectiveTaxRatePct', label: 'Effective Tax Rate', defaultValue: 24, suffix: '%', step: 0.5, max: 50, showSlider: true, hint: 'Combined federal + state, as a flat estimate' },
    { key: 'preTaxDeductionsMonthly', label: 'Pre-Tax Deductions (Monthly)', defaultValue: 400, prefix: '$', step: 25 },
  ],
  compute: v => {
    const annualPreTax = v.preTaxDeductionsMonthly * 12
    const taxable = Math.max(0, v.grossAnnualSalary - annualPreTax)
    const tax = taxable * (v.effectiveTaxRatePct / 100)
    const afterTax = v.grossAnnualSalary - annualPreTax - tax
    return { annualAfterTax: afterTax, monthlyAfterTax: afterTax / 12 }
  },
  resultStats: [
    { key: 'monthlyAfterTax', label: 'Monthly After-Tax Income', format: money, color: 'var(--text-green)', size: 'lg' },
    { key: 'annualAfterTax', label: 'Annual After-Tax Income', format: money, color: 'var(--text-blue)' },
  ],
  insights: () => ['This uses one flat effective tax rate, not real tax brackets — treat it as directional, not a filing estimate.'],
})

export const PropertyAppreciationCalculator = make({
  slug: 'property-appreciation', title: 'Property Appreciation', categoryLabel: 'Real Estate',
  description: 'Project a property\'s value forward at an assumed annual appreciation rate.',
  fields: [
    { key: 'currentValue', label: 'Current Property Value', defaultValue: 400000, prefix: '$', step: 5000 },
    { key: 'annualAppreciationPct', label: 'Annual Appreciation Rate', defaultValue: 3.5, suffix: '%', step: 0.25, max: 12, showSlider: true },
    { key: 'years', label: 'Holding Period', defaultValue: 10, suffix: 'yrs', max: 30, showSlider: true },
  ],
  compute: v => ({ futureValue: v.currentValue * Math.pow(1 + v.annualAppreciationPct / 100, v.years) }),
  resultStats: [{ key: 'futureValue', label: 'Projected Future Value', format: money, color: 'var(--text-green)', size: 'lg' }],
  insights: (v, r) => [`At ${v.annualAppreciationPct}% annual appreciation, this property is projected to be worth ${money(r.futureValue)} in ${v.years} years — real appreciation varies by market and isn't guaranteed.`],
})

export const CreditCardPayoffCalculator = make({
  slug: 'credit-card-payoff', title: 'Credit Card Payoff', categoryLabel: 'Loans',
  description: 'Time and total interest to clear a single card balance at a fixed monthly payment.',
  fields: [
    { key: 'balance', label: 'Current Balance', defaultValue: 5000, prefix: '$', step: 100 },
    { key: 'aprPct', label: 'APR', defaultValue: 22, suffix: '%', step: 0.5, max: 35, showSlider: true },
    { key: 'monthlyPayment', label: 'Monthly Payment', defaultValue: 200, prefix: '$', step: 10 },
  ],
  compute: v => {
    let balance = v.balance
    let months = 0
    let totalInterest = 0
    const monthlyRate = v.aprPct / 100 / 12
    while (balance > 0.01 && months < 600) {
      const interest = balance * monthlyRate
      totalInterest += interest
      balance += interest
      const payment = Math.min(balance, v.monthlyPayment)
      if (payment <= interest && months === 0) { months = -1; break } // payment doesn't even cover interest
      balance -= payment
      months++
    }
    return { monthsToPayoff: months, totalInterest }
  },
  resultStats: [
    { key: 'monthsToPayoff', label: 'Months to Pay Off', format: v => v === -1 ? 'Never at this payment' : v.toFixed(0), color: 'var(--text-green)', size: 'lg' },
    { key: 'totalInterest', label: 'Total Interest Paid', format: v => v > 0 ? money(v) : '—', color: 'var(--text-red)' },
  ],
  insights: (v, r) => [r.monthsToPayoff === -1 ? `At ${money(v.monthlyPayment)}/month, your payment doesn't even cover the interest — the balance will grow, not shrink.` : `Paying ${money(v.monthlyPayment)}/month clears this balance in ${r.monthsToPayoff} months, at a cost of ${money(r.totalInterest)} in interest.`],
})
