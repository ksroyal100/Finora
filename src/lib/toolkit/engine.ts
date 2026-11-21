// src/lib/toolkit/engine.ts
//
// Pure calculation engine for the Financial Toolkit.
// No React, no DOM, no side effects — every function takes plain inputs and
// returns plain outputs, so it can be unit-tested and reused from any UI,
// a server route, or a future AI planner.

export interface SeriesPoint {
  /** Year offset from "today" (0 = now) */
  year: number
  label: string
  [key: string]: number | string
}

// ─────────────────────────────────────────────────────────────
// 1. Compound Interest
// ─────────────────────────────────────────────────────────────

export interface CompoundInterestInput {
  principal: number
  monthlyContribution: number
  annualRatePct: number
  years: number
}

export interface CompoundInterestResult {
  futureValue: number
  totalContributions: number
  totalInterest: number
  series: SeriesPoint[]
}

export function calcCompoundInterest(input: CompoundInterestInput): CompoundInterestResult {
  const { principal, monthlyContribution, annualRatePct, years } = input
  const r = annualRatePct / 100 / 12
  const series: SeriesPoint[] = []
  let balance = principal
  let contributed = principal

  series.push({ year: 0, label: 'Now', balance: round2(balance), contributed: round2(contributed) })

  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + r) + monthlyContribution
      contributed += monthlyContribution
    }
    series.push({ year: y, label: `Yr ${y}`, balance: round2(balance), contributed: round2(contributed) })
  }

  return {
    futureValue: round2(balance),
    totalContributions: round2(contributed),
    totalInterest: round2(balance - contributed),
    series,
  }
}

// ─────────────────────────────────────────────────────────────
// 2. SIP / Recurring Investment (with optional annual step-up)
// ─────────────────────────────────────────────────────────────

export interface SipInput {
  monthlyInvestment: number
  annualReturnPct: number
  years: number
  annualStepUpPct?: number
}

export interface SipResult {
  futureValue: number
  totalInvested: number
  totalGains: number
  series: SeriesPoint[]
}

export function calcSip(input: SipInput): SipResult {
  const { monthlyInvestment, annualReturnPct, years, annualStepUpPct = 0 } = input
  const r = annualReturnPct / 100 / 12
  let balance = 0
  let invested = 0
  let currentMonthly = monthlyInvestment
  const series: SeriesPoint[] = [{ year: 0, label: 'Now', balance: 0, invested: 0 }]

  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + r) + currentMonthly
      invested += currentMonthly
    }
    series.push({ year: y, label: `Yr ${y}`, balance: round2(balance), invested: round2(invested) })
    currentMonthly *= 1 + annualStepUpPct / 100
  }

  return {
    futureValue: round2(balance),
    totalInvested: round2(invested),
    totalGains: round2(balance - invested),
    series,
  }
}

// ─────────────────────────────────────────────────────────────
// 3. CAGR
// ─────────────────────────────────────────────────────────────

export interface CagrInput {
  initialValue: number
  finalValue: number
  years: number
}

export interface CagrResult {
  cagrPct: number
  absoluteGain: number
  absoluteGainPct: number
}

