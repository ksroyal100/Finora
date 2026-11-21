// Shared by the browser (Dexie store + sync engine) and the API route. Keep this file free of
// DOM / React / server-only imports.

export const NOTE_COLORS = ['default', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'gray'] as const
export type NoteColor = (typeof NOTE_COLORS)[number]

/** The user-editable fields. Each one is versioned separately on the server so edits to different fields merge. */
export const NOTE_FIELDS = ['title', 'content', 'color', 'labels', 'pinned', 'archived', 'deleted'] as const
export type NoteField = (typeof NOTE_FIELDS)[number]

// Must match the CHECK constraints / validation in supabase/migrations/018_notes.sql
export const NOTE_LIMITS = { title: 500, content: 100_000, label: 40, labels: 20 } as const

export interface NoteFields {
  title: string
  content: string
  color: NoteColor
  labels: string[]
  pinned: boolean
  archived: boolean
  deleted: boolean
}

/** A note as the server returns it. */
export interface ServerNote extends NoteFields {
  id: string
  version: number
  created_at: string
  updated_at: string
}

/** One queued change. `note` is the full current value; only the `dirty` fields are applied on a merge. */
export interface SyncMutation {
  mutation_id: string
  id: string
  base_version: number // 0 = the server has never seen this note
  dirty: NoteField[]
  note: NoteFields
  copy_id?: string // id to use if a conflict copy has to be created (makes retries idempotent)
  client_updated_at?: number // ms since epoch, client clock (used only to order concurrent flag toggles)
}

export type MutationStatus = 'applied' | 'conflict' | 'duplicate' | 'rejected'

export interface MutationResult {
  mutation_id: string
  status: MutationStatus
  note?: ServerNote | null
  copy?: ServerNote | null
  conflicts?: NoteField[]
  restored?: boolean
  error?: string
}

export interface SyncCursor {
  ts: string // exact server timestamp (microsecond precision) - never round-trip through Date
  id: string
}

export interface SyncRequest {
  mutations: SyncMutation[]
  cursor: SyncCursor | null
  limit?: number
}

export interface SyncResponse {
  results: MutationResult[]
  changes: ServerNote[]
  cursor: SyncCursor | null
  has_more: boolean
  server_time: string
}

export const EMPTY_FIELDS: NoteFields = {
  title: '', content: '', color: 'default', labels: [], pinned: false, archived: false, deleted: false,
}
