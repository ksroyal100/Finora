import { v4 as uuid } from 'uuid'
import type { NotesDB, LocalNote } from './db'
import { EMPTY_FIELDS, type NoteFields } from './types'
import { diffFields, fieldsOf, isBlank, normalizeFields } from './fields'

const isDirty = (n: NoteFields & { base: NoteFields | null }): 0 | 1 => (n.base === null || diffFields(n, n.base).length > 0 ? 1 : 0)

/** Local writes. Every one is a single IndexedDB transaction, never waits on the network, and survives a refresh. */
export async function createNote(db: NotesDB, init: Partial<NoteFields> = {}, now: number = Date.now()): Promise<LocalNote> {
  const fields = normalizeFields({ ...EMPTY_FIELDS, ...init, deleted: false })
  const note: LocalNote = {
    ...fields,
    id: uuid(), createdAt: now, updatedAt: now,
    serverVersion: 0, base: null, dirty: 1, localRev: 1,
    mutationId: uuid(), copyId: uuid(), syncError: null, errorRev: 0,
  }
  await db.notes.add(note)
  return note
}

/** Applies a patch; a no-op patch changes nothing (no rev bump, no re-sync). Returns the stored note. */
export async function updateNote(db: NotesDB, id: string, patch: Partial<NoteFields>, now: number = Date.now()): Promise<LocalNote | undefined> {
  return db.transaction('rw', db.notes, async () => {
    const cur = await db.notes.get(id)
    if (!cur) return undefined
    const next = normalizeFields({ ...fieldsOf(cur), ...patch })
    if (diffFields(cur, next).length === 0) return cur
    const updated: LocalNote = {
      ...cur, ...next,
      updatedAt: now,
      localRev: cur.localRev + 1,
      mutationId: uuid(), copyId: uuid(),
      syncError: null, errorRev: 0, // an edit gives a rejected note a fresh chance
      dirty: 1,
    }
    updated.dirty = isDirty(updated)
    await db.notes.put(updated)
    return updated
  })
}

export const setPinned = (db: NotesDB, id: string, pinned: boolean) => updateNote(db, id, { pinned })
export const setArchived = (db: NotesDB, id: string, archived: boolean) => updateNote(db, id, { archived })
export const setColor = (db: NotesDB, id: string, color: NoteFields['color']) => updateNote(db, id, { color })
export const setLabels = (db: NotesDB, id: string, labels: string[]) => updateNote(db, id, { labels })

/** Delete = hide immediately; the sync engine waits out the undo window before telling the server. */
export const deleteNote = (db: NotesDB, id: string, now?: number) => updateNote(db, id, { deleted: true }, now)
export const restoreNote = (db: NotesDB, id: string, now?: number) => updateNote(db, id, { deleted: false }, now)

/** Remove a note that never reached the server (e.g. an empty draft). Notes the server knows are soft-deleted instead. */
export async function discardIfBlankDraft(db: NotesDB, id: string): Promise<boolean> {
  return db.transaction('rw', db.notes, async () => {
    const cur = await db.notes.get(id)
    if (!cur || !isBlank(cur)) return false
    if (cur.base === null) { await db.notes.delete(id); return true }
    return false
  })
}

/** Notes with local changes the server has not confirmed. A blank, never-synced draft is not counted (it is never sent). */
export async function pendingCount(db: NotesDB): Promise<number> {
  const dirty = await db.notes.where('dirty').equals(1).toArray()
  return dirty.filter((n) => !(n.base === null && !n.deleted && isBlank(n))).length
}
