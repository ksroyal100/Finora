'use client'

import dynamic from 'next/dynamic'

const CompoundInterestCalculator = dynamic(() => import('./calculators/CompoundInterestCalculator').then(m => m.CompoundInterestCalculator))
const SipCalculator = dynamic(() => import('./calculators/SipCalculator').then(m => m.SipCalculator))
const CagrCalculator = dynamic(() => import('./calculators/CagrCalculator').then(m => m.CagrCalculator))
const RetirementPlanner = dynamic(() => import('./calculators/RetirementPlanner').then(m => m.RetirementPlanner))
const FireCalculator = dynamic(() => import('./calculators/FireCalculator').then(m => m.FireCalculator))
const LoanEmiCalculator = dynamic(() => import('./calculators/LoanEmiCalculator').then(m => m.LoanEmiCalculator))
const MortgageCalculator = dynamic(() => import('./calculators/MortgageCalculator').then(m => m.MortgageCalculator))
const RentVsBuyCalculator = dynamic(() => import('./calculators/RentVsBuyCalculator').then(m => m.RentVsBuyCalculator))
const DebtPayoffPlanner = dynamic(() => import('./calculators/DebtPayoffPlanner').then(m => m.DebtPayoffPlanner))
const EmergencyFundPlanner = dynamic(() => import('./calculators/EmergencyFundPlanner').then(m => m.EmergencyFundPlanner))
const FutureValueCalculator = dynamic(() => import('./calculators/FutureValueCalculator').then(m => m.FutureValueCalculator))
const PresentValueCalculator = dynamic(() => import('./calculators/PresentValueCalculator').then(m => m.PresentValueCalculator))
const InflationCalculator = dynamic(() => import('./calculators/InflationCalculator').then(m => m.InflationCalculator))
const SavingsGoalPlanner = dynamic(() => import('./calculators/SavingsGoalPlanner').then(m => m.SavingsGoalPlanner))
const LumpSumCalculator = dynamic(() => import('./calculators/LumpSumCalculator').then(m => m.LumpSumCalculator))
const RentalYieldCalculator = dynamic(() => import('./calculators/RentalYieldCalculator').then(m => m.RentalYieldCalculator))
const CapRateCalculator = dynamic(() => import('./calculators/CapRateCalculator').then(m => m.CapRateCalculator))
const CashOnCashCalculator = dynamic(() => import('./calculators/CashOnCashCalculator').then(m => m.CashOnCashCalculator))
const DownPaymentPlanner = dynamic(() => import('./calculators/DownPaymentPlanner').then(m => m.DownPaymentPlanner))
const TakeHomePayCalculator = dynamic(() => import('./calculators/TakeHomePayCalculator').then(m => m.TakeHomePayCalculator))
const DreamHomePlanner = dynamic(() => import('./calculators/GoalCalculatorInstances').then(m => m.DreamHomePlanner))
const LuxuryCarPlanner = dynamic(() => import('./calculators/GoalCalculatorInstances').then(m => m.LuxuryCarPlanner))
const BusinessFundPlanner = dynamic(() => import('./calculators/GoalCalculatorInstances').then(m => m.BusinessFundPlanner))
const TravelFundPlanner = dynamic(() => import('./calculators/GoalCalculatorInstances').then(m => m.TravelFundPlanner))
const MillionairePlanner = dynamic(() => import('./calculators/GoalCalculatorInstances').then(m => m.MillionairePlanner))
const RetirementTimelinePlanner = dynamic(() => import('./calculators/GoalCalculatorInstances').then(m => m.RetirementTimelinePlanner))
const ChildEducationFundPlanner = dynamic(() => import('./calculators/GoalCalculatorInstances').then(m => m.ChildEducationFundPlanner))
const MarriageFundPlanner = dynamic(() => import('./calculators/GoalCalculatorInstances').then(m => m.MarriageFundPlanner))
const VacationPlanner = dynamic(() => import('./calculators/GoalCalculatorInstances').then(m => m.VacationPlanner))
const PassiveIncomePlanner = dynamic(() => import('./calculators/GoalCalculatorInstances').then(m => m.PassiveIncomePlanner))
const InvestmentGoalPlanner = dynamic(() => import('./calculators/GoalCalculatorInstances').then(m => m.InvestmentGoalPlanner))
const HourlyRateCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.HourlyRateCalculator))
const FreelanceRateCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.FreelanceRateCalculator))
const PromotionImpactCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.PromotionImpactCalculator))
const RunwayCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.RunwayCalculator))
const BurnRateCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.BurnRateCalculator))
const BreakEvenCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.BreakEvenCalculator))
const MrrCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.MrrCalculator))
const ArrCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.ArrCalculator))
const LtvCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.LtvCalculator))
const CacCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.CacCalculator))
const LtvCacRatioCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.LtvCacRatioCalculator))
const ChurnCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.ChurnCalculator))
const SaasValuationCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.SaasValuationCalculator))
const StartupValuationCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.StartupValuationCalculator))
const PricingSimulatorCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.PricingSimulatorCalculator))
const DebtToIncomeCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.DebtToIncomeCalculator))
const CapitalGainsTaxCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.CapitalGainsTaxCalculator))
const ClosingCostEstimator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.ClosingCostEstimator))
const CashFlowCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.CashFlowCalculator))
const PropertyRoiCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.PropertyRoiCalculator))
const DividendIncomeCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.DividendIncomeCalculator))
const ExpectedReturnSimulator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.ExpectedReturnSimulator))
const NetWorthCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.NetWorthCalculator))
const FamilyBudgetPlanner = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.FamilyBudgetPlanner))
const CostOfLivingComparisonCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.CostOfLivingComparisonCalculator))
const EmiCalculatorAlias = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.EmiCalculatorAlias))
const AfterTaxIncomeAlias = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.AfterTaxIncomeAlias))
const PropertyAppreciationCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.PropertyAppreciationCalculator))
const CreditCardPayoffCalculator = dynamic(() => import('./calculators/RatioCalculatorInstances').then(m => m.CreditCardPayoffCalculator))
const PortfolioAllocationCalculator = dynamic(() => import('./calculators/HoldingsCalculatorInstances').then(m => m.PortfolioAllocationCalculator))
const PortfolioReturnCalculator = dynamic(() => import('./calculators/HoldingsCalculatorInstances').then(m => m.PortfolioReturnCalculator))
const RiskAnalysisCalculator = dynamic(() => import('./calculators/HoldingsCalculatorInstances').then(m => m.RiskAnalysisCalculator))
const PortfolioRebalancingCalculator = dynamic(() => import('./calculators/HoldingsCalculatorInstances').then(m => m.PortfolioRebalancingCalculator))
const IncomeTaxCalculator = dynamic(() => import('./calculators/IncomeTaxCalculator').then(m => m.IncomeTaxCalculator))
const XirrCalculator = dynamic(() => import('./calculators/XirrCalculator').then(m => m.XirrCalculator))
const SwpCalculator = dynamic(() => import('./calculators/SwpCalculator').then(m => m.SwpCalculator))
const MonteCarloCalculator = dynamic(() => import('./calculators/MonteCarloCalculator').then(m => m.MonteCarloCalculator))
const LoanComparisonCalculator = dynamic(() => import('./calculators/LoanComparisonCalculator').then(m => m.LoanComparisonCalculator))
const OfferComparisonCalculator = dynamic(() => import('./calculators/OfferComparisonCalculator').then(m => m.OfferComparisonCalculator))
const RevenueProjectionCalculator = dynamic(() => import('./calculators/RevenueProjectionCalculator').then(m => m.RevenueProjectionCalculator))
const WealthGrowthSimulator = dynamic(() => import('./calculators/WealthGrowthSimulator').then(m => m.WealthGrowthSimulator))
const InvestmentPropertyAnalyzer = dynamic(() => import('./calculators/InvestmentPropertyAnalyzer').then(m => m.InvestmentPropertyAnalyzer))
const TaxSavingPlanner = dynamic(() => import('./calculators/TaxSavingPlanner').then(m => m.TaxSavingPlanner))
const FinancialFreedomTimeline = dynamic(() => import('./calculators/FinancialFreedomTimeline').then(m => m.FinancialFreedomTimeline))
const AIFinancialPlannerRedirect = dynamic(() => import('./calculators/AIRedirects').then(m => m.AIFinancialPlannerRedirect))
const WhatIfSimulatorRedirect = dynamic(() => import('./calculators/AIRedirects').then(m => m.WhatIfSimulatorRedirect))