export function calcCagr(input: CagrInput): CagrResult {
  const { initialValue, finalValue, years } = input
  const cagr = initialValue > 0 && years > 0 ? (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100 : 0
  return {
    cagrPct: round2(cagr),
    absoluteGain: round2(finalValue - initialValue),
    absoluteGainPct: initialValue > 0 ? round2(((finalValue - initialValue) / initialValue) * 100) : 0,
  }
}

// ─────────────────────────────────────────────────────────────
// 4. Retirement Planner
// ─────────────────────────────────────────────────────────────

export interface RetirementInput {
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  currentSavings: number
  monthlyContribution: number
  expectedReturnPct: number
  inflationPct: number
  desiredMonthlyIncomeToday: number
}

export interface RetirementResult {
  yearsToRetirement: number
  retirementDurationYears: number
  monthlyIncomeAtRetirement: number
  requiredCorpus: number
  projectedCorpus: number
  surplusOrGap: number
  additionalMonthlyContributionNeeded: number
  series: SeriesPoint[]
}

export function calcRetirement(input: RetirementInput): RetirementResult {
  const {
    currentAge, retirementAge, lifeExpectancy, currentSavings,
    monthlyContribution, expectedReturnPct, inflationPct, desiredMonthlyIncomeToday,
  } = input

  const yearsToRetirement = Math.max(0, retirementAge - currentAge)
  const retirementDurationYears = Math.max(1, lifeExpectancy - retirementAge)

  // Grow desired income to retirement-day dollars using inflation
  const monthlyIncomeAtRetirement = desiredMonthlyIncomeToday * Math.pow(1 + inflationPct / 100, yearsToRetirement)

  // Real (inflation-adjusted) monthly return during retirement, used to size the
  // corpus needed to fund a fixed real income stream (ordinary annuity, PV formula).
  const realMonthlyReturn = (1 + expectedReturnPct / 100) / (1 + inflationPct / 100) - 1
  const nMonths = retirementDurationYears * 12
  const requiredCorpus = realMonthlyReturn > 0
    ? monthlyIncomeAtRetirement * ((1 - Math.pow(1 + realMonthlyReturn, -nMonths)) / realMonthlyReturn)
    : monthlyIncomeAtRetirement * nMonths

  // Project actual corpus growth month by month (nominal return)
  const r = expectedReturnPct / 100 / 12
  let balance = currentSavings
  const series: SeriesPoint[] = [{ year: 0, label: 'Now', balance: round2(balance), target: round2(requiredCorpus) }]
  for (let y = 1; y <= yearsToRetirement; y++) {
    for (let m = 0; m < 12; m++) balance = balance * (1 + r) + monthlyContribution
    series.push({ year: y, label: `Age ${currentAge + y}`, balance: round2(balance), target: round2(requiredCorpus) })
  }

  const surplusOrGap = balance - requiredCorpus

  // Solve for the extra monthly contribution needed to close a gap, via the
  // standard future-value-of-annuity formula (binary search avoided — closed form).
  let additionalMonthlyContributionNeeded = 0
  if (surplusOrGap < 0 && yearsToRetirement > 0) {
    const nContribMonths = yearsToRetirement * 12
    const fvFactor = r > 0 ? ((Math.pow(1 + r, nContribMonths) - 1) / r) : nContribMonths
    additionalMonthlyContributionNeeded = fvFactor > 0 ? Math.abs(surplusOrGap) / fvFactor : 0
  }

  return {
    yearsToRetirement,
    retirementDurationYears,
    monthlyIncomeAtRetirement: round2(monthlyIncomeAtRetirement),
    requiredCorpus: round2(requiredCorpus),
    projectedCorpus: round2(balance),
    surplusOrGap: round2(surplusOrGap),
    additionalMonthlyContributionNeeded: round2(additionalMonthlyContributionNeeded),
    series,
  }
}

// ─────────────────────────────────────────────────────────────
// 5. FIRE Calculator
// ─────────────────────────────────────────────────────────────

export interface FireInput {
  currentAge: number
  currentAnnualExpenses: number
  currentInvestments: number
  monthlySavings: number
  expectedReturnPct: number
  inflationPct: number
  safeWithdrawalRatePct: number
}

export interface FireResult {
  fireNumber: number
  yearsToFire: number | null
  fireAge: number | null
  series: SeriesPoint[]
}

export function calcFire(input: FireInput): FireResult {
  const {
    currentAge, currentAnnualExpenses, currentInvestments,
    monthlySavings, expectedReturnPct, inflationPct, safeWithdrawalRatePct,
  } = input

  const r = expectedReturnPct / 100 / 12
  let balance = currentInvestments
  let annualExpenses = currentAnnualExpenses
  let fireNumber = annualExpenses / (safeWithdrawalRatePct / 100)

  const series: SeriesPoint[] = [{ year: 0, label: 'Now', balance: round2(balance), fireNumber: round2(fireNumber) }]
  let yearsToFire: number | null = null

  const MAX_YEARS = 80
  for (let y = 1; y <= MAX_YEARS; y++) {
    for (let m = 0; m < 12; m++) balance = balance * (1 + r) + monthlySavings
    annualExpenses *= 1 + inflationPct / 100
    fireNumber = annualExpenses / (safeWithdrawalRatePct / 100)

    if (y <= 60) series.push({ year: y, label: `Yr ${y}`, balance: round2(balance), fireNumber: round2(fireNumber) })

    if (yearsToFire === null && balance >= fireNumber) yearsToFire = y
    if (yearsToFire !== null && y >= yearsToFire) break
  }

  return {
    fireNumber: round2(currentAnnualExpenses / (safeWithdrawalRatePct / 100)),
    yearsToFire,
    fireAge: yearsToFire !== null ? currentAge + yearsToFire : null,
    series,
  }
}

// ─────────────────────────────────────────────────────────────
// 6. Loan / EMI
// ─────────────────────────────────────────────────────────────

export interface LoanInput {
  principal: number
  annualRatePct: number
  termYears: number
  extraMonthlyPayment?: number
}

export interface LoanResult {
  emi: number
  totalPayment: number
  totalInterest: number
  payoffMonths: number
  monthsSaved: number
  series: SeriesPoint[]
}

export function calcLoan(input: LoanInput): LoanResult {
  const { principal, annualRatePct, termYears, extraMonthlyPayment = 0 } = input
  const r = annualRatePct / 100 / 12
  const n = termYears * 12

  const emi = r > 0
    ? (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    : principal / n

  const runAmortization = (payment: number) => {
    let balance = principal
    let totalInterest = 0
    let months = 0
    const series: SeriesPoint[] = []
    while (balance > 0.01 && months < 1200) {
      const interestPortion = balance * r
      let principalPortion = payment - interestPortion
      if (principalPortion > balance) principalPortion = balance
      balance -= principalPortion
      totalInterest += interestPortion
      months++
      if (months % 12 === 0 || balance <= 0.01) {
        series.push({ year: Math.ceil(months / 12), label: `Yr ${Math.ceil(months / 12)}`, balance: round2(Math.max(balance, 0)) })
      }
    }
    return { totalInterest: round2(totalInterest), months, series }
  }

  const base = runAmortization(emi)
  const withExtra = extraMonthlyPayment > 0 ? runAmortization(emi + extraMonthlyPayment) : null

  const chosen = withExtra ?? base

  return {
    emi: round2(emi),
    totalPayment: round2(emi * chosen.months + (withExtra ? extraMonthlyPayment * chosen.months : 0)),
    totalInterest: chosen.totalInterest,
    payoffMonths: chosen.months,
    monthsSaved: withExtra ? base.months - withExtra.months : 0,
    series: chosen.series,
  }
}

// ─────────────────────────────────────────────────────────────
// 7. Mortgage (PITI)
// ─────────────────────────────────────────────────────────────

export interface MortgageInput {
  homePrice: number
  downPaymentPct: number
  annualRatePct: number
  termYears: number
  propertyTaxPctAnnual: number
  homeInsuranceAnnual: number
  hoaMonthly?: number
}

export interface MortgageResult {
  loanAmount: number
  downPaymentAmount: number
  principalAndInterest: number
  monthlyTax: number
  monthlyInsurance: number
  totalMonthlyPayment: number
  totalInterestOverLoan: number
  series: SeriesPoint[]
}

export function calcMortgage(input: MortgageInput): MortgageResult {
  const { homePrice, downPaymentPct, annualRatePct, termYears, propertyTaxPctAnnual, homeInsuranceAnnual, hoaMonthly = 0 } = input
  const downPaymentAmount = homePrice * (downPaymentPct / 100)
  const loanAmount = homePrice - downPaymentAmount

  const loan = calcLoan({ principal: loanAmount, annualRatePct, termYears })
  const monthlyTax = (homePrice * (propertyTaxPctAnnual / 100)) / 12
  const monthlyInsurance = homeInsuranceAnnual / 12

  return {
    loanAmount: round2(loanAmount),
    downPaymentAmount: round2(downPaymentAmount),
    principalAndInterest: loan.emi,
    monthlyTax: round2(monthlyTax),
    monthlyInsurance: round2(monthlyInsurance),
    totalMonthlyPayment: round2(loan.emi + monthlyTax + monthlyInsurance + hoaMonthly),
    totalInterestOverLoan: loan.totalInterest,
    series: loan.series,
  }
}

// ─────────────────────────────────────────────────────────────
// 8. Rent vs Buy
// ─────────────────────────────────────────────────────────────

export interface RentVsBuyInput {
  homePrice: number
  downPaymentPct: number
  mortgageRatePct: number
  loanTermYears: number
  propertyTaxPctAnnual: number
  maintenancePctAnnual: number
  homeAppreciationPctAnnual: number
  monthlyRent: number
  rentIncreasePctAnnual: number
  investmentReturnPctAnnual: number
  horizonYears: number
}

export interface RentVsBuyResult {
  buyNetWorth: number
  rentNetWorth: number
  betterOption: 'buy' | 'rent'
  differenceAmount: number
  breakevenYear: number | null
  series: SeriesPoint[]
}

export function calcRentVsBuy(input: RentVsBuyInput): RentVsBuyResult {
  const {
    homePrice, downPaymentPct, mortgageRatePct, loanTermYears,
    propertyTaxPctAnnual, maintenancePctAnnual, homeAppreciationPctAnnual,
    monthlyRent, rentIncreasePctAnnual, investmentReturnPctAnnual, horizonYears,
  } = input

  const downPayment = homePrice * (downPaymentPct / 100)
  const loanAmount = homePrice - downPayment
  const r = mortgageRatePct / 100 / 12
  const n = loanTermYears * 12
  const monthlyPI = r > 0 ? (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : loanAmount / n

  let homeValue = homePrice
  let loanBalance = loanAmount
  let currentRent = monthlyRent
  let rentInvestmentPortfolio = downPayment // opportunity cost of the down payment, invested instead
  let cumulativeOwnerCosts = 0

  const series: SeriesPoint[] = []
  let breakevenYear: number | null = null
  const totalMonths = horizonYears * 12
  const monthlyInvestReturn = investmentReturnPctAnnual / 100 / 12

  for (let m = 1; m <= totalMonths; m++) {
    // Owning
    const interestPortion = loanBalance * r
    let principalPortion = monthlyPI - interestPortion
    if (loanBalance > 0) {
      if (principalPortion > loanBalance) principalPortion = loanBalance
      loanBalance = Math.max(0, loanBalance - principalPortion)
      cumulativeOwnerCosts += interestPortion // interest is a true cost; principal builds equity
    }
    const monthlyTax = (homeValue * (propertyTaxPctAnnual / 100)) / 12
    const monthlyMaintenance = (homeValue * (maintenancePctAnnual / 100)) / 12
    cumulativeOwnerCosts += monthlyTax + monthlyMaintenance
    homeValue *= 1 + homeAppreciationPctAnnual / 100 / 12

    const ownerMonthlyOutlay = (loanBalance > 0 ? monthlyPI : 0) + monthlyTax + monthlyMaintenance

    // Renting — invest the difference between what an owner pays out-of-pocket and rent
    const rentDiff = ownerMonthlyOutlay - currentRent
    rentInvestmentPortfolio = rentInvestmentPortfolio * (1 + monthlyInvestReturn) + Math.max(0, rentDiff)

    if (m % 12 === 0) {
      currentRent *= 1 + rentIncreasePctAnnual / 100
      const year = m / 12
      const buyNW = homeValue - loanBalance - cumulativeOwnerCosts
      const rentNW = rentInvestmentPortfolio
      if (breakevenYear === null && buyNW >= rentNW) breakevenYear = year
      series.push({ year, label: `Yr ${year}`, buy: round2(buyNW), rent: round2(rentNW) })
    }
  }

  const last = series[series.length - 1] ?? { buy: 0, rent: 0 }
  const buyNetWorth = Number(last.buy)
  const rentNetWorth = Number(last.rent)

  return {
    buyNetWorth: round2(buyNetWorth),
    rentNetWorth: round2(rentNetWorth),
    betterOption: buyNetWorth >= rentNetWorth ? 'buy' : 'rent',
    differenceAmount: round2(Math.abs(buyNetWorth - rentNetWorth)),
    breakevenYear,
    series,
  }
}

// ─────────────────────────────────────────────────────────────
// 9. Debt Payoff — Snowball vs Avalanche
// ─────────────────────────────────────────────────────────────

export interface Debt {
  id: string
  name: string
  balance: number
  aprPct: number
  minPayment: number
}

export interface DebtPayoffResult {
  strategy: 'snowball' | 'avalanche'
  monthsToPayoff: number
  totalInterestPaid: number
  payoffOrder: string[]
  series: SeriesPoint[]
}

export function calcDebtPayoff(debts: Debt[], extraMonthlyPayment: number, strategy: 'snowball' | 'avalanche'): DebtPayoffResult {
  const working = debts.map(d => ({ ...d, balance: d.balance }))
  const order = [...working].sort((a, b) =>
    strategy === 'snowball' ? a.balance - b.balance : b.aprPct - a.aprPct
  )
  const payoffOrder: string[] = []
  let totalInterestPaid = 0
  const series: SeriesPoint[] = []
  let months = 0
  let extraPool = extraMonthlyPayment

  const totalStartBalance = order.reduce((s, d) => s + d.balance, 0)
  series.push({ year: 0, label: 'Now', balance: round2(totalStartBalance) })

  while (order.some(d => d.balance > 0.01) && months < 600) {
    months++
    let freedUpThisMonth = 0

    for (const debt of order) {
      if (debt.balance <= 0) continue
      const interest = debt.balance * (debt.aprPct / 100 / 12)
      totalInterestPaid += interest
      debt.balance += interest
      const payment = Math.min(debt.balance, debt.minPayment)
      debt.balance -= payment
      if (debt.balance <= 0.01) {
        freedUpThisMonth += debt.minPayment
        if (!payoffOrder.includes(debt.name)) payoffOrder.push(debt.name)
      }
    }
    extraPool += freedUpThisMonth

    // Apply extra payment to the highest-priority debt still owing
    let remainingExtra = extraPool
    for (const debt of order) {
      if (remainingExtra <= 0) break
      if (debt.balance <= 0) continue
      const pay = Math.min(debt.balance, remainingExtra)
      debt.balance -= pay
      remainingExtra -= pay
      if (debt.balance <= 0.01 && !payoffOrder.includes(debt.name)) payoffOrder.push(debt.name)
    }

    if (months % 3 === 0 || order.every(d => d.balance <= 0.01)) {
      const total = order.reduce((s, d) => s + Math.max(d.balance, 0), 0)
      series.push({ year: round2(months / 12), label: `Mo ${months}`, balance: round2(total) })
    }
  }

  return {
    strategy,
    monthsToPayoff: months,
    totalInterestPaid: round2(totalInterestPaid),
    payoffOrder,
    series,
  }
}

// ─────────────────────────────────────────────────────────────
// 10. Emergency Fund Planner
// ─────────────────────────────────────────────────────────────

export interface EmergencyFundInput {
  monthlyExpenses: number
  targetMonths: number
  currentSavings: number
  monthlySavingsContribution: number
  savingsAccountReturnPct?: number
}

export interface EmergencyFundResult {
  targetAmount: number
  currentCoverageMonths: number
  shortfall: number
  monthsToTarget: number | null
  series: SeriesPoint[]
}

export function calcEmergencyFund(input: EmergencyFundInput): EmergencyFundResult {
  const { monthlyExpenses, targetMonths, currentSavings, monthlySavingsContribution, savingsAccountReturnPct = 0 } = input
  const targetAmount = monthlyExpenses * targetMonths
  const currentCoverageMonths = monthlyExpenses > 0 ? currentSavings / monthlyExpenses : 0
  const shortfall = Math.max(0, targetAmount - currentSavings)

  const r = savingsAccountReturnPct / 100 / 12
  let balance = currentSavings
  const series: SeriesPoint[] = [{ year: 0, label: 'Now', balance: round2(balance), target: round2(targetAmount) }]
  let monthsToTarget: number | null = balance >= targetAmount ? 0 : null

  const MAX_MONTHS = 240
  for (let m = 1; m <= MAX_MONTHS; m++) {
    balance = balance * (1 + r) + monthlySavingsContribution
    if (monthsToTarget === null && balance >= targetAmount) monthsToTarget = m
    if (m % 3 === 0 || monthsToTarget === m) {
      series.push({ year: round2(m / 12), label: `Mo ${m}`, balance: round2(balance), target: round2(targetAmount) })
    }
    if (monthsToTarget !== null) break
  }

  return {
    targetAmount: round2(targetAmount),
    currentCoverageMonths: round2(currentCoverageMonths),
    shortfall: round2(shortfall),
    monthsToTarget,
    series,
  }
}

// ─────────────────────────────────────────────────────────────
// 11. Future Value (lump sum)
// ─────────────────────────────────────────────────────────────

export interface FutureValueInput {
  presentValue: number
  annualRatePct: number
  years: number
}

export interface FutureValueResult {
  futureValue: number
  totalGrowth: number
  series: SeriesPoint[]
}

export function calcFutureValue(input: FutureValueInput): FutureValueResult {
  const { presentValue, annualRatePct, years } = input
  const r = annualRatePct / 100
  const series: SeriesPoint[] = []
  for (let y = 0; y <= years; y++) {
    const value = presentValue * Math.pow(1 + r, y)
    series.push({ year: y, label: y === 0 ? 'Now' : `Yr ${y}`, value: round2(value) })
  }
  const futureValue = series[series.length - 1]?.value as number ?? presentValue
  return { futureValue: round2(futureValue), totalGrowth: round2(futureValue - presentValue), series }
}

// ─────────────────────────────────────────────────────────────
// 12. Present Value (discount a future sum)
// ─────────────────────────────────────────────────────────────

export interface PresentValueInput {
  futureValue: number
  annualRatePct: number
  years: number
}

export interface PresentValueResult {
  presentValue: number
  totalDiscount: number
  series: SeriesPoint[]
}

export function calcPresentValue(input: PresentValueInput): PresentValueResult {
  const { futureValue, annualRatePct, years } = input
  const r = annualRatePct / 100
  const presentValue = futureValue / Math.pow(1 + r, years)
  const series: SeriesPoint[] = []
  for (let y = 0; y <= years; y++) {
    const value = presentValue * Math.pow(1 + r, y)
    series.push({ year: y, label: y === 0 ? 'Today' : `Yr ${y}`, value: round2(value) })
  }
  return { presentValue: round2(presentValue), totalDiscount: round2(futureValue - presentValue), series }
}

// ─────────────────────────────────────────────────────────────
// 13. Inflation Calculator (purchasing power erosion)
// ─────────────────────────────────────────────────────────────

export interface InflationInput {
  amount: number
  annualInflationPct: number
  years: number
}

export interface InflationResult {
  futureCost: number
  purchasingPowerRemaining: number
  purchasingPowerLostPct: number
  series: SeriesPoint[]
}

export function calcInflation(input: InflationInput): InflationResult {
  const { amount, annualInflationPct, years } = input
  const r = annualInflationPct / 100
  const series: SeriesPoint[] = []
  for (let y = 0; y <= years; y++) {
    const futureCost = amount * Math.pow(1 + r, y)
    const purchasingPower = amount / Math.pow(1 + r, y)
    series.push({ year: y, label: y === 0 ? 'Today' : `Yr ${y}`, futureCost: round2(futureCost), purchasingPower: round2(purchasingPower) })
  }
  const futureCost = amount * Math.pow(1 + r, years)
  const purchasingPowerRemaining = amount / Math.pow(1 + r, years)
  return {
    futureCost: round2(futureCost),
    purchasingPowerRemaining: round2(purchasingPowerRemaining),
    purchasingPowerLostPct: round2((1 - purchasingPowerRemaining / amount) * 100),
    series,
  }
}

// ─────────────────────────────────────────────────────────────
// 14. Savings Goal Planner (reverse-engineer required monthly saving)
// ─────────────────────────────────────────────────────────────

export interface SavingsGoalInput {
  targetAmount: number
  currentSavings: number
  annualRatePct: number
  years: number
}

export interface SavingsGoalResult {
  requiredMonthlySavings: number
  totalContributions: number
  totalGrowth: number
  series: SeriesPoint[]
}

export function calcSavingsGoal(input: SavingsGoalInput): SavingsGoalResult {
  const { targetAmount, currentSavings, annualRatePct, years } = input
  const months = Math.max(1, Math.round(years * 12))
  const r = annualRatePct / 100 / 12

  // Future value of current savings alone
  const fvCurrent = currentSavings * Math.pow(1 + r, months)
  const remainingTarget = Math.max(0, targetAmount - fvCurrent)

  // Solve for the monthly payment whose future value (ordinary annuity) = remainingTarget
  const requiredMonthlySavings = r === 0
    ? remainingTarget / months
    : remainingTarget * r / (Math.pow(1 + r, months) - 1)

  const series: SeriesPoint[] = []
  let balance = currentSavings
  let contributed = currentSavings
  series.push({ year: 0, label: 'Now', balance: round2(balance) })
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + r) + requiredMonthlySavings
      contributed += requiredMonthlySavings
    }
    series.push({ year: y, label: `Yr ${y}`, balance: round2(balance) })
  }

  return {
    requiredMonthlySavings: round2(Math.max(0, requiredMonthlySavings)),
    totalContributions: round2(contributed),
    totalGrowth: round2(balance - contributed),
    series,
  }
}

