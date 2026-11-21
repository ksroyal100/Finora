// src/lib/progress/simulator.ts
//
// Engine behind the What-If Simulator (/simulator). Pure and deterministic
// (seeded), so the same sliders always give the same picture.
//
// Model, in plain words:
//  - Money grows by a "typical" yearly return. That is the MEDIAN path: half of
//    simulated futures end above the dashed line, half below.
//  - Each month the value is also shaken by volatility (random up/down), which is what
//    makes the cone. Volatility does not change the typical path, only the spread.
//  - A monthly contribution is added at the end of each month and can step up once a year.
//  - "Today's money" mode removes inflation by using the real return
//    (1 + r) / (1 + inflation) − 1. Contributions are then treated as constant in
//    today's money.
// This is an educational projection, not a forecast or advice.

import { mulberry32, percentile } from '@/lib/terminal/analytics'

export type RiskProfile = 'conservative' | 'balanced' | 'growth' | 'aggressive'

export const RISK_PROFILES: Record<RiskProfile, { label: string; annualReturn: number; annualVol: number; blurb: string }> = {
  conservative: { label: 'Conservative', annualReturn: 0.04, annualVol: 0.06, blurb: 'Mostly bonds and cash. Smoother, slower.' },
  balanced:     { label: 'Balanced',     annualReturn: 0.065, annualVol: 0.11, blurb: 'A mix of stocks and bonds.' },
  growth:       { label: 'Growth',       annualReturn: 0.08, annualVol: 0.16, blurb: 'Mostly stocks. Bumpier, higher upside.' },
  aggressive:   { label: 'Aggressive',   annualReturn: 0.10, annualVol: 0.20, blurb: 'Stocks and high risk. Big swings.' },
}

export interface SimInput {
  startValue: number
  monthlyContribution: number
  years: number
  annualReturn: number       // typical yearly return, e.g. 0.07
  annualVol: number          // yearly volatility, e.g. 0.15
  inflation: number          // yearly, e.g. 0.025 (only used when `real`)
  real: boolean              // show results in today's money
  contributionGrowth?: number // yearly step-up of the contribution, e.g. 0.03
  target?: number | null
  paths?: number
  seed?: number
}

export interface SimResult {
  months: number
  p10: number[]; p50: number[]; p90: number[]   // length months + 1 (index 0 = today)
  deterministic: number[]                        // the typical path in closed form, length months + 1
  endP10: number; endP50: number; endP90: number
  totalContributed: number                       // sum of all contributions over the horizon
  growth: number                                 // endP50 − startValue − totalContributed
  probTarget: number | null                      // % of futures at/above target at the END of the horizon
  yearsToTarget: number | null                   // when the typical path first reaches target
  effectiveReturn: number                        // the yearly return actually used (real or nominal)
}

export function effectiveReturn(i: Pick<SimInput, 'annualReturn' | 'inflation' | 'real'>): number {
  return i.real ? (1 + i.annualReturn) / (1 + i.inflation) - 1 : i.annualReturn
}

function contributionForMonth(i: SimInput, month: number): number {
  const stepUps = Math.floor((month - 1) / 12) // month 1..12 → 0 step-ups
  return i.monthlyContribution * Math.pow(1 + (i.contributionGrowth ?? 0), stepUps)
}

/** Typical path: closed-form monthly compounding with contributions. Index 0 = start. */
export function deterministicPath(i: SimInput): number[] {
  const months = Math.round(i.years * 12)
  const r = effectiveReturn(i)
  const g = Math.pow(1 + r, 1 / 12)
  const path = [i.startValue]
  let v = i.startValue
  for (let m = 1; m <= months; m++) {
    v = v * g + contributionForMonth(i, m)
    path.push(v)
  }
  return path
}

export function yearsToTarget(i: SimInput): number | null {
  if (i.target == null || i.target <= 0) return null
  if (i.startValue >= i.target) return 0
  // search up to 60 years so "never" is a real answer, not a horizon artefact
  const long = { ...i, years: 60 }
  const path = deterministicPath(long)
  const idx = path.findIndex(v => v >= i.target!)
  return idx < 0 ? null : idx / 12
}

function gaussian(rand: () => number): number {
  let u = 0
  while (u === 0) u = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

export function simulate(i: SimInput): SimResult {
  const months = Math.max(1, Math.min(Math.round(i.years * 12), 600))
  const paths = Math.max(100, Math.min(i.paths ?? 800, 3000))
  const r = effectiveReturn(i)
  const muM = Math.log(1 + r) / 12                      // median log-growth per month
  const sigM = Math.max(0, i.annualVol) / Math.sqrt(12)
  const rand = mulberry32(i.seed ?? 20260101)

  const grid: number[][] = Array.from({ length: months + 1 }, () => [])
  const finals: number[] = []
  for (let p = 0; p < paths; p++) {
    let v = i.startValue
    grid[0].push(v)
    for (let m = 1; m <= months; m++) {
      v = v * Math.exp(muM + sigM * gaussian(rand)) + contributionForMonth(i, m)
      grid[m].push(v)
    }
    finals.push(v)
  }
  const sorted = grid.map(col => [...col].sort((a, b) => a - b))
  const p10 = sorted.map(c => percentile(c, 0.1))
  const p50 = sorted.map(c => percentile(c, 0.5))
  const p90 = sorted.map(c => percentile(c, 0.9))

  let totalContributed = 0
  for (let m = 1; m <= months; m++) totalContributed += contributionForMonth(i, m)

  const det = deterministicPath({ ...i, years: months / 12 })
  return {
    months, p10, p50, p90, deterministic: det,
    endP10: p10[months], endP50: p50[months], endP90: p90[months],
    totalContributed,
    growth: p50[months] - i.startValue - totalContributed,
    probTarget: i.target != null && i.target > 0 ? (finals.filter(f => f >= i.target!).length / paths) * 100 : null,
    yearsToTarget: yearsToTarget(i),
    effectiveReturn: r,
  }
}

/** How much sooner (years) a changed plan reaches the target. Positive = sooner. null if either never gets there. */
export function yearsSooner(base: SimInput, alt: SimInput): number | null {
  const a = yearsToTarget(base), b = yearsToTarget(alt)
  return a === null || b === null ? null : a - b
}
