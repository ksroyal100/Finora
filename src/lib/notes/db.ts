import Dexie, { type DexieOptions, type Table } from 'dexie'
import type { NoteFields } from './types'

/**
 * A note as stored in the browser. The server never sees the bookkeeping fields.
 *
 *  - `base` is the server's version of the fields at `serverVersion` (null until the server has seen the note).
 *    "What changed locally" is ALWAYS computed as diff(local, base), so it can never drift out of sync.
 *  - `dirty` (0/1, indexable) is true while local fields differ from `base`.
 *  - `mutationId`/`copyId` are regenerated on every local edit; a retried push re-sends the same ids, which the
 *    server de-duplicates, but a changed payload always gets new ids.
 */
export interface LocalNote extends NoteFields {
  id: string
  createdAt: number
  updatedAt: number
  serverVersion: number
  base: NoteFields | null
  dirty: 0 | 1
  localRev: number
  mutationId: string
  copyId: string
  /** Set when the server permanently rejected this note; sync of THIS note pauses until the user edits it again. */
  syncError: string | null
  errorRev: number
}

export interface MetaRow { key: string; value: unknown }

export class NotesDB extends Dexie {
  notes!: Table<LocalNote, string>
  meta!: Table<MetaRow, string>

  constructor(name: string, options?: DexieOptions) {
    super(name, options)
    // Only indexed fields are listed. Booleans are not valid IndexedDB keys, hence the numeric `dirty`.
    this.version(1).stores({ notes: 'id, updatedAt, dirty', meta: 'key' })
  }
}

/** One database per signed-in user: another account on the same browser can never see these notes. */
export const dbNameFor = (userId: string) => `finora-notes:${userId}`