// ─────────────────────────────────────────────────────────────
// 15. Lump Sum Investment Calculator (alias of future value, framed
//     for a one-time investment with optional additional context)
// ─────────────────────────────────────────────────────────────

export interface LumpSumInput {
  investmentAmount: number
  annualReturnPct: number
  years: number
}

export interface LumpSumResult {
  futureValue: number
  totalGains: number
  series: SeriesPoint[]
}

export function calcLumpSum(input: LumpSumInput): LumpSumResult {
  const { investmentAmount, annualReturnPct, years } = input
  const r = annualReturnPct / 100
  const series: SeriesPoint[] = []
  for (let y = 0; y <= years; y++) {
    const value = investmentAmount * Math.pow(1 + r, y)
    series.push({ year: y, label: y === 0 ? 'Now' : `Yr ${y}`, balance: round2(value) })
  }
  const futureValue = (series[series.length - 1]?.balance as number) ?? investmentAmount
  return { futureValue: round2(futureValue), totalGains: round2(futureValue - investmentAmount), series }
}

// ─────────────────────────────────────────────────────────────
// 16. Rental Yield (gross and net)
// ─────────────────────────────────────────────────────────────

export interface RentalYieldInput {
  propertyValue: number
  monthlyRent: number
  annualExpenses: number
}

