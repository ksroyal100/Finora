# Finora — Tech Stack

This documents every package in `package.json`, what it's actually doing in
this codebase (verified by grep, not assumed from the name), and why it was
chosen. Packages that are installed but **not currently imported anywhere**
are called out explicitly — that distinction matters when you're getting
oriented in a codebase, because "it's in package.json" and "it's load-bearing"
are two different facts.

---

## Core framework

| Package | Version | Why |
|---|---|---|
| **next** | 15.5.x | The app itself. App Router gives you file-system routing for both pages (`src/app/*/page.tsx`) and API routes (`src/app/api/*/route.ts`) in one project — which is the entire reason the frontend and backend could merge into one deployable unit. Route Handlers replace the old Express-style backend; Server Components mean pages like `dashboard/page.tsx` can fetch data server-side without a separate API round-trip for the initial render. |
| **react** / **react-dom** | 19.1.x | Required by Next 15. React 19 is used mostly conventionally here (hooks, no exotic new-in-19 APIs like `use()` or Actions-heavy forms) — the version is really pinned by what Next 15 requires, not by a deliberate feature bet. |
| **typescript** | ^5.6 | Static types across ~180 source files and 80+ API routes. With this many route handlers passing data between Supabase, Stripe, and the frontend, type errors at compile time (`npm run type-check`) catch a huge class of "field renamed in one place, not the other" bugs before they become 500s. |

## Database, auth, and authorization

| Package | Why |
|---|---|
| **@supabase/supabase-js** | The Postgres client + Auth client. Supabase is Postgres with Row Level Security (RLS), a hosted Auth service (email/password + OAuth), and a REST/RPC layer generated from your schema (`PostgREST`) — so most CRUD (goals, portfolio holdings, budgeting) never needs a hand-written SQL query, just `.from('table').select()`. |
| **@supabase/ssr** | The Next.js-specific adapter for Supabase Auth. Handles reading/writing the auth session as cookies correctly across Server Components, Route Handlers, and Middleware — this is what `createServerSupabaseClient()` and the session-refresh logic in `middleware.ts` are built on. Without it you'd be manually parsing JWTs out of cookies. |
| *(no ORM — Prisma/Drizzle absent)* | Worth noting explicitly: there's no separate ORM layer. Supabase's client + RLS policies (`supabase/migrations/*.sql`) *is* the data-access layer. Two clients exist for two trust levels: the anon-key client (respects RLS, used for anything scoped to "the current user") and the service-role client via `createAdminClient()` in `lib/supabase/server.ts` / `lib/security/rbac.ts` (bypasses RLS entirely — used only in admin routes, account deletion, and audit logging). |
| **zod** | Used in **49 files** — this is the most heavily used package in the repo after Supabase. Every API route that accepts a request body validates it with a Zod schema before touching the database (see the `docSchema` pattern in `api/admin/cc/vault/route.ts`, or any `budgeting`/`goals`/`community` route). This is the app's actual input-sanitization layer — it's what stands between a malformed or malicious request body and a database write. |

## Authorization / security (custom, not a package)

Role-based access control (`user → creator → moderator → admin → super_admin → founder`)
is hand-rolled in `src/lib/security/rbac.ts` via `withAuth()` / `withAdmin()` /
`withFounder()` wrapper functions, not a third-party RBAC library. This is a
deliberate, small surface area: ~300 lines, easy to audit, versus pulling in
a general-purpose auth framework for a role model this specific to one app's
`profiles.role` and `admin_users` tables.

## AI / agents

| Package | Why |
|---|---|
| **groq-sdk** | The model provider actually used for AI Coach chat completions and the 7-agent orchestrator (`lib/agents/orchestrator.ts`). Groq is chosen here for **inference speed** (LPU-based hosting) — for a chat product where perceived latency matters, Groq's speed advantage over typical GPU-hosted inference is the whole rationale. |
| **@qdrant/js-client-rest** | Vector database client for long-term AI agent memory (`lib/qdrant/memory.ts`) — storing conversation embeddings and platform knowledge, then doing semantic (`.query()`) search over them so the AI Coach can recall relevant past context instead of re-reading the entire conversation history every turn. |
| **@anthropic-ai/sdk** | ⚠️ **Installed, not currently imported anywhere in `src/`.** Present as a dependency but not wired into any route or lib file yet — likely reserved for a planned Claude-backed feature (e.g. a more capable agent, or a fallback provider) that hasn't been built. Don't assume Claude is in the request path anywhere today; Groq is. |

## Payments