const LIVE_CALCULATORS: Record<string, React.ComponentType> = {
  // Original 10
  'compound-interest': CompoundInterestCalculator,
  'sip-calculator': SipCalculator,
  'cagr-calculator': CagrCalculator,
  'retirement-planner': RetirementPlanner,
  'fire-calculator': FireCalculator,
  'loan-emi': LoanEmiCalculator,
  'mortgage-calculator': MortgageCalculator,
  'rent-vs-buy': RentVsBuyCalculator,
  'debt-payoff-planner': DebtPayoffPlanner,
  'emergency-fund-planner': EmergencyFundPlanner,
  // Second batch of 10
  'future-value': FutureValueCalculator,
  'present-value': PresentValueCalculator,
  'inflation-calculator': InflationCalculator,
  'savings-goal-planner': SavingsGoalPlanner,
  'lump-sum-calculator': LumpSumCalculator,
  'rental-yield': RentalYieldCalculator,
  'cap-rate': CapRateCalculator,
  'cash-on-cash-return': CashOnCashCalculator,
  'down-payment-planner': DownPaymentPlanner,
  'salary-breakdown': TakeHomePayCalculator,
  // Goal-savings calculators (11)
  'dream-home-planner': DreamHomePlanner,
  'luxury-car-planner': LuxuryCarPlanner,
  'business-fund': BusinessFundPlanner,
  'travel-fund': TravelFundPlanner,
  'millionaire-planner': MillionairePlanner,
  'retirement-timeline': RetirementTimelinePlanner,
  'child-education-fund': ChildEducationFundPlanner,
  'marriage-fund': MarriageFundPlanner,
  'vacation-planner': VacationPlanner,
  'passive-income-planner': PassiveIncomePlanner,
  'investment-goal-planner': InvestmentGoalPlanner,
  // Ratio/business calculators (28)
  'hourly-rate': HourlyRateCalculator,
  'freelance-rate': FreelanceRateCalculator,
  'promotion-impact': PromotionImpactCalculator,
  'runway-calculator': RunwayCalculator,
  'burn-rate': BurnRateCalculator,
  'break-even-calculator': BreakEvenCalculator,
  'mrr-calculator': MrrCalculator,
  'arr-calculator': ArrCalculator,
  'ltv-calculator': LtvCalculator,
  'cac-calculator': CacCalculator,
  'ltv-cac-ratio': LtvCacRatioCalculator,
  'churn-calculator': ChurnCalculator,
  'saas-valuation': SaasValuationCalculator,
  'startup-valuation': StartupValuationCalculator,
  'pricing-simulator': PricingSimulatorCalculator,
  'debt-to-income-ratio': DebtToIncomeCalculator,
  'capital-gains-tax': CapitalGainsTaxCalculator,
  'closing-cost-estimator': ClosingCostEstimator,
  'cash-flow-calculator': CashFlowCalculator,
  'property-roi': PropertyRoiCalculator,
  'dividend-income-calculator': DividendIncomeCalculator,
  'expected-return-simulator': ExpectedReturnSimulator,
  'net-worth-calculator': NetWorthCalculator,
  'family-budget-planner': FamilyBudgetPlanner,
  'cost-of-living-comparison': CostOfLivingComparisonCalculator,
  'emi-calculator': EmiCalculatorAlias,
  'after-tax-income': AfterTaxIncomeAlias,
  'property-appreciation': PropertyAppreciationCalculator,
  'credit-card-payoff': CreditCardPayoffCalculator,
  // Portfolio holdings calculators (4)
  'portfolio-allocation': PortfolioAllocationCalculator,
  'portfolio-return-calculator': PortfolioReturnCalculator,
  'risk-analysis': RiskAnalysisCalculator,
  'portfolio-rebalancing': PortfolioRebalancingCalculator,
  // Bespoke (11)
  'income-tax': IncomeTaxCalculator,
  'xirr-calculator': XirrCalculator,
  'swp-calculator': SwpCalculator,
  'monte-carlo-simulation': MonteCarloCalculator,
  'loan-comparison': LoanComparisonCalculator,
  'offer-comparison': OfferComparisonCalculator,
  'revenue-projection': RevenueProjectionCalculator,
  'wealth-growth-simulator': WealthGrowthSimulator,
  'investment-property-analyzer': InvestmentPropertyAnalyzer,
  'tax-saving-planner': TaxSavingPlanner,
  'financial-freedom-timeline': FinancialFreedomTimeline,
  // AI redirects (2)
  'ai-financial-planner': AIFinancialPlannerRedirect,
  'what-if-simulator': WhatIfSimulatorRedirect,
}

export function ToolRenderer({ slug }: { slug: string }) {
  const Calculator = LIVE_CALCULATORS[slug]
  if (!Calculator) return null
  return <Calculator />
}
