# Redesign + Calculator Expansion — what changed

## 1. Theme redesign (both modes)

**The complaint, and what it actually was:** light mode used pure `#FFFFFF`
as its main surface color. Under normal room lighting, a pure-white UI
surface behaves like a light source pointed at your face, not a "surface" —
that's the physical reason it read as painful to look at, independent of
contrast math. And on the dark side: "you did nothing" was fair — the
previous pass fixed *contrast numbers* but kept the exact same flat-black,
neon-green, consumer-iOS-app character. That's a different problem than
contrast, and it's fixed now.

**What actually changed:**

- **Dark theme background**: flat `#000000` → a deep navy-charcoal
  (`#08090C` base, `#15171F`/`#1D212B` for cards). This is the actual
  Bloomberg-terminal / trading-desk look — professional near-black has a
  cool blue undertone, not a flat true-black, which is what a consumer phone
  app uses.
- **Light theme background**: pure `#FFFFFF` → a warm "paper" stone tone
  (`#EAE8E3` base, `#F6F5F1` cards). Still light, still bright enough to read
  comfortably, but no longer a flashbulb. This is the direct fix for "can't
  even look at the screen."
- **Text**: dark mode's near-white text and light mode's near-black text
  were both softened slightly (off-white / charcoal-navy instead of pure
  white / pure black) — pure-black-on-white is its own kind of harsh, the
  same restraint that fixed the background was applied to text too.
- **Brand green**: the old `#30D158` was a bright, saturated "iOS weather
  app" green. Replaced with a deeper, more desaturated emerald (`#1FAD6E`
  dark / `#12805A` light) — reads as "wealth/institutional" rather than
  "consumer app," while keeping the same hue family so it's still
  recognizably the same brand.
- **New: Wall Street gold accent** (`--gold-400` etc., plus `.text-gold` and
  `.badge-gold` utility classes). This doesn't replace green as the primary
  interactive color — it's a second accent for premium/highlight moments
  (plan badges, key headline figures), the way a terminal uses amber as a
  secondary information color.
- **New: `.figures` / `.figures-mono` utility classes** — tabular (fixed-width)
  numerals for financial figures, so columns of numbers actually align
  instead of jittering as digits change width. This is a small but real
  "precision instrument" touch that's characteristic of terminal-style
  financial UIs; apply the class to any price/percentage/balance display.

**Every color is still a CSS variable**, so both themes update instantly
via the same toggle from the previous pass — this was a palette swap, not
new theming infrastructure.

**Left alone, deliberately:** data-identity palettes (`GOAL_COLORS`,
`TYPE_COLORS`, `ASSET_COLORS`) — a user's own goal color, a marketplace
category color — same reasoning as before: these represent *meaning*, not
chrome, and shouldn't shift with a rebrand.

## 2. Financial calculators — 10 new, fully working

The registry had 78 calculators listed; only 10 had actual working
implementations. The other 68 showed a "Coming Soon" card when clicked,
which is why they read as "not working" — they weren't broken, they were
placeholders.

**Checked the 10 existing ones first**: reviewed the calculation engine and
every calculator component's state wiring. Found no functional bugs — they
appear to have been genuinely working, just surrounded by 68 unbuilt
placeholders that made the whole section look broken.

**Built 10 new ones, fully working**, each with real calculation logic in
`src/lib/toolkit/engine.ts` and a full UI in `src/components/toolkit/calculators/`:

| Calculator | Category |
|---|---|
| Future Value | Wealth Planning |
| Present Value | Wealth Planning |
| Inflation Calculator | Wealth Planning |
| Savings Goal Planner | Wealth Planning |
| Lump Sum Calculator | Investment Toolkit |
| Rental Yield | Real Estate |
| Cap Rate | Real Estate |
| Cash-on-Cash Return | Real Estate |
| Down Payment Planner | Real Estate |
| Salary Breakdown (take-home pay) | Salary |

All 20 live calculators are free — nothing in the toolkit is paywalled;
there was no premium gate to remove in the first place. The "Salary
Breakdown" one is explicitly labeled as a simplified flat-rate estimate,
not a real tax-bracket engine — modeling actual take-home pay correctly
requires filing status, state, and bracket data that varies too much to
responsibly fake.

**Not done, and said plainly rather than hidden:** 57 calculators are still
"Coming Soon" — things like XIRR, Monte Carlo simulation, portfolio
rebalancing, and dozens more. Building all 67 originally-unbuilt calculators
to real, correct quality is a much larger project than fits in one pass;
doubling the live count from 10 to 20 was the achievable, honest scope for
this round. If there are specific ones from the remaining list you want
prioritized next, say which ones.

## Verifying it yourself

```bash
npm install --legacy-peer-deps
npm run build   # verified clean, zero errors, every route
npm run dev
```
