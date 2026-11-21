# Finora — Ownership & Architecture

## 1. Ownership model

**WEALTHOS** is a media & technology company (the parent). **Finora** is an independent SaaS product that WEALTHOS builds, owns and operates — the same relationship as *Meta → Instagram*.

| Layer | Rule |
|-------|------|
| Product UI & emails | Finora branding only. No WEALTHOS logo, nav, or product naming. |
| Copyright / legal text | WEALTHOS is disclosed accurately as owner/operator/contracting party. Never hidden, never overstated. |
| Code | One source of truth: `src/config/constants.ts` (`APP_NAME`, `COMPANY_NAME`, `PRODUCT_BYLINE`, `copyrightLine()`). |
| Runtime | Finora has **no runtime dependency** on the WEALTHOS corporate website or its systems. |
| Database | Finora's own Supabase project. No objects are named after WealthOS (verified). |

A regression test (`tests/brand-ownership.test.ts`) fails the build pipeline if WealthOS wording appears anywhere in `src/` outside a short, explicit allow-list (ownership constants, site metadata `creator`, and two legacy localStorage keys kept so existing users don't lose saved data).

## 2. The components (three web/API + one mobile client)

| Component | Project | Notes |
|-----------|---------|-------|
| Finora Main Application | `Finora-main` | Customer frontend (`src/app/(app)`, `(auth)`, public pages). |
| Finora Backend | `Finora-main` (`src/app/api`, `src/services`, `src/lib`) | Next.js API routes + business logic. **Deliberately co-located with the frontend** (merged earlier; see `history/MERGE_NOTES.md`): one origin, one session, no CORS for customers. |
| Finora Admin Application | `Finora_Admin-main` | Separate Next.js app. Talks to Main's `/api/admin/*` over HTTPS with the admin's Supabase bearer token. |
| Finora Mobile Application | `Finora-Mobile` (React Native / Expo) | Customer app for iOS & Android. A pure client of this backend over Bearer tokens (see `MOBILE_BACKEND_SUPPORT.md`). No secrets, no backend code. |

Splitting the backend into a third project would add a network hop, CORS surface and a second deployment for no functional gain, so it was **not** done. If you later need an independently scaled API, the clean seam is `src/app/api` + `src/services` + `src/lib`.

## 3. Security boundaries

- **Admin separation:** Admin is a different origin/deployment. Server-side, every `/api/admin/*` route is wrapped in `withAdmin` (role check). The admin UI's email allow-list (`CC_ADMIN_EMAILS`) is an extra gate, not the only one.
- **Secrets:** `SUPABASE_SERVICE_ROLE_KEY`, Stripe, Groq, Resend, Qdrant, `CRON_SECRET`, `UNSUBSCRIBE_SECRET` exist only in Main's server environment. Admin only receives the public Supabase URL/anon key and Main's URL. (Tested: no client component reads a server secret.)
- **Data isolation:** Row Level Security is enabled on all 91 public tables (125 policies) — verified by applying every migration to PostgreSQL 16.
- **Payments:** Stripe webhook (`/api/webhooks/stripe`) verifies the signature before touching the database.
- **CORS:** allow-list = `NEXT_PUBLIC_APP_URL` + `NEXT_PUBLIC_ADMIN_URL` (+ localhost in dev). The legacy `NEXT_PUBLIC_UI_URL` variable is retired.

## 4. Environment variables

See `.env.example` in each project. Main: Supabase, URLs, secrets, Stripe, Resend, AI. Admin: `NEXT_PUBLIC_API_URL`, Supabase public keys, `CC_ADMIN_EMAILS`.
Set `NEXT_PUBLIC_ADMIN_URL` in Main to the deployed Admin origin — it drives CORS and the links in admin-facing emails/notifications.