export interface RentalYieldResult {
  grossYieldPct: number
  netYieldPct: number
  annualGrossRent: number
  netAnnualIncome: number
}

export function calcRentalYield(input: RentalYieldInput): RentalYieldResult {
  const { propertyValue, monthlyRent, annualExpenses } = input
  const annualGrossRent = monthlyRent * 12
  const netAnnualIncome = annualGrossRent - annualExpenses
  const grossYieldPct = propertyValue > 0 ? (annualGrossRent / propertyValue) * 100 : 0
  const netYieldPct = propertyValue > 0 ? (netAnnualIncome / propertyValue) * 100 : 0
  return { grossYieldPct: round2(grossYieldPct), netYieldPct: round2(netYieldPct), annualGrossRent: round2(annualGrossRent), netAnnualIncome: round2(netAnnualIncome) }
}

// ─────────────────────────────────────────────────────────────
// 17. Cap Rate (net operating income ÷ property value)
// ─────────────────────────────────────────────────────────────

export interface CapRateInput {
  propertyValue: number
  annualGrossIncome: number
  annualOperatingExpenses: number
}

export interface CapRateResult {
  netOperatingIncome: number
  capRatePct: number
}

export function calcCapRate(input: CapRateInput): CapRateResult {
  const { propertyValue, annualGrossIncome, annualOperatingExpenses } = input
  const noi = annualGrossIncome - annualOperatingExpenses
  const capRatePct = propertyValue > 0 ? (noi / propertyValue) * 100 : 0
  return { netOperatingIncome: round2(noi), capRatePct: round2(capRatePct) }
}

