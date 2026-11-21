import Dexie from 'dexie'
import { NotesDB, dbNameFor } from './db'
import { SyncEngine, createHttpTransport } from './sync'
import { pendingCount } from './store'

export interface NotesRuntime { userId: string; db: NotesDB; engine: SyncEngine }

const runtimes = new Map<string, NotesRuntime>()

/** Only one tab syncs at a time (the others still see every change instantly through IndexedDB). */
function lockWrapper(userId: string) {
  return async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined
    if (!locks?.request) return fn()
    return locks.request(`finora-notes-sync:${userId}`, { ifAvailable: true }, async (lock) => (lock ? fn() : undefined))
  }
}

/** One database + engine per signed-in user, created lazily in the browser. */
export function getNotesRuntime(userId: string): NotesRuntime {
  const existing = runtimes.get(userId)
  if (existing) return existing
  const db = new NotesDB(dbNameFor(userId))
  const engine = new SyncEngine(db, { transport: createHttpTransport(), withLock: lockWrapper(userId) })
  const runtime = { userId, db, engine }
  runtimes.set(userId, runtime)
  return runtime
}

export function releaseNotesRuntime(userId: string): void {
  const rt = runtimes.get(userId)
  if (!rt) return
  rt.engine.stop()
  rt.db.close()
  runtimes.delete(userId)
}

// ── offline shell cache (see public/finora-notes-sw.js) ──────
export const OFFLINE_CACHE_PREFIX = 'finora-notes-'

export async function clearOfflineCaches(): Promise<void> {
  if (typeof caches === 'undefined') return
  const keys = await caches.keys()
  await Promise.all(keys.filter((k) => k.startsWith(OFFLINE_CACHE_PREFIX)).map((k) => caches.delete(k)))
}

/** Remove this user's notes from this browser (account deletion, or sign-out with nothing left to sync). */
export async function wipeNotesLocalData(userId: string): Promise<void> {
  releaseNotesRuntime(userId)
  await Dexie.delete(dbNameFor(userId))
  await clearOfflineCaches()
}

/**
 * Call before signing out. Best effort: push anything still queued, then remove the local copy so the next person
 * using this browser cannot read it. If some changes could NOT be synced (e.g. offline), the copy is KEPT, because
 * deleting it would destroy the user's unsaved work; it stays in that user's private database and syncs at their
 * next sign-in.
 */
export async function prepareNotesForSignOut(userId: string, timeoutMs = 4000): Promise<{ wiped: boolean; pending: number }> {
  try {
    const rt = getNotesRuntime(userId)
    await Promise.race([rt.engine.syncNow(), new Promise((r) => setTimeout(r, timeoutMs))])
    const pending = await pendingCount(rt.db)
    await clearOfflineCaches()
    if (pending === 0) { await wipeNotesLocalData(userId); return { wiped: true, pending: 0 } }
    releaseNotesRuntime(userId)
    return { wiped: false, pending }
  } catch {
    return { wiped: false, pending: -1 } // never block a sign-out because of notes
  }
}
