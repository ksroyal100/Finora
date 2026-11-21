import { v4 as uuid } from 'uuid'
import type { LocalNote, NotesDB } from './db'
import {
  EMPTY_FIELDS, NOTE_FIELDS,
  type MutationResult, type NoteField, type NoteFields, type ServerNote, type SyncCursor, type SyncMutation, type SyncRequest, type SyncResponse,
} from './types'
import { diffFields, fieldEqual, fieldsOf, isBlank } from './fields'
import { createNote } from './store'

// ── errors & transport ───────────────────────────────────────

export type SyncErrorKind = 'network' | 'auth' | 'server' | 'bad_request'

export class SyncError extends Error {
  readonly kind: SyncErrorKind
  constructor(kind: SyncErrorKind, message?: string) {
    super(message ?? kind)
    this.name = 'SyncError'
    this.kind = kind
  }
}

export type SyncTransport = (req: SyncRequest) => Promise<SyncResponse>

/** HTTP transport for POST /api/notes/sync. In the browser it uses the session cookie; tests/mobile pass a Bearer header. */
export function createHttpTransport(opts: { baseUrl?: string; headers?: Record<string, string>; fetchImpl?: typeof fetch } = {}): SyncTransport {
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  return async (req) => {
    let res: Response
    try {
      res = await doFetch(`${opts.baseUrl ?? ''}/api/notes/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        body: JSON.stringify(req),
        credentials: 'same-origin',
        cache: 'no-store',
      })
    } catch {
      throw new SyncError('network')
    }
    if (res.status === 401 || res.status === 403) throw new SyncError('auth')
    if (res.status === 400 || res.status === 413) throw new SyncError('bad_request')
    if (!res.ok) throw new SyncError('server', `HTTP ${res.status}`)
    let json: { success?: boolean; data?: SyncResponse }
    try { json = await res.json() } catch { throw new SyncError('server', 'bad response') }
    if (!json.success || !json.data) throw new SyncError('server', 'bad response')
    return json.data
  }
}

// ── applying server results to the local database (pure DB logic, unit-tested) ──

export interface SentSnapshot { id: string; localRev: number; fields: NoteFields }
export interface ResultEffects { copies: number; restored: number }

const TEXT_FIELDS: NoteField[] = ['title', 'content']

function cleanFromServer(s: ServerNote): LocalNote {
  const fields: NoteFields = { title: s.title, content: s.content, color: s.color, labels: [...s.labels], pinned: s.pinned, archived: s.archived, deleted: s.deleted }
  return {
    ...fields,
    id: s.id,
    createdAt: Date.parse(s.created_at) || Date.now(),
    updatedAt: Date.parse(s.updated_at) || Date.now(),
    serverVersion: s.version,
    base: fieldsOf(fields),
    dirty: 0, localRev: 1, mutationId: uuid(), copyId: uuid(), syncError: null, errorRev: 0,
  }
}

/**
 * Fold the server's answer for ONE pushed note back into IndexedDB.
 *
 * The user may have kept typing while the request was in flight, so this works per FIELD: a field the user did not
 * touch since the push adopts the server's value (this picks up merges from other devices); a field the user DID
 * touch keeps the local value and stays dirty. That is what prevents a stale local value from later overwriting
 * another device's newer edit.
 */
export async function applyMutationResult(db: NotesDB, sent: SentSnapshot, result: MutationResult): Promise<ResultEffects> {
  const fx: ResultEffects = { copies: 0, restored: 0 }
  await db.transaction('rw', db.notes, async () => {
    if (result.copy) { await db.notes.put(cleanFromServer(result.copy)); fx.copies++ } // the loser's text, saved as its own note
    if (result.restored) fx.restored++

    const cur = await db.notes.get(sent.id)
    if (!cur) return

    if (result.status === 'rejected') {
      // Permanent rejection: stop retrying THIS note until the user edits it, but never touch its content.
      await db.notes.put({ ...cur, syncError: result.error ?? 'rejected', errorRev: cur.localRev })
      return
    }

    const S = result.note
    if (!S) {
      // The server stored nothing (the note was created and deleted before it ever synced): we are done with it.
      if (cur.deleted) await db.notes.delete(cur.id)
      return
    }

    const conflicts = result.conflicts ?? []
    const merged: NoteFields = fieldsOf(cur)
    let preserveServerText = false
    for (const f of NOTE_FIELDS) {
      const touchedSincePush = !fieldEqual(f, cur, sent.fields)
      if (touchedSincePush) {
        // The user kept editing a field the server just refused to overwrite: keep their text, and also keep the
        // server's text as a separate note so neither side is lost.
        if (TEXT_FIELDS.includes(f) && conflicts.includes(f)) preserveServerText = true
      } else {
        ;(merged as unknown as Record<string, unknown>)[f] = f === 'labels' ? [...S.labels] : S[f]
      }
    }

    if (merged.deleted) {
      const editedInFlight = diffFields(cur, sent.fields).some((f) => f !== 'deleted')
      if (!editedInFlight) { await db.notes.delete(cur.id); return }
      merged.deleted = false // keep the user's newer edits; the next push restores the note on the server
    }

    const base = fieldsOf(S)
    await db.notes.put({
      ...cur, ...merged,
      serverVersion: S.version, base,
      dirty: diffFields(merged, base).length > 0 ? 1 : 0,
      syncError: null, errorRev: 0,
    })

    if (preserveServerText) {
      await createNote(db, { title: `${S.title || 'Untitled'} (conflict copy)`.slice(0, 500), content: S.content, color: S.color, labels: S.labels })
      fx.copies++
    }
  })
  return fx
}

/** Apply notes pulled from the server. Notes with unsynced local edits are never touched here; the push step resolves them. */
export async function applyServerChanges(db: NotesDB, changes: ServerNote[]): Promise<number> {
  let applied = 0
  await db.transaction('rw', db.notes, async () => {
    for (const s of changes) {
      const cur = await db.notes.get(s.id)
      if (!cur) {
        if (!s.deleted) { await db.notes.put(cleanFromServer(s)); applied++ }
        continue
      }
      if (cur.dirty === 1) continue
      if (s.version <= cur.serverVersion) continue // already have it (the cursor deliberately overlaps)
      if (s.deleted) { await db.notes.delete(cur.id); applied++; continue }
      await db.notes.put({ ...cleanFromServer(s), createdAt: cur.createdAt, localRev: cur.localRev, mutationId: cur.mutationId, copyId: cur.copyId })
      applied++
    }
  })
  return applied
}

export function buildMutation(n: LocalNote): SyncMutation {
  return {
    mutation_id: n.mutationId,
    id: n.id,
    base_version: n.serverVersion,
    dirty: n.base ? diffFields(n, n.base) : diffFields(n, EMPTY_FIELDS),
    note: fieldsOf(n),
    copy_id: n.copyId,
    client_updated_at: n.updatedAt,
  }
}

// ── status ───────────────────────────────────────────────────

export type SyncLabel = 'offline' | 'syncing' | 'saved' | 'synced'

/** The four user-visible states: Offline, Syncing, Saved locally, Synced. */
export function deriveSyncLabel(s: { online: boolean; syncing: boolean; lastError: SyncErrorKind | null; pending: number }): SyncLabel {
  if (!s.online || s.lastError === 'network') return 'offline'
  if (s.syncing) return 'syncing'
  if (s.pending > 0 || s.lastError) return 'saved'
  return 'synced'
}

export interface SyncNotice { id: number; copies: number; restored: number }

export interface SyncStatus {
  syncing: boolean
  online: boolean
  lastError: SyncErrorKind | null
  lastSyncedAt: number | null
  notice: SyncNotice | null
}

export interface SyncRunSummary { pushed: number; pulled: number; copies: number; restored: number; error: SyncErrorKind | null; skipped?: boolean }

export interface EngineOptions {
  transport: SyncTransport
  isOnline?: () => boolean
  now?: () => number
  undoWindowMs?: number
  debounceMs?: number
  /** Minimum gap between AUTOMATIC runs (edits, poll). Regaining connectivity / returning to the tab / syncNow() are never delayed. */
  minIntervalMs?: number
  pollMs?: number
  overlapMs?: number
  batchSize?: number
  withLock?: <T>(fn: () => Promise<T>) => Promise<T | undefined>
  attachWindowListeners?: boolean
}

const ZERO_UUID = '00000000-0000-0000-0000-000000000000'
const CURSOR_KEY = 'cursor'

export class SyncEngine {
  private status: SyncStatus
  private listeners = new Set<() => void>()
  private running: Promise<SyncRunSummary> | null = null
  private rerun = false
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private deferTimer: ReturnType<typeof setTimeout> | null = null
  private retryDelay = 0
  private lastRunStartedAt = 0
  private noticeSeq = 0
  private started = false
  private detach: (() => void) | null = null
  private readonly o: Required<Omit<EngineOptions, 'withLock' | 'transport' | 'attachWindowListeners'>> & Pick<EngineOptions, 'withLock' | 'transport' | 'attachWindowListeners'>

  constructor(private db: NotesDB, opts: EngineOptions) {
    this.o = {
      isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
      now: () => Date.now(),
      undoWindowMs: 7_000, debounceMs: 1_500, minIntervalMs: 4_000, pollMs: 60_000, overlapMs: 120_000, batchSize: 20,
      ...opts,
    }
    this.status = { syncing: false, online: this.o.isOnline(), lastError: null, lastSyncedAt: null, notice: null }
  }

  // observable (works with useSyncExternalStore)
  getStatus = (): SyncStatus => this.status
  subscribe = (l: () => void): (() => void) => { this.listeners.add(l); return () => this.listeners.delete(l) }
  private set(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch }
    this.listeners.forEach((l) => l())
  }
  dismissNotice() { if (this.status.notice) this.set({ notice: null }) }

  start() {
    if (this.started) return
    this.started = true
    if (this.o.attachWindowListeners !== false && typeof window !== 'undefined') {
      const onOnline = () => { this.set({ online: true }); this.requestSync('online', 0) }
      const onOffline = () => this.set({ online: false })
      const onVisible = () => { if (document.visibilityState === 'visible') this.requestSync('visible', 0) }
      window.addEventListener('online', onOnline)
      window.addEventListener('offline', onOffline)
      document.addEventListener('visibilitychange', onVisible)
      this.detach = () => {
        window.removeEventListener('online', onOnline)
        window.removeEventListener('offline', onOffline)
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
    this.pollTimer = setInterval(() => { if (this.o.isOnline()) this.requestSync('poll', 0) }, this.o.pollMs)
    this.requestSync('start', 0)
  }

  stop() {
    this.started = false
    this.detach?.(); this.detach = null
    for (const t of [this.debounceTimer, this.retryTimer, this.deferTimer]) if (t) clearTimeout(t)
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.debounceTimer = this.retryTimer = this.deferTimer = null
    this.pollTimer = null
  }

  /** Ask for a sync soon (debounced). Called after every local write; costs nothing if offline. */
  requestSync(reason = 'manual', delayMs: number = this.o.debounceMs) {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    // Automatic triggers (edits, poll) are spaced out so a burst of typing cannot hammer the API.
    // 'start' / 'online' / 'visible' / 'manual' are immediate: the user just came back and expects fresh data.
    const automatic = reason === 'edit' || reason === 'poll'
    const wait = automatic ? Math.max(delayMs, this.lastRunStartedAt + this.o.minIntervalMs - this.o.now()) : delayMs
    if (wait <= 0) { this.debounceTimer = null; void this.syncNow(); return }
    this.debounceTimer = setTimeout(() => { this.debounceTimer = null; void this.syncNow() }, wait)
  }

  /** Run a sync now. Single-flight: a request made during a run triggers exactly one follow-up run. */
  syncNow(): Promise<SyncRunSummary> {
    if (this.running) { this.rerun = true; return this.running }
    this.running = (async () => {
      let total: SyncRunSummary = { pushed: 0, pulled: 0, copies: 0, restored: 0, error: null }
      try {
        do {
          this.rerun = false
          const lockedRun = this.o.withLock ? await this.o.withLock(() => this.runOnce()) : await this.runOnce()
          if (lockedRun) {
            total = { pushed: total.pushed + lockedRun.pushed, pulled: total.pulled + lockedRun.pulled, copies: total.copies + lockedRun.copies,
                      restored: total.restored + lockedRun.restored, error: lockedRun.error }
          } else total.skipped = true
        } while (this.rerun && !total.error)
      } finally {
        this.running = null
      }
      return total
    })()
    return this.running
  }

  private async runOnce(): Promise<SyncRunSummary> {
    const summary: SyncRunSummary = { pushed: 0, pulled: 0, copies: 0, restored: 0, error: null }
    if (!this.o.isOnline()) { this.set({ online: false }); return summary }

    this.lastRunStartedAt = this.o.now()
    this.set({ syncing: true, online: true })
    try {
      const stored = (await this.db.meta.get(CURSOR_KEY))?.value as SyncCursor | undefined
      // Start a little BEFORE the stored cursor: a row whose transaction committed late may have been missed. Re-delivery is harmless.
      let since: SyncCursor | null = stored ? { ts: new Date(Date.parse(stored.ts) - this.o.overlapMs).toISOString(), id: ZERO_UUID } : null
      let lastCursor: SyncCursor | null = stored ?? null
      const attempted = new Set<string>()
      let hasMore = true
      let deferUntil: number | null = null

      for (let round = 0; round < 100 && hasMore; round++) {
        const { batch, deferAt } = await this.collectBatch(attempted)
        if (deferAt !== null) deferUntil = deferAt

        const req: SyncRequest = { mutations: batch.map(buildMutation), cursor: since }
        let res: SyncResponse
        try {
          res = await this.send(req)
        } catch (e) {
          if (e instanceof SyncError && e.kind === 'bad_request' && batch.length === 0) {
            await this.db.meta.delete(CURSOR_KEY) // a corrupt cursor must never wedge sync forever
            throw new SyncError('server', 'cursor reset')
          }
          throw e
        }

        const sentById = new Map(batch.map((n) => [n.id, n] as const))
        const byMutation = new Map(batch.map((n) => [n.mutationId, n] as const))
        for (const r of res.results) {
          const n = byMutation.get(r.mutation_id)
          if (!n) continue
          const fx = await applyMutationResult(this.db, { id: n.id, localRev: n.localRev, fields: fieldsOf(n) }, r)
          summary.copies += fx.copies
          summary.restored += fx.restored
          if (r.status !== 'rejected') summary.pushed++
        }
        for (const id of sentById.keys()) attempted.add(id)

        summary.pulled += await applyServerChanges(this.db, res.changes)
        since = res.cursor
        // Only a cursor taken from a row that was really returned may be stored. With no changes the server echoes the
        // (deliberately overlapped) cursor we sent; storing that would walk the cursor backwards on every idle sync.
        if (res.changes.length > 0 && res.cursor) lastCursor = res.cursor
        hasMore = res.has_more || (await this.hasCandidates(attempted))
      }

      if (lastCursor) await this.db.meta.put({ key: CURSOR_KEY, value: lastCursor })
      this.retryDelay = 0
      this.set({ syncing: false, lastError: null, lastSyncedAt: this.o.now(), online: true,
                 notice: summary.copies + summary.restored > 0 ? { id: ++this.noticeSeq, copies: summary.copies, restored: summary.restored } : this.status.notice })
      if (deferUntil !== null) this.scheduleDeferred(deferUntil)
    } catch (e) {
      const kind: SyncErrorKind = e instanceof SyncError ? e.kind : 'server'
      summary.error = kind
      this.set({ syncing: false, lastError: kind, online: kind === 'network' ? false : this.status.online })
      if (this.started && (kind === 'network' || kind === 'server')) this.scheduleRetry()
    }
    return summary
  }

  /** One request, with isolation: if the server rejects the whole payload as malformed, resend one note at a time so a single bad note cannot block the queue. */
  private async send(req: SyncRequest): Promise<SyncResponse> {
    try {
      return await this.o.transport(req)
    } catch (e) {
      if (!(e instanceof SyncError) || e.kind !== 'bad_request' || req.mutations.length === 0) throw e
      const results: MutationResult[] = []
      for (const m of req.mutations) {
        try {
          const r = await this.o.transport({ mutations: [m], cursor: req.cursor, limit: 1 })
          results.push(...r.results)
        } catch (e2) {
          if (e2 instanceof SyncError && e2.kind === 'bad_request') results.push({ mutation_id: m.mutation_id, status: 'rejected', error: 'invalid' })
          else throw e2
        }
      }
      return { results, changes: [], cursor: req.cursor, has_more: true, server_time: new Date().toISOString() }
    }
  }

  private async dirtyNotes(): Promise<LocalNote[]> {
    return this.db.notes.where('dirty').equals(1).toArray()
  }

  private async hasCandidates(attempted: Set<string>): Promise<boolean> {
    const { batch } = await this.collectBatch(attempted)
    return batch.length > 0
  }

  /** Which dirty notes are ready to send right now. Also drops never-synced deletes locally (nothing to tell the server). */
  private async collectBatch(attempted: Set<string>): Promise<{ batch: LocalNote[]; deferAt: number | null }> {
    const now = this.o.now()
    const batch: LocalNote[] = []
    let deferAt: number | null = null
    const dirty = (await this.dirtyNotes()).sort((a, b) => a.updatedAt - b.updatedAt)
    for (const n of dirty) {
      if (attempted.has(n.id)) continue
      if (n.syncError && n.errorRev === n.localRev) continue // rejected; waits for the user to edit it
      if (n.deleted) {
        const releaseAt = n.updatedAt + this.o.undoWindowMs
        if (now < releaseAt) { deferAt = deferAt === null ? releaseAt : Math.min(deferAt, releaseAt); continue } // still undo-able
        if (n.base === null) {
          // never reached the server: forget it, but only if nothing changed meanwhile
          await this.db.transaction('rw', this.db.notes, async () => {
            const again = await this.db.notes.get(n.id)
            if (again && again.localRev === n.localRev && again.deleted && again.base === null) await this.db.notes.delete(n.id)
          })
          continue
        }
      }
      if (n.base === null && isBlank(n) && !n.deleted) continue // an empty draft is not worth a server row; it is sent once it has content
      batch.push(n)
      if (batch.length >= this.o.batchSize) break
    }
    return { batch, deferAt }
  }

  private scheduleRetry() {
    this.retryDelay = Math.min(60_000, Math.max(2_000, this.retryDelay * 2))
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = setTimeout(() => { this.retryTimer = null; void this.syncNow() }, this.retryDelay)
  }

  private scheduleDeferred(at: number) {
    if (this.deferTimer) clearTimeout(this.deferTimer)
    this.deferTimer = setTimeout(() => { this.deferTimer = null; void this.syncNow() }, Math.max(50, at - this.o.now() + 50))
  }
}
