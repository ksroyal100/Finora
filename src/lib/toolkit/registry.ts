// src/lib/toolkit/registry.ts
//
// Single source of truth for the Financial Toolkit's information architecture.
// Adding a new calculator later is: (1) add an entry here with status:'live',
// (2) add its component under components/toolkit/calculators, (3) map the slug
// in ToolRenderer.tsx. No new route files needed — the [slug] page is generic.

export type ToolCategoryId =
  | 'wealth-planning' | 'investment-toolkit' | 'real-estate' | 'startup-business'
  | 'loans' | 'tax-planning' | 'salary' | 'family' | 'goal-planning' | 'ai-planner'

export interface ToolCategory {
  id: ToolCategoryId
  label: string
  description: string
}

export interface ToolMeta {
  slug: string
  title: string
  category: ToolCategoryId
  description: string
  status: 'live' | 'soon'
  tier: 'free' | 'pro'
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  { id: 'wealth-planning',    label: 'Wealth Planning',     description: 'Grow, project, and protect your net worth over time.' },
  { id: 'investment-toolkit', label: 'Investment Toolkit',  description: 'Model returns, allocation, and portfolio risk.' },
  { id: 'real-estate',        label: 'Real Estate',         description: 'Mortgages, rentals, and property investment math.' },
  { id: 'startup-business',   label: 'Startup & Business',  description: 'Runway, unit economics, and valuation.' },
  { id: 'loans',              label: 'Loans',               description: 'Payoff strategy and borrowing costs.' },
  { id: 'tax-planning',       label: 'Tax Planning',        description: 'Estimate liability and plan around it.' },
  { id: 'salary',             label: 'Salary',              description: 'Compare offers and price your time.' },
  { id: 'family',             label: 'Family',               description: 'Plan for the big shared milestones.' },
  { id: 'goal-planning',      label: 'Goal Planning',       description: 'Reverse-engineer the big purchases and dreams.' },
  { id: 'ai-planner',         label: 'AI Financial Planner', description: 'Describe a goal in plain English, get a plan.' },
]

