# Legal documents — status & items for professional review

> **None of these documents has been reviewed by a lawyer. Do not treat them as production-ready until they have been.** This file is an engineering checklist, not legal advice.

All documents are stored in the `legal_documents` table (versioned, editable from Admin → Legal) and served at `/legal/<slug>`.

| Slug | Title | Origin | Status |
|------|-------|--------|--------|
| `terms` | Terms of Service | existing (009/010/016) | ⚠️ Review required |
| `privacy` | Privacy Policy | existing | ⚠️ Review required (see §2) |
| `cookies` | Cookie Policy | **new, migration 017** | ⚠️ Draft — review required |
| `disclaimer` | Financial Disclaimer | existing, retitled in 017 | ⚠️ Review required |
| `refund-policy` | Refund and Cancellation Policy | existing, retitled in 017 | ⚠️ Review required (see §3) |
| `acceptable-use` | Acceptable Use Policy | **new, migration 017** | ⚠️ Draft — review required |
| `copyright` | Copyright Notice | existing | Low risk; confirm owner name |

## 1. Ownership & operating entity (all documents)
Documents currently say Finora is "a software product owned and operated by **WEALTHOS**", and WEALTHOS is the contracting party / privacy operator. Please confirm:
- [ ] The **exact registered legal name** (and suffix, e.g. Ltd / Inc / LLC) of the WEALTHOS entity, its jurisdiction and registered address. *None are invented here; add them once confirmed.*
- [ ] That WEALTHOS (not a subsidiary or other entity) really is the contracting party, operator and data controller.
- [ ] Preferred styling: docs use all-caps "WEALTHOS"; your brand may be "WealthOS". Change `COMPANY_NAME` in `src/config/constants.ts` and edit the legal text in Admin → Legal together.

## 2. Privacy Policy
- [ ] Add processors used in code but **not named**: **Qdrant** (AI memory vector store) and **Vercel** (hosting, per `vercel.json`). Policy already names Supabase, Stripe, Groq, Resend, Sentry, PostHog.
- [ ] GDPR / UK GDPR / CCPA coverage: lawful bases, retention periods, international transfers, user rights process, EU/UK representative if applicable.
- [ ] Server-side PostHog events are sent (`analytics.service.ts`); confirm the disclosure and legal basis.

## 3. Refund & Cancellation
- [ ] "All sales are final" may conflict with consumer-protection law (e.g. EU/UK cooling-off rights, some US states). The text says "except where required by law" — confirm sufficient.
- [ ] Automatic-renewal / "click-to-cancel" rules (e.g. California ARL, FTC rules) for the sign-up and cancellation flow.

## 4. Terms of Service
- [ ] Governing law, venue, arbitration / class-action choices (deliberately **not** added).
- [ ] Add cross-references to the new Cookie Policy and Acceptable Use Policy (not edited here to avoid changing already-drafted terms without review).
- [ ] The Terms §4 and the AUP overlap by design; decide which governs in a conflict.

## 5. Financial Disclaimer / AI Coach
- [ ] Whether the AI Coach's current scope needs investment-adviser analysis in your target markets (see `LEGAL_RISK_NOTES.md` in this folder).
- [ ] Trademark & domain clearance for the name **Finora**.

## 6. Cookie Policy
- [ ] Accurate **today**: essential auth cookies + local preference storage; no advertising/analytics cookies; no consent banner. A test fails if client-side PostHog is mounted without this policy being revisited.
- [ ] Confirm no consent banner is needed in your markets for the current setup.
