# 💰 Finora

> **Finora** is an independent SaaS product built and owned by **WEALTHOS**, a media & technology company
> (the same relationship as Meta → Instagram). WEALTHOS appears only as the legal owner/operator in copyright
> and legal text, never as product branding. See `docs/OWNERSHIP_AND_ARCHITECTURE.md`.

> Apple-grade Next.js 15 full-stack app. Green theme · SF Pro typography · macOS aesthetic.
>
> This used to be two separate apps (a backend + a UI frontend) running on
> different ports and talking over CORS. They're now one Next.js app: all pages live under
> `src/app/`, all API routes live under `src/app/api/`, and everything shares one origin, one
> session, and one `.env.local`. See `docs/history/MERGE_NOTES.md` for what changed and why.

## Documentation

| Doc | Purpose |
|-----|---------|
| `docs/OWNERSHIP_AND_ARCHITECTURE.md` | Brand/ownership model, the three components, env & security boundaries |
| `docs/LEGAL_REVIEW.md` | Status of every legal document and what needs a lawyer |
| `docs/MOBILE_BACKEND_SUPPORT.md` | Bearer-token support for the Finora Mobile app (what changed, how it was verified) |
| `docs/SEPARATION_REPORT.md` | What the WealthOS→Finora separation audit found and changed |
| `docs/SETUP_AND_FEATURES.md`, `docs/TECH_STACK.md` | Setup, features, stack |
| `docs/history/` | Historical change notes (merge, rebrand, redesigns, fixes) |

## Design System

| Token | Value |
|-------|-------|
| **Primary Green** | `#30D158` (Apple System Green) |
| **Background** | `#000000` / `#1C1C1E` / `#2C2C2E` |
| **Typography** | `-apple-system, BlinkMacSystemFont, "SF Pro Display"` |
| **Border radius** | `10px` (sm) · `14px` (md) · `20px` (lg) |
| **Glass effect** | `backdrop-filter: blur(20px)` |

## Pages

| Route | Page |
|-------|------|
| `/` | Landing (marketing) |
| `/signin` | Sign In |
| `/signup` | Sign Up |
| `/dashboard` | Wealth Dashboard |
| `/portfolio` | Portfolio Tracker |
| `/goals` | Goal Tracker |
| `/net-worth` | Net Worth |
| `/budgeting` | Budget Manager |
| `/ai-coach` | AI Wealth Coach |
| `/learning` | Learning Hub |
| `/community` | Community Feed |
| `/research` | Research Center |
| `/marketplace` | Marketplace |
| `/library` | My Library |
| `/notifications` | Notifications |
| `/billing` | Billing & Plans |
| `/settings` | Settings |

## Quick Start

```bash
# Install
npm install

# Set up env
cp .env.example .env.local

# Run (frontend + API, one process)
npm run dev   # http://localhost:3000
```

## Key Components

- `src/components/layout/Sidebar.tsx` — macOS-style frosted glass sidebar
- `src/components/layout/Topbar.tsx` — Search + notifications topbar  
- `src/components/shared/MetricCard.tsx` — Financial metric cards with sparklines
- `src/components/shared/PageHeader.tsx` — Consistent page headers
- `src/components/shared/EmptyState.tsx` — Empty states + skeleton loaders
- `src/app/globals.css` — Complete Apple design system with CSS variables

## Design Tokens (CSS Variables)

All design tokens are in `src/app/globals.css`:

```css
--green-400:    #30D158;   /* Primary accent */
--bg-base:      #000000;   /* Pure black base */
--bg-secondary: #1C1C1E;   /* Card surfaces */
--bg-tertiary:  #2C2C2E;   /* Inputs, inner cards */
--text-primary: rgba(255,255,255,0.92);
--glass-sidebar: rgba(14,14,16,0.85);
--blur-md:      blur(20px);
--transition-spring: 400ms cubic-bezier(0.34,1.56,0.64,1);
```

## Architecture

```
src/
├── app/
│   ├── (auth)/          # Sign in, Sign up (no sidebar)
│   ├── (app)/           # All dashboard pages (with sidebar)
│   ├── globals.css      # Complete design system
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Landing page
├── components/
│   ├── layout/          # Sidebar, Topbar
│   └── shared/          # MetricCard, PageHeader, EmptyState
└── lib/
    └── utils.ts         # cn(), formatCurrency(), formatDate()...
```
