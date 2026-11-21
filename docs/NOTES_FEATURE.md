# Notes: offline-first, Google Keep style

A local-first notes feature at **/notes** (sidebar → Notes). Notes live in the browser's IndexedDB (Dexie) and sync to Supabase Postgres in the background. Reading and writing never wait for the network.

## What users get
Create, edit, pin, archive, delete (with Undo), search, labels and colours. Every change is saved on the device immediately (auto-save), survives refreshes and restarts, and works offline. A small badge shows **Offline · Syncing… · Saved locally · Synced**.

## How it works

```
 browser (per signed-in user)                         server
 ┌────────────────────────────────────┐   POST /api/notes/sync    ┌──────────────────────────────┐
 │ UI (React) ──reads/writes──► Dexie │ ────────────────────────► │ withAuth (cookie OR Bearer)  │
 │   ▲ live queries     IndexedDB     │  queued changes + cursor  │  └► notes_apply_batch (SQL)  │
 │   │                                │ ◄──────────────────────── │  └► notes_pull       (SQL)   │
 │ Sync engine: queue, retry, merge   │  results + remote changes │ Postgres: notes, note_mutations │
 └────────────────────────────────────┘                           └──────────────────────────────┘
```

| Piece | File |
|-------|------|
| Schema, merge logic, permissions | `supabase/migrations/018_notes.sql` |
| API route | `src/app/api/notes/sync/route.ts` |
| Shared types/limits | `src/lib/notes/types.ts` |
| Local DB / writes / search | `db.ts`, `store.ts`, `search.ts`, `fields.ts` |
| Sync engine | `src/lib/notes/sync.ts` |
| Per-user runtime, sign-out hygiene | `src/lib/notes/session.ts` |
| React hooks (live data, autosave) | `src/lib/notes/react.ts` |
| UI | `src/components/notes/*`, `src/app/(app)/notes/page.tsx` |
| Offline page shell | `public/finora-notes-sw.js` |

### Local-first guarantees
- The page renders from IndexedDB; the server render only supplies the user id.
- Every write is one IndexedDB transaction. Typing is saved ~250 ms after the last keystroke and **always flushed immediately** when the editor/composer closes, loses focus, the tab is hidden or the page unloads.
- One database per user (`finora-notes:<userId>`); another account on the same browser cannot see it.
- Unsynced work is tracked as a diff against the last server-confirmed copy (`base`), so "what changed" can never drift.
- Several offline edits to a note are coalesced into one queued change carrying the latest values.

### Sync protocol
Each request carries queued changes (≤ 20) and a cursor; the response returns per-change results plus everything changed since the cursor (paged). Triggers: after edits (debounced 1.5 s, at least 4 s between automatic runs), every 60 s while open, on reconnect, when the tab becomes visible, and **Sync now**. Failures back off 2 s → 60 s. Only one tab syncs at a time (Web Locks). Retries are **idempotent**: every change has a `mutation_id`; a lost response never applies twice.

### Conflict handling (no silent overwrites)
The server versions every field separately. A change is applied only to fields nobody else changed since the device last saw the note.

| Situation | Result |
|-----------|--------|
| Different fields edited on two devices | Merged automatically |
| Same **title/body** edited on two devices | First writer's text stays; the other device's text is saved as a new note **"… (conflict copy)"**; user is told |
| Same value on both sides | Not a conflict |
| Labels edited on both | Union (no label lost) |
| Pin / archive / colour edited on both | The later edit (by device clock) wins; reported |
| Deleted on one device, **edited** on another | Note is **restored with the edit** |
| Deleted on one device, deleted/unchanged on other | Deleted |
| User keeps typing while a sync is in flight | Their newer text is kept; only fields they did not touch adopt the server's value |

Deletes are soft (tombstones) so other devices learn of them, and wait a 7 s **undo window** before being sent.

### Security
- The user id comes **only** from the authenticated credentials, never from the request body.
- The merge functions are executable by the **service role only** (a browser could otherwise call them with someone else's user id). Browsers can only `SELECT` their own rows (RLS); there are no client write policies.
- Foreign note ids are rejected as `forbidden` without revealing whether they exist; ownership can never change (trigger).
- Strict input validation (zod in the API, constraints in SQL). Note text is rendered as plain text (no HTML).
- The sync route has its **own rate-limit bucket** (150/min per IP) so background sync cannot exhaust the 60/min budget the rest of the API shares.
- **Shared computers:** sign-out first syncs, then deletes the local copy and the offline page cache. If something could not be synced it is **kept** (deleting it would destroy the user's work) in that user's private database until their next sign-in. Account deletion wipes it unconditionally.

### Offline reload
IndexedDB alone keeps notes available while the app is open. To let `/notes` itself open on a refresh while offline, a tiny service worker caches that page and the immutable build assets (never the API, other pages, or other origins). It is registered only in production builds, and only works after `/notes` has been opened once online.

## Operations
1. **Back up the database**, then run `supabase/migrations/018_notes.sql` (additive; idempotent; rollback SQL is at the bottom of the file, which deletes all notes).
2. The app works without the migration, but `/api/notes/sync` will return errors and notes will stay local-only.
3. Tombstones are kept indefinitely (cheap). `note_mutations` rows older than 30 days are pruned opportunistically.

## How this was verified
| Check | Result |
|-------|--------|
| SQL scenario suite (`supabase/tests/notes_sync.test.sql`): merges, conflicts, delete/restore, idempotency, cross-user attacks, validation, pagination, privileges, RLS | pass on PostgreSQL 16 from a fresh database |
| Client unit tests (real Dexie on fake-indexeddb): store, search, engine, offline queue, in-flight typing, throttling | 51 pass |
| UI tests (real components in jsdom, real Dexie): composer, search, pin, archive, delete/undo, editor autosave, sync badge, XSS | 16 pass |
| End-to-end (`tests/e2e`, run via `scripts/notes-e2e`): two simulated browsers → real HTTP → production Next server → PostgREST → Postgres | 16 pass |
| Each safety property was **mutation-tested** (sabotage it, confirm a test fails) | done |

## Known limits and decisions
- **Not tested in a real browser or against a live Supabase project.** The service worker in particular has only been syntax-checked and reviewed. Run the manual checks below.
- Plain text only: no images, checklists, reminders or sharing.
- Updates from another device arrive within ~60 s, or immediately when the tab regains focus (no realtime push).
- **No end-to-end encryption.** Notes are protected by authentication and RLS server-side, but the local IndexedDB copy is readable by anyone with access to the unlocked browser profile.
- Safari may clear site data after ~7 days without use; the app asks for persistent storage, but unsynced notes in a long-unused Safari profile can still be lost. Synced notes are always safe.
- Flag conflicts (pin/archive/colour) compare device clocks; a badly wrong clock can make an older toggle win.
- The Finora mobile app does not include Notes yet; the endpoint already accepts Bearer tokens, so it can reuse it.

## Manual test checklist (browser)
1. Open /notes online, create notes, reload: still there. Turn on airplane mode, reload `/notes`: page and notes load.
2. Offline: create/edit/pin/archive/delete; badge shows Offline. Reconnect: badge goes Syncing → Synced; check the other device.
3. Edit the same note body on two devices offline, reconnect both: a "(conflict copy)" note appears and a notice is shown.
4. Delete, then press Undo within 6 s. Sign out while offline with pending edits, sign back in: edits sync.
5. Sign in as another user in the same browser: you must not see the first user's notes.
