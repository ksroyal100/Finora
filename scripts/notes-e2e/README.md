# Notes end-to-end harness

Runs `tests/e2e/notes-e2e.test.ts` against a REAL stack: production Next server -> `/api/notes/sync` -> PostgREST -> Postgres.

Needs: Postgres with migrations 001-018 applied, [PostgREST](https://postgrest.org) (a single binary), Node 20+, and a built Finora Main
whose `NEXT_PUBLIC_SUPABASE_URL` points at the gateway (`http://127.0.0.1:54321`).

1. Seed users 1..30: `INSERT INTO auth.users(id,email)` + `INSERT INTO profiles(id,email)` with id `00000000-0000-4000-8000-0000000000NN`.
2. PostgREST: `db-schemas="public"`, `db-anon-role="anon"`, a `jwt-secret`, port 3001.
3. `PGRST_URL=http://127.0.0.1:3001 ANON_JWT=<anon jwt> node scripts/notes-e2e/gateway.mjs`
4. Start Main (`next start`) with `SUPABASE_SERVICE_ROLE_KEY=<jwt with role service_role signed by the same secret>`.
5. `NOTES_E2E_URL=http://127.0.0.1:3100 npx vitest run tests/e2e/notes-e2e.test.ts`
