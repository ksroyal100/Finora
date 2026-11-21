> **Historical document.** This describes the merge of two older apps. At the time the product was
> called *WealthOS*, so `wealthos` and `wealthos-ui` below are those apps' original folder names.
> The product is now **Finora**; its parent company is **WEALTHOS**. Left unchanged as a record.

# Merge notes: wealthos + wealthos-ui → one app

This app used to ship as two separate Next.js projects:

- **`wealthos`** — backend only, API routes under `src/app/api/*`, ran on port 3001
- **`wealthos-ui`** — frontend pages + a few of its own API routes, ran on port 3000

They talked to each other over HTTP with CORS + a `Bearer <token>` header as a
workaround for cookies not being sent cross-origin. That's gone now — it's one
app, one origin, one session, one `.env.local`.

## What moved where

- All of `wealthos/src/app/api/*` now lives under this app's `src/app/api/*`,
  next to the routes `wealthos-ui` already had (`account/`, `auth/callback/`,
  `reports/`).
- `wealthos/src/lib/{ai,agents,voice,qdrant,stripe,email,security,analytics}`
  copied in as-is under `src/lib/`.
- `wealthos/src/services`, `src/config`, and `src/types/index.ts` copied in as-is.
- `wealthos/supabase/migrations` and `wealthos/scripts/seed.ts` copied to the
  project root — this is now the single source of truth for the DB schema.

## The two real collisions, and how they were resolved

1. **`api/auth/callback/route.ts` existed in both apps.**
   Kept `wealthos-ui`'s version — it's a strict superset (handles OAuth error
   params, logs email-verification events, handles the forwarded-host case for
   production). The backend's simpler version was dropped; nothing was lost.

2. **`lib/utils` existed in both, with different exports.**
   `wealthos-ui`'s `lib/utils.ts` has `cn()`, `formatCurrency()`, etc. for UI
   components. `wealthos`'s `lib/utils/index.ts` has `generateSlug()`,
   `hashString()`, financial-calculation helpers, etc. for the backend. These
   are genuinely different modules that happened to share a name, not
   duplicates — so the backend one was renamed to `lib/server-utils.ts`. The
   one file that imported it (`api/settings/route.ts`) was updated to match.
   No other code changes were made to either module.

3. **`lib/supabase/server.ts` existed in both.**
   The backend's version is a strict superset of the frontend's — same
   `createServerSupabaseClient()` signature, plus `getServerUser()` (Bearer
   token OR cookie), `requireAuth()`, `requireAdmin()`, `requireFounder()`,
   and `createAdminClient()`. Used the backend's version and added a
   `getUser` alias so nothing that called the old frontend name breaks.

Every other file had a distinct path — no other renames were needed.

## Behavioral changes (all necessary consequences of merging, not rewrites)

- **`src/lib/api.ts`, `SupportChatWidget.tsx`, `InsightsCard.tsx`,
  `ai-coach/page.tsx`, `contact/page.tsx`**: each had one line —
  `const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'`
  — changed to default to `''` (same-origin, relative fetch) instead of a
  hardcoded second port. Nothing else in these files changed: the same
  `Authorization: Bearer <token>` header is still sent (harmless now, and
  keeps this working if you ever split the API back out), the same
  `credentials: 'include'`, same error handling.

- **`middleware.ts`**: merged from both apps' middleware. Now handles, in one
  place: the setup-guard redirect (from `wealthos-ui`), rate limiting + CORS
  (from `wealthos`, kept in case a separate admin panel or mobile client ever
  calls this API directly), and page **and** API route auth-gating (`wealthos`
  only gated its own API routes before; now the merged API routes under
  `/api/*` get the same protection). `/api/admin/*` still passes through
  untouched — those routes do their own Bearer-or-cookie + role check via
  `withAdmin()`/`withFounder()` in `lib/security/rbac.ts`, unchanged.

- **`next.config.ts`**: merged `wealthos-ui`'s Sentry wrapper + redirects with
  `wealthos`'s security headers (`X-DNS-Prefetch-Control`, `Permissions-Policy`,
  `Cache-Control: no-store` on `/api/*`) and image remote patterns (union of
  both lists). Dropped `wealthos`'s `/admin → /admin/cc` and `/sign-in →
  /auth/signin` redirects — those pointed at page routes that never existed
  in this codebase (the backend only ever had API routes, no pages).

- **`package.json`**: single `wealthos` app, scripts merged (dev/build/start
  on the default port, plus the backend's `db:*` and `test:*` scripts),
  dependencies are the union of both apps'. `@sentry/nextjs` kept at the UI's
  newer `^10.68.0` (the backend's `sentry.client.config.ts` /
  `sentry.server.config.ts` were the older instrumentation style and are
  superseded by the UI's `instrumentation.ts` / `instrumentation-client.ts`,
  which this app now uses).

- **`vercel.json`**: kept the cron job and per-route `maxDuration` settings.
  Dropped the static `Access-Control-Allow-Origin: https://wealthos.ai`
  header — that was CORS for a cross-origin frontend that no longer exists;
  same-origin requests don't need it, and `middleware.ts` already sets CORS
  headers dynamically for the optional external-caller case.