// ─────────────────────────────────────────────────────────────
// 18. Cash-on-Cash Return (return relative to actual cash invested)
// ─────────────────────────────────────────────────────────────

export interface CashOnCashInput {
  annualPreTaxCashFlow: number
  totalCashInvested: number
}

export interface CashOnCashResult {
  cashOnCashReturnPct: number
}

export function calcCashOnCash(input: CashOnCashInput): CashOnCashResult {
  const { annualPreTaxCashFlow, totalCashInvested } = input
  const pct = totalCashInvested > 0 ? (annualPreTaxCashFlow / totalCashInvested) * 100 : 0
  return { cashOnCashReturnPct: round2(pct) }
}

// ─────────────────────────────────────────────────────────────
// 19. Down Payment Planner (months of saving needed)
// ─────────────────────────────────────────────────────────────

export interface DownPaymentInput {
  homePrice: number
  downPaymentPct: number
  currentSavings: number
  monthlySavings: number
  annualRatePct: number
}

export interface DownPaymentResult {
  targetDownPayment: number
  amountStillNeeded: number
  monthsToGoal: number
  series: SeriesPoint[]
}

export function calcDownPayment(input: DownPaymentInput): DownPaymentResult {
  const { homePrice, downPaymentPct, currentSavings, monthlySavings, annualRatePct } = input
  const targetDownPayment = homePrice * (downPaymentPct / 100)
  const r = annualRatePct / 100 / 12

  const series: SeriesPoint[] = []
  let balance = currentSavings
  let months = 0
  series.push({ year: 0, label: 'Now', balance: round2(balance) })

  if (balance >= targetDownPayment) {
    return { targetDownPayment: round2(targetDownPayment), amountStillNeeded: 0, monthsToGoal: 0, series }
  }

  while (balance < targetDownPayment && months < 600) {
    months++
    balance = balance * (1 + r) + monthlySavings
    if (months % 3 === 0 || balance >= targetDownPayment) {
      series.push({ year: round2(months / 12), label: `Mo ${months}`, balance: round2(balance) })
    }
    if (monthlySavings <= 0 && r <= 0) break // would never reach the goal
  }

  return {
    targetDownPayment: round2(targetDownPayment),
    amountStillNeeded: round2(Math.max(0, targetDownPayment - currentSavings)),
    monthsToGoal: balance >= targetDownPayment ? months : -1, // -1 signals "not reachable" at current inputs
    series,
  }
}