| Package | Why |
|---|---|
| **stripe** | Server-side SDK. Used in `lib/stripe/client.ts` for creating Checkout Sessions and the Billing Portal, and in `api/webhooks/stripe/route.ts` to verify webhook signatures (`constructStripeWebhookEvent`) and react to subscription lifecycle events. Webhook signature verification here is a real security control, not decorative — it's what stops someone from POSTing a fake "subscription upgraded" event straight to your webhook endpoint. |
| **@stripe/stripe-js** | ⚠️ **Installed, not currently imported.** The billing flow (`app/(app)/billing/page.tsx`) redirects the browser with a plain `window.location.href = checkoutUrl` to Stripe's *hosted* Checkout page, so the client-side JS SDK (normally used for `redirectToCheckout()` or embedded Elements) isn't actually needed for the current flow. Keep it if you plan to move to embedded Stripe Elements later; safe to remove otherwise. |

## Email

| Package | Why |
|---|---|
| **resend** | Transactional email (welcome emails, subscription receipts, security alerts) — see `lib/email/resend.ts`. Resend was picked over raw SMTP/Nodemailer for the usual reasons: React-friendly templating, good deliverability out of the box, simple API — no mail server to run or maintain. |

## Analytics & observability

| Package | Why |
|---|---|
| **posthog-js** + **posthog-node** | Product analytics, both sides: `posthog-js` tracks client-side events (page views, feature usage) from the browser; `posthog-node` tracks server-side events (e.g. from webhook handlers or API routes, where there's no browser to fire an event from) — see `lib/analytics/posthog.tsx`. Using both means you don't lose events that only ever happen server-side (like a Stripe webhook firing a "subscription upgraded" event). |
| **@sentry/nextjs** | Error monitoring and performance tracing, wired via `instrumentation.ts` / `instrumentation-client.ts` and wrapped around `next.config.ts` (`withSentryConfig`). This is what tells you a route handler threw in production before a user has to file a support ticket about it. |

## Rate limiting

| Package | Why |
|---|---|
| **@upstash/ratelimit** + **@upstash/redis** | ⚠️ **Installed, not currently wired.** The rate limiting actually running today (in `middleware.ts`) is a hand-rolled in-memory `Map<ip, {count, resetAt}>` — fine for a single server process, but it resets on every deploy and doesn't share state across multiple instances/regions. These two packages are the intended upgrade path: Upstash's Redis-backed sliding-window limiter is what you'd swap in before running this behind a load balancer or on serverless functions that scale horizontally. See `history/MERGE_NOTES.md` for the same note in context. |

## UI, styling, and design system

| Package | Why |
|---|---|
| **tailwindcss** | Utility-first CSS. `globals.css` defines a custom Apple-inspired design system (CSS variables for the green/black palette, SF Pro-style typography, glass-blur effects) on top of Tailwind's utilities, rather than using a pre-built Tailwind theme. |
| **tailwind-merge** + **clsx** | The `cn()` helper in `lib/utils.ts` composes these two: `clsx` conditionally joins class name strings, `tailwind-merge` then resolves conflicts when two Tailwind classes target the same CSS property (e.g. `px-2` and `px-4` both present — last one should win, not both). This is the standard pairing anywhere Tailwind classes are built up conditionally in JSX. |
| **tailwindcss-animate** | Pre-built keyframe utilities (fade/slide/zoom transitions) as Tailwind classes, used for the toast/dialog-style UI interactions. |
| **lucide-react** | The icon set — used in 34 files across the app. Chosen for being tree-shakeable (only the icons you import end up in the bundle) and having a consistent, minimal stroke style that matches the Apple-inspired aesthetic. |
| **framer-motion** | Declarative animations for React. Used sparingly (currently one component) — likely for a specific transition that was hard to do cleanly in pure CSS. |
| **recharts** | Charting library for the two places the app visualizes time-series data (portfolio performance, net worth history). Chosen over lower-level libraries like D3 directly because it gives you production-ready chart components (line/area charts with tooltips, responsive containers) without hand-building SVG. |
| **@radix-ui/react-*** (accordion, dialog, dropdown-menu, select, tabs, toast, tooltip, etc.) | ⚠️ **Installed, but not currently imported anywhere in `src/components` or `src/app`.** There's no `components/ui/*` shadcn-style wrapper layer in this codebase — the accordions, dropdowns, and modals you see in the app are hand-rolled with plain divs/CSS rather than built on Radix primitives. These packages were likely scaffolded early (they're the standard shadcn/ui dependency list) before the team settled on the current custom-CSS approach. Either build a `components/ui` layer on top of them, or remove them — right now they're dead weight in `node_modules`. |
| **class-variance-authority** | ⚠️ **Installed, not currently imported.** Same story as Radix above — this is the "variant" system that normally pairs with shadcn/ui components (e.g. a `<Button variant="outline" size="sm">`). No component in this codebase currently uses it. |

