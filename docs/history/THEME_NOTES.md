# Theme system: what changed

## The actual problem, diagnosed

Two separate things were wrong, and both are fixed:

1. **No light theme existed at all.** The app was hardcoded dark-only.
2. **The dark theme itself had a real contrast problem.** `--text-tertiary`
   was white at 28% opacity, `--text-secondary` was 55%, and borders/dividers
   sat at 6–8% opacity. That's comfortably readable on an OLED panel in a
   dim room, but drops toward unreadable under bright ambient light or
   screen glare — exactly the "looks dim, hard to see in a bright room"
   complaint. This wasn't a light-mode-only problem; it needed fixing in
   dark mode too, which is why you'll notice dark mode itself looks crisper
   now, not just the new light mode.

## What was built

- **A full light theme**, `src/app/globals.css`, added as a `[data-theme='light']`
  variable block alongside the existing (now `[data-theme='dark']`) one.
  Built from Apple's actual light-mode system colors, not a naive inverted
  palette — a straight invert of `#30D158` green or `#FFD60A` yellow onto a
  white background fails contrast badly. Each accent color has a distinct,
  darker light-mode value (e.g. green: `#30D158` dark → `#178142` light)
  chosen to stay legible as text/icon color on white, not just as a decorative
  accent.
- **Boosted dark-theme contrast**: `--text-tertiary` 0.28→0.48 alpha,
  `--text-secondary` 0.55→0.68, borders/separators roughly doubled in
  opacity. Same visual hierarchy (primary/secondary/tertiary still read as
  distinct), just no longer marginal.
- **A theme toggle** — `src/components/providers/ThemeProvider.tsx` — React
  context, persisted to `localStorage`, with an inline anti-flash script in
  `layout.tsx` so a returning user who picked light mode never sees a flash
  of dark before it applies (same technique the `next-themes` library uses).
  Defaults to **dark** for everyone unless they've explicitly chosen light —
  this preserves the app's existing brand identity for current users rather
  than silently flipping anyone's experience based on OS preference.
- **Quick toggle** in the Topbar (Sun/Moon icon, next to notifications) and a
  **proper picker** in Settings → Appearance with live mini-previews of both
  themes.

## The harder part: ~140 hardcoded colors

The design system was already built on CSS custom properties (`.card`,
`.btn`, `var(--text-primary)`, etc.) — good news, since that meant the
variable-swap approach could work at all. But ~35 page/component files also
had hardcoded hex colors sprinkled directly into inline `style={{}}` objects,
bypassing the variable system entirely. Those don't respond to a theme
switch no matter what the CSS variables say.

Went through and reclassified every hardcoded hex color into one of two
buckets:

- **Chrome/semantic colors** (a "gain" turns green, a "loss" turns red, a
  liked post's heart turns red, a delete button's icon turns red) — these
  got converted to `var(--text-green)`, `var(--text-red)`, etc., so they now
  correctly adapt per theme.
- **Data-identity colors** — things like `GOAL_COLORS`, `TYPE_COLORS`,
  `ASSET_COLORS` — fixed palettes used to visually distinguish a user's own
  goals, a marketplace product's category, or an asset class in a chart
  legend. These were **deliberately left alone**. A user who picked orange
  for their "house down payment" goal should still see orange regardless of
  theme — reinterpreting that as "chrome" and re-theming it would change
  what it means, not just how it looks.

Where a solid color and its overlaid text/icon are both fixed (e.g. black
text on a green button fill), those were left untouched too — that pairing
is correct in both themes without needing a variable.

## Deliberately out of scope

The **public marketing homepage** (`src/app/page.tsx`) and the
**legal/contact pages** were left fixed-dark, not wired to the toggle. This
is a deliberate choice, not an oversight: a marketing/brand page is commonly
kept as a fixed visual identity regardless of the in-app theme (the same
pattern you'll see on Linear, Vercel, Stripe's marketing sites) since a
visitor hasn't reached "inside the app" yet, and the homepage is a much
larger, heavily custom-styled surface (~60 hardcoded colors) than the
functional app pages. The **auth pages** (signin/signup/reset-password) —
which a user genuinely might open in a bright room before ever reaching the
app — were included in this pass.

If you want the marketing homepage theme-aware too, it's the same mechanical
process applied to one more file — say the word and it's a quick follow-up
rather than something baked in silently now.

## Verifying it yourself

```bash
npm install --legacy-peer-deps
npm run build   # verified clean, zero errors, every route
npm run dev
```

Then: Settings → Appearance to switch themes, or the Sun/Moon icon in the
topbar for a quick toggle. Your choice persists across reloads via
`localStorage`.