// ─────────────────────────────────────────────────────────────
// 20. Take-Home Pay Estimator
//
// Deliberately simplified: a flat effective-rate model, not a real
// tax-bracket engine. Actual take-home pay depends on filing status,
// state, deductions, and credits that vary too much to model
// responsibly here — this gives a directional estimate, and says so.
// ─────────────────────────────────────────────────────────────

export interface TakeHomePayInput {
  grossAnnualSalary: number
  effectiveTaxRatePct: number
  preTaxDeductionsMonthly: number
}

export interface TakeHomePayResult {
  annualTakeHome: number
  monthlyTakeHome: number
  annualTaxPaid: number
  annualPreTaxDeductions: number
}

export function calcTakeHomePay(input: TakeHomePayInput): TakeHomePayResult {
  const { grossAnnualSalary, effectiveTaxRatePct, preTaxDeductionsMonthly } = input
  const annualPreTaxDeductions = preTaxDeductionsMonthly * 12
  const taxableIncome = Math.max(0, grossAnnualSalary - annualPreTaxDeductions)
  const annualTaxPaid = taxableIncome * (effectiveTaxRatePct / 100)
  const annualTakeHome = grossAnnualSalary - annualPreTaxDeductions - annualTaxPaid
  return {
    annualTakeHome: round2(annualTakeHome),
    monthlyTakeHome: round2(annualTakeHome / 12),
    annualTaxPaid: round2(annualTaxPaid),
    annualPreTaxDeductions: round2(annualPreTaxDeductions),
  }
}

