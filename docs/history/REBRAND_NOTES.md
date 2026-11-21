# Rebrand: WealthOS → Finora

**Finora** is the SaaS product. **WEALTHOS** remains the parent company that owns and operates it.

## What changed
- **Product name** everywhere users and admins see it: UI, emails, PDF/Excel exports (incl. file metadata), page titles, SEO and share tags, PWA manifest, error messages, docs, package names.
- **New identity:** a "Finora" F-mark (green tile, same palette) used in the sidebar, sign-in/up/reset screens, landing page and admin; new favicon, PWA icons (192/512), Apple touch icon, `public/icon.svg` and `public/finora-mark.svg`. Terminal headers read `FINORA × TERMINAL` / `FINORA × COMMAND TERMINAL`.
- **Taglines** that played on "Operating System" were rewritten ("Your Wealth Creation Platform", "The Smarter Way for Building Wealth"). Replace with your own copy any time (`src/app/page.tsx`, `src/app/layout.tsx`, `src/config/constants.ts`).
- **Company references stay WEALTHOS:** footer `© <year> WEALTHOS. All rights reserved. Finora is a WEALTHOS product.`, site `creator`, and the legal documents (see below). Constants: `APP_NAME`, `COMPANY_NAME`, `PRODUCT_BYLINE` in `src/config/constants.ts`.
- **Legal documents** now say Finora provides the Service while **WEALTHOS** is the owner / operator / contracting party (including the all-caps limitation-of-liability clause). **Have a lawyer review these before launch.**
- **AI executive prompts** (JARVIS etc.) now refer to Finora.
- **Security fix found along the way:** `scripts/seed.ts` had a hard-coded founder password. It now takes credentials from env vars or generates random ones, and refuses to run when `NODE_ENV=production` or against a non-local database without `SEED_CONFIRM=yes`.
- **Fixes found along the way:** `/icon.svg` was referenced but missing (404); admin site is now `noindex`.

## Upgrading an existing database
Run `supabase/migrations/016_rebrand_to_finora.sql`. It updates legal documents (and bumps each one's `version`), AI prompts, the newsletter sender name and `system_config`. Idempotent; on a fresh install it changes nothing. Tested against PostgreSQL 16: an upgraded old database ends with text byte-identical to a fresh install.

## Existing users lose nothing
Saved calculator scenarios and the light/dark preference are read from their old local keys and migrated automatically. No cookie names, table names or API paths changed.

## Intentionally NOT changed (decide yourself)
- `legal@wealthos.ai` and the social handles in `src/config/constants.ts` and `layout.tsx` (Twitter/YouTube/LinkedIn/GitHub). They belong to the parent company today.
- Historical notes (`MERGE_NOTES.md`, code comments mentioning the old `wealthos-ui` folder).
- Old-key fallbacks (`wealthos-theme`, `wealthos:toolkit:`), kept on purpose for migration.

## Action items only you can do
1. **Domain.** `finora.app` is a **placeholder**. Register your real domain, then:
   - set the environment variables `NEXT_PUBLIC_APP_URL`, `EMAIL_FROM` (and `SUPPORT_EMAIL`), which cover newsletters, unsubscribe links and the contact form;
   - replace the four hard-coded spots: `SUPPORT_EMAIL` in `src/config/constants.ts`, `url` in `src/app/layout.tsx`, the browser-bar text in `src/app/page.tsx`, and the unsubscribe link in the email footer in `src/lib/email/resend.ts` (also `scripts/seed.ts` and migration 016 if you want the new address in seeded config).
2. **Name clearance.** Run a trademark and domain search for "Finora" in your target markets before spending on launch. It is a common-sounding fintech name. (I am not a lawyer.)
3. **Rename in external services:** Stripe (business/product names and card **statement descriptor**), Supabase project and Auth email templates / Site URL / redirect URLs, Resend sender + domain, Google/OAuth consent screen, Vercel projects, Sentry, PostHog, GitHub repo.
4. **Social accounts and support mailbox** for Finora, then update `SOCIAL_LINKS` and `SUPPORT_EMAIL`.
5. Optional: replace the generated logo with a designer's version (swap the files in `public/` and `FinoraGlyph.tsx`).