## Environment variables

One `.env.local` now, based on `.env.example` in the project root. Key
changes from the old two-file setup:

- `NEXT_PUBLIC_APP_URL` — the one public URL for this app (was previously
  duplicated as `NEXT_PUBLIC_APP_URL` on the backend and a different
  `NEXT_PUBLIC_APP_URL` on the frontend, pointing at two different ports).
- `NEXT_PUBLIC_API_URL` — no longer required. Every internal fetch now
  defaults to a relative, same-origin path. Only set this if you
  deliberately want to point this UI at a different API host again.
- `NEXT_PUBLIC_UI_URL` — no longer used anywhere; removed.
- `NEXT_PUBLIC_ADMIN_URL` — kept, optional. Only relevant if you build and
  deploy a separate admin panel later that needs to call this API
  cross-origin.
- Everything else (Supabase, Stripe, Groq, Resend, Qdrant, PostHog, Sentry,
  `CRON_SECRET`) is unchanged, just consolidated into one file.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev                  # http://localhost:3000 — frontend + API, one process
```

For Supabase migrations:

```bash
npm run db:migrate   # supabase db push
```

## Security posture (unchanged, now consistent everywhere)

- Every mutating API route still goes through Zod validation where it did
  before — nothing in route logic was rewritten, only relocated.
- RBAC (`withAuth` / `withAdmin` / `withFounder`) in `lib/security/rbac.ts`
  is untouched and now guards the same routes it always did, plus the
  merged middleware adds a second layer of page/API auth gating.
- The Stripe webhook still verifies signatures via
  `constructStripeWebhookEvent()` before processing anything.
- `SUPABASE_SERVICE_ROLE_KEY` is still only read server-side, never exposed
  with a `NEXT_PUBLIC_` prefix, and is used only in the same limited set of
  places it was before (admin client, account deletion, audit logging).
- Rate limiting (in-memory, per server instance) now covers every API route,
  not just the ones the backend used to own.
- Security headers (`X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, HSTS in production) apply globally via both
  `middleware.ts` and `next.config.ts`'s `headers()`.

**One thing worth doing yourself:** the in-memory rate limiter in
`middleware.ts` resets if you run multiple server instances/regions (each
process has its own `Map`). For real production traffic behind a
load-balanced deployment, swap it for the `@upstash/ratelimit` +
`@upstash/redis` packages already in `package.json` — the backend had them
listed as a dependency but wasn't using them yet; this merge didn't add new
functionality, so that swap is left for you to do deliberately rather than
folded in silently here.

## Post-merge fixes (Aug 22, 2026)

Three issues surfaced after the merge, none caused by the merge itself:

1. **Groq model 404s** (`llama-3.1-8b-instant does not exist`). Groq
   deprecated `llama-3.1-8b-instant` and `llama-3.3-70b-versatile` (announced
   June 17, 2026, shut down Aug 16, 2026). Updated `lib/ai/groq.ts`'s
   `MODELS` map and the unused duplicate in `config/constants.ts` to Groq's
   current recommended replacements: `openai/gpt-oss-20b` (fast/coach) and
   `openai/gpt-oss-120b` (agent/reasoning). Named exports (`MODELS.LLAMA_8B`,
   etc.) were kept the same so no call site needed to change.

2. **AI Coach conversation delete.** Added
   `src/app/api/ai-coach/conversations/[id]/route.ts` with `GET` (full
   message history), `PATCH` (rename), and `DELETE`. Every method scopes the
   query to `.eq('user_id', user.id)` — that's the actual access control,
   not just an authentication check — so one user can't delete or read
   another user's conversation by guessing a UUID. `ai_messages` has
   `ON DELETE CASCADE` on `conversation_id`, so deleting the conversation row
   cleans up its messages automatically. The AI Coach sidebar
   (`app/(app)/ai-coach/page.tsx`) now shows a trash icon on hover per
   conversation (ChatGPT-style), removes it from the list optimistically,
   and rolls back if the request fails.

3. **Founder app 404s on `/api/admin/cc/accounting`.** This route never
   existed anywhere in the original codebase — confirmed by checking the
   pre-merge zip. It wasn't dropped during the merge; it was never built.
   Added `src/app/api/admin/cc/accounting/route.ts` (`?section=overview` and
   `?section=accounts`) following the same `withAdmin` + `apiSuccess`
   pattern as the sibling `/revenue` route, built on the `invoices` and
   `creator_payouts` tables that already exist in the schema. If your
   founder app expects different fields or additional sections, treat this
   as a first pass, not a guess at your exact spec — tell me the shape you
   need and it's a quick follow-up.