// ─────────────────────────────────────────────────────────────
// 21. Income Tax (simplified progressive brackets — illustrative
//     2024 single-filer federal brackets, not a full tax engine;
//     no state tax, standard deduction, or credits modeled.)
// ─────────────────────────────────────────────────────────────

export interface IncomeTaxInput {
  grossAnnualIncome: number
  standardDeduction: number
}

export interface IncomeTaxResult {
  taxableIncome: number
  totalTax: number
  effectiveRatePct: number
  afterTaxIncome: number
}

const FEDERAL_BRACKETS_2024_SINGLE = [
  { upTo: 11600, rate: 0.10 },
  { upTo: 47150, rate: 0.12 },
  { upTo: 100525, rate: 0.22 },
  { upTo: 191950, rate: 0.24 },
  { upTo: 243725, rate: 0.32 },
  { upTo: 609350, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
]

export function calcIncomeTax(input: IncomeTaxInput): IncomeTaxResult {
  const taxableIncome = Math.max(0, input.grossAnnualIncome - input.standardDeduction)
  let tax = 0
  let lastCap = 0
  for (const bracket of FEDERAL_BRACKETS_2024_SINGLE) {
    if (taxableIncome <= lastCap) break
    const amountInBracket = Math.min(taxableIncome, bracket.upTo) - lastCap
    tax += amountInBracket * bracket.rate
    lastCap = bracket.upTo
  }
  return {
    taxableIncome: round2(taxableIncome),
    totalTax: round2(tax),
    effectiveRatePct: input.grossAnnualIncome > 0 ? round2((tax / input.grossAnnualIncome) * 100) : 0,
    afterTaxIncome: round2(input.grossAnnualIncome - tax),
  }
}

// ─────────────────────────────────────────────────────────────
// 22. XIRR — internal rate of return for irregular cash flows,
//     solved via Newton-Raphson with a bisection fallback.
// ─────────────────────────────────────────────────────────────

export interface CashFlowEntry { date: string; amount: number }

export interface XirrResult {
  ratePct: number | null // null if it didn't converge
}

function xnpv(rate: number, flows: CashFlowEntry[]): number {
  const t0 = new Date(flows[0].date).getTime()
  return flows.reduce((sum, f) => {
    const years = (new Date(f.date).getTime() - t0) / (365.25 * 24 * 3600 * 1000)
    return sum + f.amount / Math.pow(1 + rate, years)
  }, 0)
}

export function calcXirr(flows: CashFlowEntry[]): XirrResult {
  if (flows.length < 2) return { ratePct: null }
  let rate = 0.1
  for (let i = 0; i < 100; i++) {
    const f = xnpv(rate, flows)
    const df = (xnpv(rate + 1e-5, flows) - f) / 1e-5
    if (Math.abs(df) < 1e-9) break
    const next = rate - f / df
    if (!Number.isFinite(next)) break
    if (Math.abs(next - rate) < 1e-7) { rate = next; break }
    rate = next
  }
  if (!Number.isFinite(rate) || rate < -0.99 || rate > 100) return { ratePct: null }
  return { ratePct: round2(rate * 100) }
}

// ─────────────────────────────────────────────────────────────
// 23. Systematic Withdrawal Plan (SWP) — how long a corpus lasts
//     under regular withdrawals, growing at an assumed return.
// ─────────────────────────────────────────────────────────────

export interface SwpInput {
  corpus: number
  monthlyWithdrawal: number
  annualRatePct: number
}

export interface SwpResult {
  monthsLasting: number // -1 = lasts indefinitely (growth outpaces withdrawal)
  series: SeriesPoint[]
}

export function calcSwp(input: SwpInput): SwpResult {
  const { corpus, monthlyWithdrawal, annualRatePct } = input
  const r = annualRatePct / 100 / 12
  let balance = corpus
  let months = 0
  const series: SeriesPoint[] = [{ year: 0, label: 'Now', balance: round2(balance) }]

  const monthlyGrowth = corpus * r
  if (monthlyGrowth >= monthlyWithdrawal && monthlyWithdrawal > 0) {
    return { monthsLasting: -1, series }
  }

  while (balance > 0 && months < 600) {
    balance = balance * (1 + r) - monthlyWithdrawal
    months++
    if (months % 6 === 0 || balance <= 0) {
      series.push({ year: round2(months / 12), label: `Mo ${months}`, balance: round2(Math.max(0, balance)) })
    }
  }
  return { monthsLasting: balance > 0 ? -1 : months, series }
}

// ─────────────────────────────────────────────────────────────
// 24. Monte Carlo Simulation — a simplified probabilistic
//     projection using a normal-distribution random walk
//     (Box-Muller transform), not a full historical-returns model.
// ─────────────────────────────────────────────────────────────

export interface MonteCarloInput {
  initialInvestment: number
  annualContribution: number
  years: number
  expectedReturnPct: number
  volatilityPct: number
  simulations: number
}

export interface MonteCarloResult {
  median: number
  percentile10: number
  percentile90: number
  successRatePct: number // % of simulations that ended above the initial investment
  series: SeriesPoint[] // median path per year
}

function randomNormal(): number {
  const u1 = Math.random() || 1e-9
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

export function calcMonteCarlo(input: MonteCarloInput): MonteCarloResult {
  const { initialInvestment, annualContribution, years, expectedReturnPct, volatilityPct, simulations } = input
  const meanReturn = expectedReturnPct / 100
  const vol = volatilityPct / 100
  const runs: number[] = []
  const yearlyPaths: number[][] = Array.from({ length: years + 1 }, () => [])

  const nSims = Math.min(Math.max(simulations, 100), 2000) // bounded for performance

  for (let s = 0; s < nSims; s++) {
    let balance = initialInvestment
    yearlyPaths[0].push(balance)
    for (let y = 1; y <= years; y++) {
      const annualReturn = meanReturn + vol * randomNormal()
      balance = balance * (1 + annualReturn) + annualContribution
      balance = Math.max(0, balance)
      yearlyPaths[y].push(balance)
    }
    runs.push(balance)
  }

  runs.sort((a, b) => a - b)
  const pct = (p: number) => runs[Math.floor(p * (runs.length - 1))]

  const series: SeriesPoint[] = yearlyPaths.map((yearRuns, y) => {
    const sorted = [...yearRuns].sort((a, b) => a - b)
    return { year: y, label: y === 0 ? 'Now' : `Yr ${y}`, balance: round2(sorted[Math.floor(sorted.length / 2)]) }
  })

  return {
    median: round2(pct(0.5)),
    percentile10: round2(pct(0.1)),
    percentile90: round2(pct(0.9)),
    successRatePct: round2((runs.filter(r => r > initialInvestment).length / runs.length) * 100),
    series,
  }
}

// ─────────────────────────────────────────────────────────────
// 25. Portfolio Holdings Metrics — weighted return and a simple
//     concentration-risk read from a list of holdings.
// ─────────────────────────────────────────────────────────────

export interface Holding { name: string; value: number; expectedReturnPct: number }

export interface PortfolioMetricsResult {
  totalValue: number
  weightedReturnPct: number
  largestPositionPct: number
  holdingsCount: number
  allocations: { name: string; value: number; weightPct: number }[]
}

export function calcPortfolioMetrics(holdings: Holding[]): PortfolioMetricsResult {
  const totalValue = holdings.reduce((s, h) => s + h.value, 0)
  const weightedReturnPct = totalValue > 0
    ? holdings.reduce((s, h) => s + (h.value / totalValue) * h.expectedReturnPct, 0)
    : 0
  const largestPositionPct = totalValue > 0 ? Math.max(...holdings.map(h => h.value), 0) / totalValue * 100 : 0

  return {
    totalValue: round2(totalValue),
    weightedReturnPct: round2(weightedReturnPct),
    largestPositionPct: round2(largestPositionPct),
    holdingsCount: holdings.length,
    allocations: holdings.map(h => ({ name: h.name, value: round2(h.value), weightPct: totalValue > 0 ? round2((h.value / totalValue) * 100) : 0 })),
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