export const TOOLS: ToolMeta[] = [
  // ── Wealth Planning ──────────────────────────────────────────
  { slug: 'net-worth-calculator',        title: 'Net Worth Calculator',        category: 'wealth-planning', status: 'live', description: 'Snapshot of assets minus liabilities — pulled from your account.', tier: 'pro' },
  { slug: 'compound-interest',           title: 'Compound Interest Calculator', category: 'wealth-planning', status: 'live', description: 'See how contributions and time compound into real money.', tier: 'free' },
  { slug: 'future-value',                title: 'Future Value Calculator',      category: 'wealth-planning', status: 'live', description: 'What a lump sum grows to by a future date.', tier: 'free' },
  { slug: 'present-value',               title: 'Present Value Calculator',     category: 'wealth-planning', status: 'live', description: 'What a future sum is worth in today\u2019s money.', tier: 'free' },
  { slug: 'inflation-calculator',        title: 'Inflation Calculator',         category: 'wealth-planning', status: 'live', description: 'How inflation erodes purchasing power over time.', tier: 'free' },
  { slug: 'retirement-planner',          title: 'Retirement Planner',           category: 'wealth-planning', status: 'live', description: 'The corpus you need, and whether you\u2019re on track.', tier: 'free' },
  { slug: 'fire-calculator',             title: 'FIRE Calculator',              category: 'wealth-planning', status: 'live', description: 'Your number for financial independence, and when you\u2019ll hit it.', tier: 'free' },
  { slug: 'emergency-fund-planner',      title: 'Emergency Fund Planner',       category: 'wealth-planning', status: 'live', description: 'Right-size your safety net using your real expenses.', tier: 'free' },
  { slug: 'savings-goal-planner',        title: 'Savings Goal Planner',         category: 'wealth-planning', status: 'live', description: 'Reverse-engineer the monthly savings for any target.', tier: 'free' },
  { slug: 'financial-freedom-timeline',  title: 'Financial Freedom Timeline',   category: 'wealth-planning', status: 'live', description: 'A visual timeline of every milestone ahead.', tier: 'pro' },
  { slug: 'wealth-growth-simulator',     title: 'Wealth Growth Simulator',      category: 'wealth-planning', status: 'live', description: 'Simulate net worth under different life scenarios.', tier: 'pro' },
  { slug: 'passive-income-planner',      title: 'Passive Income Planner',       category: 'wealth-planning', status: 'live', description: 'What it takes to replace income with passive streams.', tier: 'pro' },

  // ── Investment Toolkit ───────────────────────────────────────
  { slug: 'sip-calculator',              title: 'SIP Calculator',               category: 'investment-toolkit', status: 'live', description: 'Recurring investment growth, with optional annual step-up.', tier: 'free' },
  { slug: 'lump-sum-calculator',         title: 'Lump Sum Calculator',          category: 'investment-toolkit', status: 'live', description: 'Grow a one-time investment at a fixed return.', tier: 'pro' },
  { slug: 'swp-calculator',              title: 'SWP Calculator',               category: 'investment-toolkit', status: 'live', description: 'How long a corpus lasts under systematic withdrawal.', tier: 'pro' },
  { slug: 'cagr-calculator',             title: 'CAGR Calculator',              category: 'investment-toolkit', status: 'live', description: 'Annualize the return between two portfolio values.', tier: 'free' },
  { slug: 'xirr-calculator',             title: 'XIRR Calculator',              category: 'investment-toolkit', status: 'live', description: 'Annualized return across irregular cash flows.', tier: 'pro' },
  { slug: 'portfolio-return-calculator', title: 'Portfolio Return Calculator',  category: 'investment-toolkit', status: 'live', description: 'Blended return across your actual holdings.', tier: 'pro' },
  { slug: 'portfolio-allocation',        title: 'Portfolio Allocation Calculator', category: 'investment-toolkit', status: 'live', description: 'Where your money sits across asset classes.', tier: 'pro' },
  { slug: 'portfolio-rebalancing',       title: 'Portfolio Rebalancing',         category: 'investment-toolkit', status: 'live', description: 'Trades needed to get back to target allocation.', tier: 'pro' },
  { slug: 'dividend-income-calculator',  title: 'Dividend Income Calculator',    category: 'investment-toolkit', status: 'live', description: 'Project dividend income and reinvestment growth.', tier: 'pro' },
  { slug: 'risk-analysis',               title: 'Risk Analysis',                category: 'investment-toolkit', status: 'live', description: 'Volatility and concentration across your portfolio.', tier: 'pro' },
  { slug: 'expected-return-simulator',   title: 'Expected Return Simulator',    category: 'investment-toolkit', status: 'live', description: 'Range of outcomes under different market regimes.', tier: 'pro' },
  { slug: 'monte-carlo-simulation',      title: 'Monte Carlo Portfolio Simulation', category: 'investment-toolkit', status: 'live', description: 'Thousands of simulated paths for your portfolio.', tier: 'pro' },
  { slug: 'investment-goal-planner',     title: 'Investment Goal Planner',      category: 'investment-toolkit', status: 'live', description: 'The portfolio path to a specific investment target.', tier: 'pro' },

  // ── Real Estate ──────────────────────────────────────────────
  { slug: 'mortgage-calculator',         title: 'Mortgage Calculator',           category: 'real-estate', status: 'live', description: 'Full monthly payment — principal, interest, tax, insurance.', tier: 'free' },
  { slug: 'emi-calculator',              title: 'EMI Calculator',               category: 'real-estate', status: 'live', description: 'Equated monthly installment for any loan.', tier: 'pro' },
  { slug: 'rent-vs-buy',                 title: 'Rent vs Buy',                  category: 'real-estate', status: 'live', description: 'Which builds more net worth over your time horizon.', tier: 'free' },
  { slug: 'rental-yield',                title: 'Rental Yield',                 category: 'real-estate', status: 'live', description: 'Gross and net yield on a rental property.', tier: 'pro' },
  { slug: 'property-roi',                title: 'Property ROI',                 category: 'real-estate', status: 'live', description: 'Total return including appreciation and cash flow.', tier: 'pro' },
  { slug: 'cash-flow-calculator',        title: 'Cash Flow Calculator',         category: 'real-estate', status: 'live', description: 'Monthly cash flow after all property expenses.', tier: 'pro' },
  { slug: 'cap-rate',                    title: 'Cap Rate',                     category: 'real-estate', status: 'live', description: 'Net operating income as a percent of property value.', tier: 'pro' },
  { slug: 'cash-on-cash-return',         title: 'Cash-on-Cash Return',          category: 'real-estate', status: 'live', description: 'Return relative to actual cash invested.', tier: 'pro' },
  { slug: 'property-appreciation',       title: 'Property Appreciation',        category: 'real-estate', status: 'live', description: 'Project value growth over your holding period.', tier: 'pro' },
  { slug: 'closing-cost-estimator',      title: 'Closing Cost Estimator',       category: 'real-estate', status: 'live', description: 'Estimate fees due at closing.', tier: 'pro' },
  { slug: 'down-payment-planner',        title: 'Down Payment Planner',         category: 'real-estate', status: 'live', description: 'Monthly savings needed to hit your down payment.', tier: 'pro' },
  { slug: 'investment-property-analyzer',title: 'Investment Property Analyzer', category: 'real-estate', status: 'live', description: 'Full underwriting view of a rental deal.', tier: 'pro' },

  // ── Startup & Business ───────────────────────────────────────
  { slug: 'runway-calculator',           title: 'Runway Calculator',            category: 'startup-business', status: 'live', description: 'Months of cash left at current burn.', tier: 'pro' },
  { slug: 'burn-rate',                   title: 'Burn Rate',                    category: 'startup-business', status: 'live', description: 'Net monthly cash outflow.', tier: 'pro' },
  { slug: 'break-even-calculator',       title: 'Break-even Calculator',        category: 'startup-business', status: 'live', description: 'Units or revenue needed to break even.', tier: 'pro' },
  { slug: 'revenue-projection',          title: 'Revenue Projection',           category: 'startup-business', status: 'live', description: 'Forward revenue under growth assumptions.', tier: 'pro' },
  { slug: 'mrr-calculator',              title: 'MRR Calculator',               category: 'startup-business', status: 'live', description: 'Monthly recurring revenue from your subscriber base.', tier: 'pro' },
  { slug: 'arr-calculator',              title: 'ARR Calculator',               category: 'startup-business', status: 'live', description: 'Annualized recurring revenue.', tier: 'pro' },
  { slug: 'ltv-calculator',              title: 'LTV Calculator',               category: 'startup-business', status: 'live', description: 'Lifetime value per customer.', tier: 'pro' },
  { slug: 'cac-calculator',              title: 'CAC Calculator',               category: 'startup-business', status: 'live', description: 'Cost to acquire a customer.', tier: 'pro' },
  { slug: 'ltv-cac-ratio',               title: 'LTV:CAC Ratio',                category: 'startup-business', status: 'live', description: 'Unit economics health check.', tier: 'pro' },
  { slug: 'churn-calculator',            title: 'Churn Calculator',             category: 'startup-business', status: 'live', description: 'Revenue and logo churn rates.', tier: 'pro' },
  { slug: 'saas-valuation',              title: 'SaaS Valuation',               category: 'startup-business', status: 'live', description: 'Revenue-multiple valuation estimate.', tier: 'pro' },
  { slug: 'startup-valuation',           title: 'Startup Valuation',            category: 'startup-business', status: 'live', description: 'Early-stage valuation approaches compared.', tier: 'pro' },
  { slug: 'pricing-simulator',           title: 'Pricing Simulator',            category: 'startup-business', status: 'live', description: 'Revenue impact of price changes.', tier: 'pro' },

  // ── Loans ────────────────────────────────────────────────────
  { slug: 'loan-emi',                    title: 'Loan EMI',                     category: 'loans', status: 'live', description: 'Payment, total interest, and full amortization.', tier: 'free' },
  { slug: 'debt-payoff-planner',         title: 'Debt Payoff Planner',          category: 'loans', status: 'live', description: 'Snowball vs. avalanche, side by side, with your real debts.', tier: 'free' },
  { slug: 'credit-card-payoff',          title: 'Credit Card Payoff',           category: 'loans', status: 'live', description: 'Time and interest to clear a card balance.', tier: 'pro' },
  { slug: 'debt-to-income-ratio',        title: 'Debt-to-Income Ratio',         category: 'loans', status: 'live', description: 'Your DTI, and what lenders think of it.', tier: 'pro' },
  { slug: 'loan-comparison',             title: 'Loan Comparison',              category: 'loans', status: 'live', description: 'Compare two loan offers side by side.', tier: 'pro' },

  // ── Tax Planning ─────────────────────────────────────────────
  { slug: 'income-tax',                  title: 'Income Tax',                   category: 'tax-planning', status: 'live', description: 'Estimate your tax bill by bracket.', tier: 'pro' },
  { slug: 'capital-gains-tax',           title: 'Capital Gains Tax',            category: 'tax-planning', status: 'live', description: 'Short vs. long-term capital gains estimate.', tier: 'pro' },
  { slug: 'tax-saving-planner',          title: 'Tax Saving Planner',           category: 'tax-planning', status: 'live', description: 'Deductions and credits worth exploring.', tier: 'pro' },
  { slug: 'after-tax-income',            title: 'After-Tax Income',             category: 'tax-planning', status: 'live', description: 'What actually lands in your account.', tier: 'pro' },

  // ── Salary ───────────────────────────────────────────────────
  { slug: 'salary-breakdown',            title: 'Salary Breakdown',             category: 'salary', status: 'live', description: 'Gross to net, all the deductions in between.', tier: 'free' },
  { slug: 'promotion-impact',            title: 'Promotion Impact',             category: 'salary', status: 'live', description: 'Lifetime value of a raise, compounded.', tier: 'pro' },
  { slug: 'hourly-rate',                 title: 'Hourly Rate',                  category: 'salary', status: 'live', description: 'Convert salary to an effective hourly rate.', tier: 'pro' },
  { slug: 'freelance-rate',              title: 'Freelance Rate',               category: 'salary', status: 'live', description: 'Price your freelance time correctly.', tier: 'pro' },
  { slug: 'offer-comparison',            title: 'Offer Comparison',             category: 'salary', status: 'live', description: 'Compare two job offers on equal footing.', tier: 'pro' },
  { slug: 'cost-of-living-comparison',   title: 'Cost of Living Comparison',    category: 'salary', status: 'live', description: 'What a salary is really worth in a new city.', tier: 'pro' },

  // ── Family ───────────────────────────────────────────────────
  { slug: 'child-education-fund',        title: 'Child Education Fund',         category: 'family', status: 'live', description: 'Savings plan for future tuition costs.', tier: 'pro' },
  { slug: 'marriage-fund',               title: 'Marriage Fund',                category: 'family', status: 'live', description: 'Plan and save toward a wedding budget.', tier: 'pro' },
  { slug: 'vacation-planner',            title: 'Vacation Planner',             category: 'family', status: 'live', description: 'Save toward a trip by a target date.', tier: 'pro' },
  { slug: 'family-budget-planner',       title: 'Family Budget Planner',        category: 'family', status: 'live', description: 'Household budget across every family member.', tier: 'pro' },

  // ── Goal Planning ────────────────────────────────────────────
  { slug: 'dream-home-planner',          title: 'Dream Home Planner',           category: 'goal-planning', status: 'live', description: 'Down payment savings plan for a future home.', tier: 'pro' },
  { slug: 'luxury-car-planner',          title: 'Luxury Car Planner',           category: 'goal-planning', status: 'live', description: 'Save or finance a car purchase.', tier: 'pro' },
  { slug: 'business-fund',               title: 'Business Fund',                category: 'goal-planning', status: 'live', description: 'Capital plan for starting a business.', tier: 'pro' },
  { slug: 'travel-fund',                 title: 'Travel Fund',                  category: 'goal-planning', status: 'live', description: 'Recurring travel budget, planned ahead.', tier: 'pro' },
  { slug: 'millionaire-planner',         title: 'Millionaire Planner',          category: 'goal-planning', status: 'live', description: 'The path from here to seven figures.', tier: 'pro' },
  { slug: 'retirement-timeline',         title: 'Retirement Timeline',          category: 'goal-planning', status: 'live', description: 'Every retirement milestone, mapped out.', tier: 'pro' },

  // ── AI Financial Planner ─────────────────────────────────────
  { slug: 'ai-financial-planner',        title: 'AI Financial Planner',         category: 'ai-planner', status: 'live', description: 'Describe a goal in plain English — get a full plan.', tier: 'pro' },
  { slug: 'what-if-simulator',           title: 'What If Simulator',            category: 'ai-planner', status: 'live', description: 'Interactively test decisions against your real numbers.', tier: 'pro' },
]

export function getToolBySlug(slug: string): ToolMeta | undefined {
  return TOOLS.find(t => t.slug === slug)
}

export function getToolsByCategory(categoryId: ToolCategoryId): ToolMeta[] {
  return TOOLS.filter(t => t.category === categoryId)
}

export function getLiveToolCount(): number {
  return TOOLS.filter(t => t.status === 'live').length
}
