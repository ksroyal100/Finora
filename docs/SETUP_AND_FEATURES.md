# Finora — Setup & Features

## Run it
```bash
npm install
cp .env.example .env.local          # fill in at least the REQUIRED lines (Supabase + URLs)
# Database: run the SQL files in supabase/migrations IN ORDER (001 → 017), either
#   • Supabase Dashboard → SQL Editor (paste each file), or
#   • supabase CLI:  npm run db:migrate
npm run dev                         # http://localhost:3000
```
Production: `npm run build && npm start`, or deploy to Vercel (cron + function limits are already in `vercel.json`).

**Requires:** Node 20 or newer (tested on Node 22), a Supabase project. Stripe / Resend / Groq / Qdrant are optional and switch on when their keys are set.

## Make yourself an admin (for the Command Center)
Sign up in the app, then run `supabase/migrations/admin_user_setup.sql` in the SQL editor (paste your user UUID), or:
`UPDATE profiles SET role = 'founder' WHERE email = 'you@example.com';`
Then run the separate **Finora Command Center** project (port 3002) with `NEXT_PUBLIC_API_URL` pointing here.

## Migrations
`001_core_schema` → `002` … `014_user_feedback` → **`015_admin_terminal_realtime`** → **`016_rebrand_to_finora`**. 016 brings an existing database to the Finora branding (legal documents, AI prompts, newsletter sender, config); on a fresh install it changes nothing. 015 adds nine low-traffic tables to the Supabase Realtime publication so the admin Command Terminal can update on change instead of polling. It's idempotent and safe to re-run. Without it everything works; the terminal just falls back to a slow poll.

→ **`017_complete_legal_documents`** adds the Cookie Policy and Acceptable Use Policy and retitles the Disclaimer / Refund documents. It is additive, idempotent and has a documented rollback. **Back up the database first.**

## New in this version

### For your users
| Route | Feature |
|---|---|
| `/dashboard` | **Progress Hub**: "Your week in money" recap (net worth change, spending vs last week, top category, top mover, one next best action), next net-worth milestone with ETA, weekly logging streak, achievement badges. **Quick actions** bar. Responsive metric/main grids for phones. |
| `/simulator` | **What-If Simulator**: sliders for starting amount, monthly saving, years, risk style (+ advanced return/volatility/step-ups/inflation), probability cone, "vs your current plan", chance of reaching a goal, "what moves the needle", today's-money toggle, copy summary. Starts from the user's real numbers. |
| `/performance` | **Performance Terminal**: live, dark "quant terminal" view of net worth: equity curve + drawdown, holdings heat grid, allocation + concentration, Monte Carlo cone, goal pacing, risk meters, activity tape. Demo mode for empty accounts. |
| `/financial-toolkit` | Link card to the terminal. |

### For admins (served by this app's API, shown in the Command Center project)
| API | Purpose |
|---|---|
| `GET /api/admin/cc/reports?period=daily|weekly|monthly&date=YYYY-MM-DD&format=json|pdf|xlsx` | Business reports with previous-period comparison. PDF/Excel exports are written to the audit log. |
| `GET /api/admin/cc/terminal?fresh=1&since=<ISO>` | One compact snapshot for the Command Terminal, with a freshness-aware single-flight cache (many admins share one recompute; never serves data older than a change). |

## Cron
`vercel.json` runs `/api/admin/cc/revenue/cron` daily at 02:00 UTC with `Authorization: Bearer $CRON_SECRET`. MRR/ARR in the terminal and reports come from this snapshot; the terminal raises an alert when it goes stale. If you are not on Vercel, schedule that URL yourself.

## Honest limits
- Calculated metrics that can't be measured yet show **N/A** (not zero). Simulator, Monte Carlo and milestone ETAs are educational projections, labelled as such in the UI.
- Bank linking (Plaid/open-banking) is not included; it needs your provider account.
- `npm run lint` needs an ESLint config the project doesn't ship; use `npm run type-check`.

## Production notes
- **Health check:** `GET /api/health` returns `{status:"ok"}` with no database or secret access. Point your uptime monitor at it.
- **Build memory:** `npm run build` type-checks ~300 files and needs roughly 4 GB RAM or more. Vercel and most CI runners are fine; on a small VPS add swap or build in CI.
- **Keys are optional at build time:** Groq, Stripe and Resend clients are created on first use, so the app builds and runs without them; only the related feature reports a clear error until the key is set.
- **Verified in a clean-room test** (fresh unzip, plain `npm install`, 0 type errors, production build with only the three Supabase variables set, then served): public pages 200, private pages redirect to sign-in, every `/api/admin/*` route returns 401 when signed out, HSTS / X-Frame-Options / nosniff headers present.
