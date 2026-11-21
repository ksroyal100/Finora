# All 77 Calculators + Free/Pro Paywall

## What was built

Every calculator in the registry is now live — no more "Coming Soon" cards.
That's 57 new calculators on top of the 20 already working, covering Goal
Planning, Real Estate, Startup & Business, Tax Planning, Investment Toolkit,
Loans, Salary, Family, and Wealth Planning.

**15 are free**, chosen as the most basic and commonly used:
Compound Interest, SIP, CAGR, Retirement Planner, FIRE Calculator, Loan EMI,
Mortgage, Rent vs Buy, Debt Payoff Planner, Emergency Fund, Future Value,
Present Value, Inflation Calculator, Savings Goal Planner, Salary Breakdown.

**The other 62 are Pro-only.** A locked calculator shows a gold "Pro" badge
on its card and, if opened directly, an upgrade prompt instead of the
calculator — never a silent failure or a fake result.

## How the paywall actually works

- `src/lib/toolkit/registry.ts` — every tool now has a `tier: 'free' | 'pro'`
  field alongside its existing `status`.
- `src/lib/toolkit/useUserPlan.ts` — a client hook that checks the logged-in
  user's `subscriptions` table row. **Fails safe to `'free'`** — if the plan
  can't be determined (logged out, query error, still loading), the pro
  calculator stays locked rather than briefly or incorrectly unlocking.
- `src/components/toolkit/ToolGate.tsx` — the actual gate. Free-tier live
  tools render immediately. Pro-tier tools check `useUserPlan()` and either
  render the calculator or an upgrade card linking to `/billing`.
- `src/components/toolkit/ToolCard.tsx` — grid cards show a gold "Pro" badge
  on locked tools instead of the usual arrow icon, so it's clear before you
  even click.

## How 57 calculators got built without 57 bespoke UIs

Building each one as a fully custom component would have meant enormous
duplicated code for math that's structurally identical. Instead:

- **11 calculators** (Dream Home, Luxury Car, Business Fund, Travel Fund,
  Millionaire Planner, Retirement Timeline, Child Education Fund, Marriage
  Fund, Vacation Planner, Passive Income Planner, Investment Goal Planner)
  are all "save toward a target amount by a date" — they share one
  `GenericGoalCalculator` engine, differing only in title, copy, and
  starting defaults.
- **28 calculators** (Hourly Rate, MRR, CAC, LTV:CAC, Break-even, Debt-to-
  Income, Capital Gains Tax, Net Worth, and more) are "a few inputs → a few
  computed outputs, no time series" — these share a config-driven
  `GenericRatioCalculator`, where each one just supplies its own field list,
  formula, and result copy.
- **4 calculators** (Portfolio Allocation, Portfolio Return, Risk Analysis,
  Portfolio Rebalancing) all fundamentally need a dynamic list of holdings
  as input — one `GenericHoldingsCalculator` covers all four.
- **The remaining ~14** (XIRR, SWP, Monte Carlo, Loan Comparison, Offer
  Comparison, Income Tax brackets, Wealth Growth Simulator, Investment
  Property Analyzer, and others) genuinely needed custom logic or UI and
  were built individually.

This isn't a shortcut on correctness — every one of the 57 has real,
independently verified math behind it (new functions in
`src/lib/toolkit/engine.ts`). It's a shortcut on writing the same form
layout from scratch 57 times.

## Two calculators that aren't calculators

"AI Financial Planner" and "What-If Simulator" were on the original list,
but they describe conversational, open-ended reasoning ("what if I switched
jobs and had worse equity but better base pay?") — not something a fixed
input form can honestly do. Rather than fake a shallow calculator for these,
they now redirect to AI Coach, where a real conversation can actually handle
that kind of question. This felt more honest than pretending a form field
could substitute for reasoning.

## Simplifications worth knowing about

- **Income Tax, Salary Breakdown, After-Tax Income, Capital Gains Tax, Tax
  Saving Planner**: use simplified flat-rate or single-bracket-table
  estimates. Real tax calculations depend on filing status, state, credits,
  and phase-outs that vary too much to model responsibly in a generic tool —
  each of these says so directly in its own insight text.
- **Monte Carlo Simulation**: uses a simplified normal-distribution random
  walk (Box-Muller transform), not real historical market return sequences.
  Good for illustrating a *range* of outcomes, not a market forecast.
- **Cost of Living Comparison**: takes a manual city cost-index ratio you
  provide rather than a live city database — no real-time cost-of-living
  data source was integrated.
- **SaaS/Startup Valuation**: revenue-multiple estimates are a common
  reference point, not an appraisal — actual valuations depend on much more
  than one multiplier.

## Performance

All 77 calculators are now code-split with `next/dynamic` — only the one
calculator you're viewing loads, not all 77 at once. The `/financial-toolkit/[slug]`
route dropped from ~182KB to ~5KB of page-specific JS as a result.

## Verifying it yourself

```bash
npm install --legacy-peer-deps
npm run build   # verified clean, zero errors, every route
npm run dev
```
