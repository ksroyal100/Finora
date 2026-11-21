// src/lib/terminal/demo.ts
// Deterministic sample data for the Performance Terminal's DEMO mode.
// Shown only when the user has no data yet (or toggles Demo) and always
// labelled as demo in the UI — never mixed with a real account's numbers.

import { mulberry32, type SeriesPoint, type HoldingLike } from './analytics'

export interface TerminalTx {
  id: string; symbol: string; type: string; quantity: number; price: number
  total_amount: number; transaction_date: string
}
export interface TerminalGoal {
  id: string; title: string; target_amount: number; current_amount: number
  target_date: string | null; monthly_contribution: number | null; color?: string | null
}
export interface TerminalData {
  currency: string
  netWorth: number | null
  totalAssets: number
  totalLiabilities: number
  series: SeriesPoint[]
  holdings: HoldingLike[]
  transactions: TerminalTx[]
  goals: TerminalGoal[]
  lastSyncedAt: string | null
  isDemo: boolean
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

export function buildDemoData(now: Date = new Date()): TerminalData {
  const rand = mulberry32(11)
  const days = 365
  const series: SeriesPoint[] = []
  let v = 96_000
  for (let i = days; i >= 0; i -= 3) { // a snapshot every 3 days
    const d = new Date(now.getTime() - i * 86_400_000)
    const drift = 0.0009 // ~ 11% a year from growth...
    const shock = (rand() - 0.5) * 0.05 // ...with realistic swings (a few ±2% moves, real drawdowns)
    v = v * (1 + drift + shock) + 60 // ...plus a small steady contribution
    series.push({ date: iso(d), value: Math.round(v) })
  }

  const raw: Array<[string, string, string, number, number, number, number]> = [
    // symbol, name, class, qty, avgCost, price, dayPct
    ['VTI', 'Vanguard Total Market', 'etf', 120, 205, 262.4, 0.42],
    ['AAPL', 'Apple Inc.', 'stock', 85, 148, 231.1, -0.65],
    ['MSFT', 'Microsoft', 'stock', 40, 310, 428.7, 0.91],
    ['NVDA', 'NVIDIA', 'stock', 60, 62, 141.3, 2.34],
    ['BTC', 'Bitcoin', 'crypto', 0.55, 31_000, 67_450, -1.12],
    ['ETH', 'Ethereum', 'crypto', 4.2, 1_900, 3_320, 1.48],
    ['BND', 'Vanguard Total Bond', 'bond', 150, 74, 72.6, -0.08],
    ['VNQ', 'Vanguard Real Estate', 'etf', 70, 91, 88.4, -0.31],
    ['GLD', 'SPDR Gold', 'commodity', 30, 172, 238.9, 0.27],
    ['TSLA', 'Tesla', 'stock', 25, 255, 212.8, -2.05],
  ]
  const holdings: HoldingLike[] = raw.map(([symbol, name, asset_class, quantity, avg_cost, price, dayPct]) => {
    const market_value = quantity * price
    const dayChange = market_value - market_value / (1 + dayPct / 100)
    return {
      symbol, name, asset_class, quantity, avg_cost, current_price: price, market_value,
      unrealized_gain: market_value - quantity * avg_cost,
      unrealized_gain_pct: (price / avg_cost - 1) * 100,
      day_change: dayChange, day_change_pct: dayPct,
    }
  })

  const last = series[series.length - 1].value
  const tx = (n: number, symbol: string, type: string, quantity: number, price: number, ago: number): TerminalTx => ({
    id: `demo-${n}`, symbol, type, quantity, price, total_amount: quantity * price,
    transaction_date: iso(new Date(now.getTime() - ago * 86_400_000)),
  })

  return {
    currency: 'USD',
    netWorth: last,
    totalAssets: last + 38_000,
    totalLiabilities: 38_000,
    series,
    holdings,
    transactions: [
      tx(1, 'NVDA', 'buy', 10, 138.2, 2), tx(2, 'VTI', 'dividend', 120, 0.9, 4),
      tx(3, 'TSLA', 'sell', 15, 221.5, 6), tx(4, 'BTC', 'buy', 0.05, 66_100, 9),
      tx(5, 'MSFT', 'buy', 5, 421.0, 13), tx(6, 'BND', 'dividend', 150, 0.24, 17),
      tx(7, 'ETH', 'buy', 0.8, 3_180, 21), tx(8, 'GLD', 'buy', 5, 231.4, 26),
    ],
    goals: [
      { id: 'g1', title: 'Emergency Fund', target_amount: 30_000, current_amount: 27_400, target_date: iso(new Date(now.getTime() + 90 * 86_400_000)), monthly_contribution: 1_100, color: '#30D158' },
      { id: 'g2', title: 'House Down Payment', target_amount: 120_000, current_amount: 71_500, target_date: iso(new Date(now.getTime() + 600 * 86_400_000)), monthly_contribution: 2_700, color: '#0A84FF' },
      { id: 'g3', title: 'Retire at 55', target_amount: 2_000_000, current_amount: 310_000, target_date: iso(new Date(now.getTime() + 9_000 * 86_400_000)), monthly_contribution: 1_800, color: '#BF5AF2' },
    ],
    lastSyncedAt: now.toISOString(),
    isDemo: true,
  }
}