## Reports / file generation

| Package | Why |
|---|---|
| **pdfkit** | Server-side PDF generation for exported financial reports (`lib/reports/pdfReport.ts`) — draws the PDF programmatically (text, tables, layout) rather than converting HTML to PDF, which gives more control over pagination for tabular financial data. |
| **xlsx-populate** | Server-side Excel (.xlsx) generation for the same report-export feature (`lib/reports/excelReport.ts`). Picked over the more common `xlsx`/SheetJS package specifically because it supports *writing* styled spreadsheets (fonts, number formats, column widths) — plain SheetJS is stronger on reading/parsing than on producing polished output. |

## State management

| Package | Why |
|---|---|
| **zustand** | ⚠️ **Installed, not currently imported anywhere.** No global client-state store exists in the app today — every page manages its own state with `useState`/`useEffect` and fetches its own data. This is likely here for a future need (e.g. cross-page state like a shopping cart in Marketplace, or shared AI Coach conversation state) rather than something actively in use. |

## Utilities

| Package | Why |
|---|---|
| **date-fns** | ⚠️ **Installed, not currently imported.** Date formatting/math in this app is instead hand-written in `lib/utils.ts` (UI-facing: `formatDate`, relative time like "3d ago") and `lib/server-utils.ts` (`addDays`, `addMonths`, `daysBetween`, `monthsBetween`, start-of-week/month helpers for financial calculations). These duplicate a chunk of what `date-fns` provides — if you're touching date logic, decide once whether to consolidate on `date-fns` or keep the hand-rolled versions, rather than adding a third approach. |
| **uuid** | ⚠️ **Installed, not currently imported.** UUID *validation* happens via Zod's built-in `z.string().uuid()` (used in 15+ route files) rather than this package, and UUID *generation* is left to Postgres (`gen_random_uuid()` as a column default) rather than being generated in application code. The package itself isn't in the request path anywhere. |

## Testing & dev tooling

| Package | Why |
|---|---|
| **vitest** + **@vitejs/plugin-react** + **@testing-library/react** | Test runner + React testing utilities, configured (`npm test`, `npm run test:ui`, `npm run test:coverage` all work) but **no test files currently exist** in the repo. This is a "ready to write tests" state, not "tested" — worth flagging if you're deciding what to prioritize next. |
| **eslint** + **eslint-config-next** | Next.js's recommended lint rules (`npm run lint`), catches things like missing `key` props, unused variables, and Next-specific anti-patterns (e.g. `<img>` instead of `next/image`). |
| **tsx** | Runs TypeScript files directly without a separate compile step — used for `npm run db:seed` (`scripts/seed.ts`), so seeding the database doesn't require building the whole app first. |
| **supabase** (CLI, devDependency) | Powers the `db:migrate` / `db:generate` / `db:reset` / `db:studio` scripts — pushes SQL migrations from `supabase/migrations/*.sql`, generates TypeScript types from your live schema, and runs a local Postgres+Studio instance for development. |
| **postcss** + **autoprefixer** | Tailwind's build pipeline dependencies — Tailwind compiles through PostCSS, and Autoprefixer adds vendor prefixes (`-webkit-`, etc.) automatically so you don't hand-write them for cross-browser CSS. |

---

## Quick mental model

- **Data layer**: Supabase (Postgres + Auth + RLS) is the database, the auth
  provider, and most of the "backend" — a large fraction of CRUD never
  touches a custom API route at all, it goes straight from a Server
  Component or Client Component to Supabase.
- **Custom API routes exist for**: anything needing a secret (Stripe, Groq,
  Resend, the service-role Supabase key), anything needing server-only logic
  (webhook verification, RBAC checks, PDF/Excel generation), or anything
  that's genuinely cross-cutting (the AI agent orchestrator).
- **Validation boundary**: Zod, at the top of nearly every route handler.
- **Auth boundary**: `middleware.ts` (session refresh + route gating) backed
  by `lib/security/rbac.ts` (role checks + service-role escalation for admin
  routes).
- **The "⚠️ installed, not used" packages** aren't bugs — they're mostly
  scaffolding left over from an earlier design direction (Radix/shadcn) or
  dependencies staged ahead of features not yet built (Anthropic SDK,
  Zustand, Upstash). Worth a deliberate decision (adopt or remove) rather
  than leaving them ambiguous.
