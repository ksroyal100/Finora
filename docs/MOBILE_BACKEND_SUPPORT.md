# Backend support for the Finora Mobile app

The website authenticates with cookies. The mobile app (`Finora-Mobile`) sends `Authorization: Bearer <Supabase access token>`.

## What was wrong
Route handlers wrapped in `withAuth` already accepted Bearer tokens, but the **middleware ran first** and only validated the cookie session for `PROTECTED_API_PATHS`, so every Bearer-only request (dashboard, goals, budgeting, portfolio, net-worth, ai-coach, notifications, ...) was rejected with `401 AUTH_REQUIRED` before reaching its handler. `/api/account/delete` (not in that list) read the cookie session itself, so in-app account deletion would also fail.

## What changed (small and behaviour-preserving for the website)
| File | Change |
|------|--------|
| `src/lib/security/bearer.ts` (new) | Pure `extractBearerToken()`; edge-runtime safe |
| `src/middleware.ts` | For **API requests that carry a Bearer token**, validate it with `supabase.auth.getUser(token)`; otherwise use the cookie session as before. An invalid token is rejected (it never falls back to a cookie) |
| `src/lib/security/rbac.ts` | `getUserFromRequest` is now exported |
| `src/app/api/account/delete/route.ts` | Resolves the user from Bearer **or** cookie. The failed-attempt rate limit and audit insert now use the service-role client (explicitly scoped to `user.id`), because a Bearer-only request has no cookie session and a user-bound client would be anonymous under RLS, which would **silently disable the brute-force limit** |

## Verified (end-to-end, against the production build with a stub Supabase)
- No token / invalid token → `401 AUTH_REQUIRED`; the invalid token was actually checked upstream.
- Valid token → `200` on dashboard, goals, budgeting, notifications (was `401`).
- Admin routes: valid non-admin token → `403`, no token → `401` (admin separation intact).
- Account deletion: no token `401` · bad confirmation `400` · wrong password `401` + audit event · 5 failures → `429` · correct password `200` with the sequence token check → rate-limit lookup → password verify → audit → account removal.
- Regression tests: `tests/mobile-auth.test.ts`.

## Known backend issues found while building the mobile client (not changed)
- `PATCH /api/goals` spreads arbitrary client fields into the update (`updates`). Ownership is checked on the existing row only, so a client could try to overwrite fields such as `user_id`. Recommend whitelisting editable fields. Affects web and mobile clients alike.
- No push-token storage/sender exists; needed before mobile push notifications.
