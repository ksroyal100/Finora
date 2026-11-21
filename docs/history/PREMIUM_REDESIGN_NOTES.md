# Premium redesign — correcting the "dim" pass

## What was actually wrong

The previous "Bloomberg/Wall Street" redesign made two mistakes that read
as dim rather than premium:

1. **Desaturated the accent green.** `#30D158` → `#1FAD6E` was meant to feel
   "institutional," but a muted, grayed-down accent just reads as *dull* —
   real premium dark UI (Apple Card, Apple Wallet) pairs a rich background
   with a **confident, saturated** accent, not a washed-out one.
2. **Navy-tinted the background instead of true black.** A navy-charcoal
   base (`#0D0F14`) is subtler than flat black, but subtlety isn't the same
   as premium — it just made everything look slightly murky next to the
   also-muted green.

Fixed both. This is not a full palette rewrite — the *structure* (CSS
variables, both themes, the toggle) is unchanged. This corrects the specific
color choices within it.

## What changed

- **Green is vivid again**: `--green-400` is now `#2FD968` — close to
  Apple's own dark-mode systemGreen, so it's simultaneously "clearly Apple"
  and "clearly Finora green," per your instruction not to change the
  color identity. This is *not* the original neon `#30D158` (which was
  the very first complaint) — it's a deliberately chosen vivid-but-refined
  shade in between, and it's used consistently as text, fills, and glows
  across both themes.
- **Dark background is true black again** (`#000000` → `#050607` → up
  through card layers), the way Apple's own premium surfaces actually look,
  instead of the navy-gray that made things feel muddy.
- **Real depth, not flat divs**: cards now carry an actual shadow at rest
  and lift + glow on hover (`transform: translateY(-1px)` + stronger
  shadow) — this was completely missing before, which is a big part of why
  the UI read as flat rather than "worth paying for."
- **Primary buttons now have a resting glow**, not just a hover effect —
  small thing, but it's the difference between a CTA that looks alive and
  one that looks like a gray rectangle until you touch it.
- **Hero figures (net worth, big totals) are bolder** — 700 → 800 weight on
  the two largest display sizes, for more visual confidence on the numbers
  that matter most.
- **Light mode's green was too dark/muddy too** — brightened from `#0F6E4E`
  to `#0E9D52` and strengthened its shadows, so light mode doesn't feel flat
  even though it's still the toned-down "paper" background that fixed the
  original brightness complaint.

## What was deliberately kept

- The warm "paper" light-mode background (not pure white) — that fixed a
  real complaint about eye strain and shouldn't regress.
- Green as the primary brand color, unchanged in role — gold stays a
  secondary accent for premium moments only, exactly as before.
- The theme toggle, both themes, and every calculator — none of that logic
  changed, only the color values and card/button depth.

## Verifying it yourself

```bash
npm install --legacy-peer-deps
npm run build   # verified clean, zero errors, every route
npm run dev
```
