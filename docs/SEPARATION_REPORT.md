# Finora ↔ WEALTHOS separation — audit & change report

**Ownership model applied:** WEALTHOS (media & technology company) builds and owns Finora (SaaS product) — Meta → Instagram.
**Result:** Finora Main + Finora Admin both type-check, pass 26 regression tests, and build for production. No working functionality was removed.

## 1. Audit findings

| Area | Finding |
|------|---------|
| WealthOS references | Earlier rebrand had already cleaned the UI. Remaining references in `src/` are all legitimate (see §3). No WealthOS packages, imports, API calls or domains are used at runtime. |
| Database | 91 public tables, **all with RLS** (125 policies). **No object is named after WealthOS** → no renaming needed. WEALTHOS appears only in legal document text (ownership disclosure). Full chain 001→017 applied to PostgreSQL 16 without error. |
| Admin separation | Admin is a separate app/origin. 34/37 admin API routes use `withAdmin`; the other 3 are guarded differently (`withFounder`, custom token+role check, cron bearer secret). |
| Secrets | No server secret read in any client component; no hard-coded live keys; Admin app holds no service-role/Stripe/AI keys. |
| Stripe webhook | Verifies signature before any DB write. |
| Legal docs | 4 of the 6 required documents existed. **Cookie Policy** and a standalone **Acceptable Use Policy** were missing. |

## 2. Changes made

**Ownership / branding**
- Ownership defined once in `src/config/constants.ts` (`COMPANY_NAME`, `PRODUCT_BYLINE`, `copyrightLine()`); footer, landing page and email template now use it (were 3 hard-coded copies).
- Code comments that called the product "wealthos-ui" corrected.

**Legal (migration `017_complete_legal_documents.sql`)**
- Added Cookie Policy (`/legal/cookies`) and Acceptable Use Policy (`/legal/acceptable-use`).
- Retitled `Disclaimer → Financial Disclaimer`, `Refund Policy → Refund and Cancellation Policy` (previous state snapshotted to `legal_document_revisions`).
- Additive, idempotent (re-run verified), reversible (rollback SQL included and tested). **No existing document body changed.**
- Footer and Settings now link to all six documents. See `LEGAL_REVIEW.md`.

**Bugs found and fixed during the audit (all pre-existing)**
1. `package-lock.json` was out of sync → `npm ci` failed (would break Vercel/CI). Regenerated: 53 packages added, 0 removed.
2. Transactional email footer linked to `finora.app/privacy` (404; real route `/legal/privacy`) and to a non-existent `/unsubscribe` page. Now uses the configured app URL, `/legal/privacy` and `/settings`.
3. Admin-report email and in-app notification linked to `/admin/cc/agents` on the *main* domain (route doesn't exist there). Now point to the Admin app (`NEXT_PUBLIC_ADMIN_URL`/cc/agents).
4. Two API routes' CORS lists used retired `NEXT_PUBLIC_UI_URL` (undocumented). Now `NEXT_PUBLIC_APP_URL`, consistent with middleware.
5. Cron endpoint would accept `Bearer undefined` if `CRON_SECRET` were unset. Now fails closed.

**Structure & tests**
- Loose root notes moved to `docs/` (+ `docs/history/`); READMEs updated; new `OWNERSHIP_AND_ARCHITECTURE.md`.
- Added vitest config + 26 regression tests (`tests/`): branding allow-list guard, legal document set, secret handling, webhook, admin links, cron.

## 3. Intentionally preserved WealthOS references
- `constants.ts` — company name, `legal@wealthos.ai`, parent-company social handles (replace with Finora handles when created).
- `layout.tsx` metadata `creator` — owning company.
- Legacy localStorage keys `wealthos-theme`, `wealthos:toolkit:` — functional migration fallbacks; removing them would wipe users' saved settings.
- Legal documents and `copyright` notice — ownership disclosure.
- Historical comments (`middleware.ts`) and `docs/history/`.

## 4. Verification
| Check | Main | Admin |
|-------|------|-------|
| `tsc --noEmit` | ✅ 0 errors | ✅ 0 errors |
| Production build | ✅ | ✅ |
| Regression tests | ✅ 26/26 | n/a (no tests) |
| Migrations 001→017 on PG16 | ✅ + idempotency + rollback | — |

**Not verified (cannot be from a sandbox):** live Stripe checkout/webhook delivery, real Supabase auth/RLS behaviour with real JWTs, email delivery, deployed Admin↔Main connectivity. Static analysis and builds confirm the code paths are intact; run your normal smoke test on staging.

## 5. Unresolved / needs your decision
1. **Legal review** — all six documents need a lawyer (`LEGAL_REVIEW.md`). Exact registered entity name, address and jurisdiction are not in any document and were not invented.
2. **Run migration 017** on production — *after a backup*. App works without it, but `/legal/cookies` and `/legal/acceptable-use` will 404 until it is applied.
3. **Privacy Policy** doesn't name Qdrant or Vercel as processors.
4. **Casing:** legal text uses "WEALTHOS"; you write "WealthOS". One constant + Admin → Legal edit to change.
5. **No ESLint config** exists in Main (pre-existing); not added without your say.
6. **Backend not split** into a third project by design (would add risk, no benefit now).
7. `NEXT_PUBLIC_ADMIN_URL` must be set in Main's production env.
8. `npm audit` / dependency upgrades were out of scope.

## Addendum — Finora Mobile (React Native)
A fourth project, `Finora-Mobile`, now ships alongside Main and Admin. Backend impact (all verified end-to-end, see `MOBILE_BACKEND_SUPPORT.md`): middleware accepts and validates Bearer tokens on API routes; `/api/account/delete` accepts Bearer auth and rate-limits via the service-role client. Main regression tests: 40 passing. Newly found backend issue (unchanged): `PATCH /api/goals` accepts arbitrary fields.

## Addendum — Notes
Offline-first Notes added (migration 018, `/notes`, `/api/notes/sync`). See `NOTES_FEATURE.md`.
