import { describe, it, expect, vi, afterEach } from 'vitest'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { NotesDB, type LocalNote } from '@/lib/notes/db'
import { createNote, updateNote, deleteNote, restoreNote, discardIfBlankDraft, pendingCount, setPinned } from '@/lib/notes/store'
import { searchNotes, sortNotes, collectLabels } from '@/lib/notes/search'
import { sanitizeLabels, diffFields, normalizeFields } from '@/lib/notes/fields'
import {
  SyncEngine, SyncError, applyMutationResult, applyServerChanges, buildMutation, createHttpTransport, deriveSyncLabel, type SyncTransport,
} from '@/lib/notes/sync'
import type { MutationResult, NoteFields, ServerNote, SyncRequest, SyncResponse } from '@/lib/notes/types'
import { NOTE_LIMITS } from '@/lib/notes/types'

// ── helpers ──────────────────────────────────────────────────
let n = 0
function openDb(factory = new IDBFactory(), name = `t${n++}`) {
  const open = () => new NotesDB(name, { indexedDB: factory, IDBKeyRange })
  return { db: open(), reopen: open, factory, name }
}
const server = (over: Partial<ServerNote> & { id: string }): ServerNote => ({
  title: '', content: '', color: 'default', labels: [], pinned: false, archived: false, deleted: false,
  version: 1, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z', ...over,
})
const fieldsOfServer = (s: ServerNote): NoteFields => ({ title: s.title, content: s.content, color: s.color, labels: s.labels, pinned: s.pinned, archived: s.archived, deleted: s.deleted })

/** Marks a local note as already synced at a given server state (what the engine does after a successful push). */
async function markSynced(db: NotesDB, id: string, s: ServerNote) {
  const cur = (await db.notes.get(id))!
  await db.notes.put({ ...cur, ...fieldsOfServer(s), serverVersion: s.version, base: fieldsOfServer(s), dirty: 0 })
}

/** A tiny in-memory server that simply applies every mutation (the real merge logic is tested in SQL + the integration run). */
function fakeServer() {
  const notes = new Map<string, ServerNote>()
  const requests: SyncRequest[] = []
  let seq = 0
  const transport: SyncTransport = async (req) => {
    requests.push(JSON.parse(JSON.stringify(req)))
    if (req.mutations.some((m) => m.note.title === 'BAD') && req.mutations.length > 1) throw new SyncError('bad_request')
    const results: MutationResult[] = req.mutations.map((m) => {
      if (m.note.title === 'BAD') throw new SyncError('bad_request')
      const cur = notes.get(m.id)
      if (m.note.deleted && !cur) return { mutation_id: m.mutation_id, status: 'applied' }
      const ts = new Date(1_700_000_000_000 + ++seq * 1000).toISOString()
      const note: ServerNote = { ...m.note, id: m.id, version: (cur?.version ?? 0) + 1, created_at: cur?.created_at ?? ts, updated_at: ts }
      notes.set(m.id, note)
      return { mutation_id: m.mutation_id, status: 'applied', note }
    })
    const all = [...notes.values()].sort((a, b) => (a.updated_at + a.id).localeCompare(b.updated_at + b.id))
      .filter((x) => !req.cursor || x.updated_at + x.id > req.cursor.ts + req.cursor.id)
    const limit = req.limit ?? 200
    const changes = all.slice(0, limit)
    const last = changes[changes.length - 1]
    const res: SyncResponse = { results, changes, cursor: last ? { ts: last.updated_at, id: last.id } : req.cursor, has_more: all.length > limit, server_time: new Date().toISOString() }
    return res
  }
  return { notes, requests, transport }
}

const mkEngine = (db: NotesDB, transport: SyncTransport, over: Partial<ConstructorParameters<typeof SyncEngine>[1]> = {}) =>
  new SyncEngine(db, { transport, isOnline: () => true, undoWindowMs: 0, overlapMs: 1000, attachWindowListeners: false, ...over })

// ── local store ──────────────────────────────────────────────
describe('local store (IndexedDB)', () => {
  it('persists across a refresh: data is still there when the database is reopened', async () => {
    const { db, reopen } = openDb()
    const note = await createNote(db, { title: 'Groceries', content: 'milk\neggs' })
    await updateNote(db, note.id, { pinned: true })
    db.close()
    const after = await reopen().notes.get(note.id)
    expect(after).toMatchObject({ title: 'Groceries', content: 'milk\neggs', pinned: true, dirty: 1 })
  })

  it('stores pending changes without any network involved', async () => {
    const { db } = openDb()
    const a = await createNote(db, { title: 'a' })
    await updateNote(db, a.id, { content: 'offline edit' })
    expect(await pendingCount(db)).toBe(1)
    expect((await db.notes.get(a.id))!.content).toBe('offline edit')
  })

  it('a no-op edit changes nothing; a real edit bumps the revision and mints new mutation ids', async () => {
    const { db } = openDb()
    const a = await createNote(db, { title: 'x' })
    const same = await updateNote(db, a.id, { title: 'x' })
    expect(same!.localRev).toBe(a.localRev)
    const edited = await updateNote(db, a.id, { title: 'y' })
    expect(edited!.localRev).toBe(a.localRev + 1)
    expect(edited!.mutationId).not.toBe(a.mutationId)
    expect(edited!.copyId).not.toBe(a.copyId)
  })

  it('editing a synced note back to its server value makes it clean again (nothing to push)', async () => {
    const { db } = openDb()
    const a = await createNote(db, { title: 'orig' })
    await markSynced(db, a.id, server({ id: a.id, title: 'orig' }))
    await updateNote(db, a.id, { title: 'changed' })
    expect((await db.notes.get(a.id))!.dirty).toBe(1)
    await updateNote(db, a.id, { title: 'orig' })
    expect((await db.notes.get(a.id))!.dirty).toBe(0)
  })

  it('delete hides the note and restore (undo) brings it back with no net change', async () => {
    const { db } = openDb()
    const a = await createNote(db, { title: 'x' })
    await markSynced(db, a.id, server({ id: a.id, title: 'x' }))
    await deleteNote(db, a.id)
    expect((await db.notes.get(a.id))!.deleted).toBe(true)
    await restoreNote(db, a.id)
    const back = (await db.notes.get(a.id))!
    expect(back.deleted).toBe(false)
    expect(back.dirty).toBe(0) // undo before the delete was ever sent leaves nothing to sync
  })

  it('sanitises labels and clamps oversized input to the server limits', async () => {
    expect(sanitizeLabels([' Work ', 'work', 'Home', '', '  ', 'a'.repeat(100)])).toEqual(['Home', 'Work', 'a'.repeat(NOTE_LIMITS.label)])
    expect(sanitizeLabels(Array.from({ length: 50 }, (_, i) => `l${i}`)).length).toBe(NOTE_LIMITS.labels)
    const f = normalizeFields({ title: 't'.repeat(900), content: 'c'.repeat(200_000), color: 'neon' as never })
    expect(f.title.length).toBe(NOTE_LIMITS.title)
    expect(f.content.length).toBe(NOTE_LIMITS.content)
    expect(f.color).toBe('default')
  })

  it('discards a blank never-synced draft but never a synced note', async () => {
    const { db } = openDb()
    const blank = await createNote(db)
    expect(await discardIfBlankDraft(db, blank.id)).toBe(true)
    expect(await db.notes.get(blank.id)).toBeUndefined()
    const synced = await createNote(db, { title: 'x' })
    await markSynced(db, synced.id, server({ id: synced.id, title: 'x' }))
    await updateNote(db, synced.id, { title: '' })
    expect(await discardIfBlankDraft(db, synced.id)).toBe(false)
  })

  it('labels are compared as sets so ordering never creates phantom changes', () => {
    const a: NoteFields = { ...normalizeFields({}), labels: ['a', 'b'] }
    expect(diffFields(a, { ...a, labels: ['b', 'a'] })).toEqual([])
    expect(diffFields(a, { ...a, labels: ['a'] })).toEqual(['labels'])
  })
})

describe('search, sort, labels', () => {
  const notes = [
    { id: '1', title: 'Budget plan', content: 'Rent and groceries', labels: ['money'], pinned: false, updatedAt: 10, deleted: false },
    { id: '2', title: 'Trip', content: 'Book flights to Lisbon', labels: ['travel', 'Money'], pinned: true, updatedAt: 5, deleted: false },
    { id: '3', title: 'Old', content: 'groceries list', labels: [], pinned: false, updatedAt: 1, deleted: false },
  ]
  it('matches every term, case-insensitively, across title, text and labels', () => {
    expect(searchNotes(notes, 'GROCERIES').map((x) => x.id)).toEqual(['1', '3'])
    expect(searchNotes(notes, 'groceries rent').map((x) => x.id)).toEqual(['1'])
    expect(searchNotes(notes, 'travel').map((x) => x.id)).toEqual(['2'])
    expect(searchNotes(notes, 'nothing here')).toEqual([])
    expect(searchNotes(notes, '   ').length).toBe(3)
  })
  it('sorts pinned first, then newest', () => expect(sortNotes(notes).map((x) => x.id)).toEqual(['2', '1', '3']))
  it('collects labels once, ignoring deleted notes and letter case', () => {
    expect(collectLabels([...notes, { id: '4', title: '', content: '', labels: ['ghost'], pinned: false, updatedAt: 0, deleted: true }])).toEqual(['money', 'travel'])
  })
})

describe('sync status label', () => {
  it.each([
    [{ online: false, syncing: false, lastError: null, pending: 0 }, 'offline'],
    [{ online: false, syncing: true, lastError: null, pending: 3 }, 'offline'],
    [{ online: true, syncing: false, lastError: 'network', pending: 0 }, 'offline'],
    [{ online: true, syncing: true, lastError: null, pending: 2 }, 'syncing'],
    [{ online: true, syncing: false, lastError: null, pending: 2 }, 'saved'],
    [{ online: true, syncing: false, lastError: 'server', pending: 0 }, 'saved'],
    [{ online: true, syncing: false, lastError: null, pending: 0 }, 'synced'],
  ] as const)('%j -> %s', (input, expected) => expect(deriveSyncLabel({ ...input })).toBe(expected))
})

// ── folding server answers into IndexedDB ────────────────────
describe('applyMutationResult', () => {
  const snap = (n: LocalNote) => ({ id: n.id, localRev: n.localRev, fields: { title: n.title, content: n.content, color: n.color, labels: [...n.labels], pinned: n.pinned, archived: n.archived, deleted: n.deleted } })

  it('a normal success clears the pending state and records the server version', async () => {
    const { db } = openDb()
    const a = await createNote(db, { title: 'hi' })
    const S = server({ id: a.id, title: 'hi', version: 1 })
    await applyMutationResult(db, snap(a), { mutation_id: a.mutationId, status: 'applied', note: S })
    expect(await db.notes.get(a.id)).toMatchObject({ dirty: 0, serverVersion: 1 })
  })

  it('KEEPS what the user typed while the request was in flight, and still adopts untouched fields from the server', async () => {
    const { db } = openDb()
    const a = await createNote(db, { title: 'T', content: 'draft 1' })
    const pushed = snap(a)                                   // what was sent
    await updateNote(db, a.id, { content: 'draft 2 typed during sync' }) // user keeps typing
    // meanwhile another device changed the TITLE and the server merged it
    const S = server({ id: a.id, title: 'T from other device', content: 'draft 1', version: 2 })
    await applyMutationResult(db, pushed, { mutation_id: a.mutationId, status: 'applied', note: S })
    const after = (await db.notes.get(a.id))!
    expect(after.content).toBe('draft 2 typed during sync') // newer local edit survives
    expect(after.title).toBe('T from other device')          // other device's edit adopted
    expect(after.dirty).toBe(1)                              // the in-flight edit is still queued
    expect(diffFields(after, after.base!)).toEqual(['content']) // and ONLY content is considered changed, so the title is never re-sent stale
  })

  it('conflict: shows the server text and stores the user\'s own text as a separate note', async () => {
    const { db } = openDb()
    const a = await createNote(db, { content: 'mine' })
    const S = server({ id: a.id, content: 'theirs', version: 5 })
    const copy = server({ id: 'copy-1', title: 'Untitled (conflict copy)', content: 'mine', version: 1 })
    const fx = await applyMutationResult(db, snap(a), { mutation_id: a.mutationId, status: 'conflict', note: S, copy, conflicts: ['content'] })
    expect(fx.copies).toBe(1)
    expect((await db.notes.get(a.id))!.content).toBe('theirs')
    expect(await db.notes.get('copy-1')).toMatchObject({ content: 'mine', dirty: 0 })
  })

  it('conflict while the user was still typing: both texts are kept', async () => {
    const { db } = openDb()
    const a = await createNote(db, { content: 'mine' })
    const pushed = snap(a)
    await updateNote(db, a.id, { content: 'mine, edited more' })
    const S = server({ id: a.id, content: 'theirs', version: 5 })
    await applyMutationResult(db, pushed, { mutation_id: a.mutationId, status: 'conflict', note: S, conflicts: ['content'] })
    const all = await db.notes.toArray()
    expect(all.find((x) => x.id === a.id)!.content).toBe('mine, edited more')
    expect(all.some((x) => x.content === 'theirs' && x.title.endsWith('(conflict copy)'))).toBe(true) // server text preserved locally
  })

  it('a rejected note stops retrying until it is edited, and its content is never touched', async () => {
    const { db } = openDb()
    const a = await createNote(db, { title: 'x' })
    await applyMutationResult(db, snap(a), { mutation_id: a.mutationId, status: 'rejected', error: 'invalid_mutation' })
    const rejected = (await db.notes.get(a.id))!
    expect(rejected).toMatchObject({ syncError: 'invalid_mutation', title: 'x', dirty: 1 })
    await updateNote(db, a.id, { title: 'fixed' })
    expect((await db.notes.get(a.id))!.syncError).toBeNull()
  })

  it('a note the server says is deleted is removed locally, unless the user edited it meanwhile', async () => {
    const { db } = openDb()
    const a = await createNote(db, { title: 'x' })
    await applyMutationResult(db, snap(a), { mutation_id: a.mutationId, status: 'applied', note: server({ id: a.id, deleted: true, version: 2 }) })
    expect(await db.notes.get(a.id)).toBeUndefined()

    const b = await createNote(db, { title: 'keep my edit' })
    const pushed = snap(b)
    await updateNote(db, b.id, { content: 'typed after push' })
    await applyMutationResult(db, pushed, { mutation_id: b.mutationId, status: 'applied', note: server({ id: b.id, title: 'keep my edit', deleted: true, version: 2 }) })
    const kept = (await db.notes.get(b.id))!
    expect(kept).toMatchObject({ content: 'typed after push', deleted: false, dirty: 1 }) // will be restored on the next push
  })
})

describe('applyServerChanges (pull)', () => {
  it('inserts new notes, ignores tombstones of unknown notes, overwrites clean notes, skips older versions', async () => {
    const { db } = openDb()
    const a = await createNote(db, { title: 'old' })
    await markSynced(db, a.id, server({ id: a.id, title: 'old', version: 2 }))
    await applyServerChanges(db, [
      server({ id: 'new-1', title: 'fresh', version: 1 }),
      server({ id: 'ghost', deleted: true, version: 3 }),
      server({ id: a.id, title: 'updated elsewhere', version: 3 }),
    ])
    expect((await db.notes.get('new-1'))!.title).toBe('fresh')
    expect(await db.notes.get('ghost')).toBeUndefined()
    expect((await db.notes.get(a.id))!.title).toBe('updated elsewhere')
    await applyServerChanges(db, [server({ id: a.id, title: 'STALE re-delivery', version: 2 })])
    expect((await db.notes.get(a.id))!.title).toBe('updated elsewhere')
  })

  it('NEVER overwrites a note that has unsynced local edits', async () => {
    const { db } = openDb()
    const a = await createNote(db, { title: 'base' })
    await markSynced(db, a.id, server({ id: a.id, title: 'base', version: 1 }))
    await updateNote(db, a.id, { title: 'my unsynced edit' })
    await applyServerChanges(db, [server({ id: a.id, title: 'remote edit', version: 2 })])
    expect((await db.notes.get(a.id))!.title).toBe('my unsynced edit')
  })

  it('a remote delete removes a clean local note', async () => {
    const { db } = openDb()
    const a = await createNote(db, { title: 'x' })
    await markSynced(db, a.id, server({ id: a.id, title: 'x', version: 1 }))
    await applyServerChanges(db, [server({ id: a.id, deleted: true, version: 2 })])
    expect(await db.notes.get(a.id)).toBeUndefined()
  })
})

// ── the engine ───────────────────────────────────────────────
describe('SyncEngine', () => {
  it('OFFLINE: nothing is sent, edits stay queued locally, and they sync once the connection returns', async () => {
    const { db } = openDb()
    const srv = fakeServer()
    let online = false
    const engine = mkEngine(db, srv.transport, { isOnline: () => online })
    const a = await createNote(db, { title: 'written offline' })
    await updateNote(db, a.id, { content: 'more offline text' })

    const offlineRun = await engine.syncNow()
    expect(srv.requests.length).toBe(0)
    expect(engine.getStatus().online).toBe(false)
    expect(deriveSyncLabel({ ...engine.getStatus(), pending: await pendingCount(db) })).toBe('offline')
    expect(offlineRun.pushed).toBe(0)
    expect((await db.notes.get(a.id))!.content).toBe('more offline text') // still readable and intact

    online = true
    const run = await engine.syncNow()
    expect(run.pushed).toBe(1)
    expect(srv.notes.get(a.id)).toMatchObject({ title: 'written offline', content: 'more offline text' })
    expect(await pendingCount(db)).toBe(0)
    expect(deriveSyncLabel({ ...engine.getStatus(), pending: 0 })).toBe('synced')
  })

  it('coalesces many offline edits of one note into a single mutation carrying the latest values', async () => {
    const { db } = openDb()
    const srv = fakeServer()
    const engine = mkEngine(db, srv.transport)
    const a = await createNote(db, { title: 'v1' })
    for (let i = 2; i <= 20; i++) await updateNote(db, a.id, { title: `v${i}` })
    await engine.syncNow()
    expect(srv.requests[0].mutations.length).toBe(1)
    expect(srv.requests[0].mutations[0].note.title).toBe('v20')
  })

  it('a network failure loses nothing: notes stay queued, status shows offline, the next run succeeds', async () => {
    const { db } = openDb()
    const srv = fakeServer()
    let fail = true
    const engine = mkEngine(db, async (req) => { if (fail) throw new SyncError('network'); return srv.transport(req) })
    const a = await createNote(db, { title: 'precious' })
    const r1 = await engine.syncNow()
    expect(r1.error).toBe('network')
    expect(deriveSyncLabel({ ...engine.getStatus(), pending: await pendingCount(db) })).toBe('offline')
    expect((await db.notes.get(a.id))!).toMatchObject({ title: 'precious', dirty: 1 })
    fail = false
    expect((await engine.syncNow()).error).toBeNull()
    expect(srv.notes.get(a.id)!.title).toBe('precious')
  })

  it('an auth failure is reported and not hammered', async () => {
    const { db } = openDb()
    let calls = 0
    const engine = mkEngine(db, async () => { calls++; throw new SyncError('auth') })
    await createNote(db, { title: 'x' })
    const r = await engine.syncNow()
    expect(r.error).toBe('auth')
    expect(calls).toBe(1)
    expect(engine.getStatus().lastError).toBe('auth')
  })

  it('the stored cursor never walks backwards when a sync returns no rows (e.g. the newest row was purged server-side)', async () => {
    const { db } = openDb()
    const srv = fakeServer()
    const engine = mkEngine(db, srv.transport, { overlapMs: 60_000 })
    await createNote(db, { title: 'x' })
    await engine.syncNow()
    const c1 = (await db.meta.get('cursor'))!.value as { ts: string }
    srv.notes.clear() // nothing for the server to return any more
    for (let i = 0; i < 5; i++) await engine.syncNow()
    const c2 = (await db.meta.get('cursor'))!.value as { ts: string }
    expect(c2.ts).toBe(c1.ts) // the overlap is applied to each REQUEST, never accumulated into the stored cursor
  })

  it('pulls other devices\' notes, including multiple pages', async () => {
    const { db } = openDb()
    const srv = fakeServer()
    for (let i = 0; i < 7; i++) srv.notes.set(`n${i}`, server({ id: `n${i}`, title: `remote ${i}`, updated_at: new Date(1_700_000_000_000 + i * 1000).toISOString() }))
    const engine = mkEngine(db, (req) => srv.transport({ ...req, limit: 3 }))
    await engine.syncNow()
    expect((await db.notes.toArray()).map((x) => x.title).sort()).toEqual(Array.from({ length: 7 }, (_, i) => `remote ${i}`))
  })

  it('one malformed note cannot block the rest of the queue', async () => {
    const { db } = openDb()
    const srv = fakeServer()
    const engine = mkEngine(db, srv.transport)
    const good1 = await createNote(db, { title: 'good 1' })
    const bad = await createNote(db, { title: 'BAD' })
    const good2 = await createNote(db, { title: 'good 2' })
    await engine.syncNow()
    expect(srv.notes.has(good1.id) && srv.notes.has(good2.id)).toBe(true)
    expect(srv.notes.has(bad.id)).toBe(false)
    expect((await db.notes.get(bad.id))!.syncError).toBe('invalid')
    // and it is not retried in a loop...
    const before = srv.requests.length
    await engine.syncNow()
    expect(srv.requests.slice(before).every((r) => r.mutations.length === 0)).toBe(true)
    // ...until the user edits it
    await updateNote(db, bad.id, { title: 'fixed' })
    await engine.syncNow()
    expect(srv.notes.get(bad.id)!.title).toBe('fixed')
  })

  it('single-flight: concurrent requests share one run, and an edit made during the run is picked up right after', async () => {
    const { db } = openDb()
    const srv = fakeServer()
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    let first = true
    const engine = mkEngine(db, async (req) => { if (first) { first = false; await gate }; return srv.transport(req) })
    const a = await createNote(db, { title: 'one' })
    const p1 = engine.syncNow()
    const p2 = engine.syncNow()
    expect(p2).toBe(p1)
    await updateNote(db, a.id, { content: 'typed while syncing' })
    release()
    await p1
    expect(srv.notes.get(a.id)!.content).toBe('typed while syncing')
    expect(await pendingCount(db)).toBe(0)
  })

  it('delete has an undo window: nothing is sent while it is open, and Undo means the server never hears of it', async () => {
    const { db } = openDb()
    const srv = fakeServer()
    let now = 1_000_000
    const engine = mkEngine(db, srv.transport, { undoWindowMs: 7_000, now: () => now })
    const a = await createNote(db, { title: 'keep?' }, now)
    await engine.syncNow()
    expect(srv.notes.get(a.id)!.deleted).toBe(false)

    await deleteNote(db, a.id, now)
    const before = srv.requests.length
    now += 3_000
    await engine.syncNow()
    expect(srv.requests.slice(before).every((r) => r.mutations.length === 0)).toBe(true) // still undo-able
    await restoreNote(db, a.id, now)
    now += 10_000
    await engine.syncNow()
    expect(srv.notes.get(a.id)!.deleted).toBe(false) // undo worked end-to-end
    expect((await db.notes.get(a.id))!.deleted).toBe(false)

    await deleteNote(db, a.id, now)
    now += 8_000
    await engine.syncNow()
    expect(srv.notes.get(a.id)!.deleted).toBe(true)  // after the window the delete is real
    expect(await db.notes.get(a.id)).toBeUndefined()
  })

  it('a note created and deleted offline never touches the network', async () => {
    const { db } = openDb()
    const srv = fakeServer()
    const engine = mkEngine(db, srv.transport)
    const a = await createNote(db, { title: 'fleeting' })
    await deleteNote(db, a.id)
    await engine.syncNow()
    expect(srv.requests.every((r) => r.mutations.length === 0)).toBe(true)
    expect(await db.notes.get(a.id)).toBeUndefined()
  })

  it('does not send blank drafts and does not count them as pending', async () => {
    const { db } = openDb()
    const srv = fakeServer()
    const engine = mkEngine(db, srv.transport)
    await createNote(db)
    await engine.syncNow()
    expect(srv.requests.every((r) => r.mutations.length === 0)).toBe(true)
    expect(await pendingCount(db)).toBe(0)
  })

  it('raises a notice when a conflict copy is created', async () => {
    const { db } = openDb()
    const a = await createNote(db, { content: 'mine' })
    const engine = mkEngine(db, async (req) => ({
      results: req.mutations.map((m): MutationResult => ({
        mutation_id: m.mutation_id, status: 'conflict', conflicts: ['content'],
        note: server({ id: m.id, content: 'theirs', version: 4 }),
        copy: server({ id: 'copy-x', title: 'Untitled (conflict copy)', content: 'mine' }),
      })),
      changes: [], cursor: null, has_more: false, server_time: new Date().toISOString(),
    }))
    await engine.syncNow()
    expect(engine.getStatus().notice).toMatchObject({ copies: 1 })
    engine.dismissNotice()
    expect(engine.getStatus().notice).toBeNull()
    expect(a.id).toBeTruthy()
  })

  it('buildMutation sends only the changed fields as dirty, plus the full note', async () => {
    const { db } = openDb()
    const a = await createNote(db, { title: 'x', content: 'y' })
    await markSynced(db, a.id, server({ id: a.id, title: 'x', content: 'y', version: 3 }))
    await setPinned(db, a.id, true)
    const m = buildMutation((await db.notes.get(a.id))!)
    expect(m).toMatchObject({ base_version: 3, dirty: ['pinned'], note: { title: 'x', content: 'y', pinned: true } })
  })
})

describe('HTTP transport', () => {
  const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 })
  const req: SyncRequest = { mutations: [], cursor: null }
  it.each([[401, 'auth'], [403, 'auth'], [400, 'bad_request'], [413, 'bad_request'], [500, 'server'], [503, 'server'], [429, 'server']] as const)(
    'maps HTTP %i to %s', async (status, kind) => {
      const t = createHttpTransport({ fetchImpl: (async () => new Response('{}', { status })) as typeof fetch })
      await expect(t(req)).rejects.toMatchObject({ kind })
    })
  it('maps a thrown fetch to network, and bad bodies to server', async () => {
    await expect(createHttpTransport({ fetchImpl: (async () => { throw new TypeError('x') }) as typeof fetch })(req)).rejects.toMatchObject({ kind: 'network' })
    await expect(createHttpTransport({ fetchImpl: (async () => new Response('not json', { status: 200 })) as typeof fetch })(req)).rejects.toMatchObject({ kind: 'server' })
  })
  it('posts to /api/notes/sync with the given headers and returns the data', async () => {
    let seen: { url: string; init: RequestInit } | undefined
    const t = createHttpTransport({ baseUrl: 'https://x.test', headers: { Authorization: 'Bearer t' }, fetchImpl: (async (url: string, init: RequestInit) => { seen = { url, init }; return ok({ results: [], changes: [], cursor: null, has_more: false, server_time: 'now' }) }) as unknown as typeof fetch })
    expect((await t(req)).has_more).toBe(false)
    expect(seen!.url).toBe('https://x.test/api/notes/sync')
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe('Bearer t')
    expect(seen!.init.method).toBe('POST')
  })
})

describe('SyncEngine request throttling (protects the shared API rate limit)', () => {
  afterEach(() => vi.useRealTimers())

  it('spaces out AUTOMATIC syncs (edits) but never delays reconnect / tab-visible syncs', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { db } = openDb()
    const srv = fakeServer()
    let now = 1_000_000
    const engine = mkEngine(db, srv.transport, { now: () => now, debounceMs: 100, minIntervalMs: 4000 })
    await engine.syncNow()                       // a run starts at t = 1,000,000
    const before = srv.requests.length

    now += 500                                   // user edits 0.5 s later...
    engine.requestSync('edit')                   // ...an automatic sync must wait until 4 s after the last run started
    await vi.advanceTimersByTimeAsync(3000)
    expect(srv.requests.length).toBe(before)     // still waiting: no request yet
    now += 3000
    await vi.advanceTimersByTimeAsync(600)
    await vi.waitFor(() => expect(srv.requests.length).toBe(before + 1)) // ...then exactly one request goes out

    now += 100
    engine.requestSync('online', 0)              // reconnecting is never throttled
    await vi.advanceTimersByTimeAsync(0)
    await vi.waitFor(() => expect(srv.requests.length).toBe(before + 2))
  })

  it('collapses a burst of edits into a single sync', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { db } = openDb()
    const srv = fakeServer()
    let now = 5_000_000
    const engine = mkEngine(db, srv.transport, { now: () => now, debounceMs: 100, minIntervalMs: 4000 })
    await engine.syncNow()
    const before = srv.requests.length
    for (let i = 0; i < 40; i++) { now += 50; engine.requestSync('edit') }
    await vi.advanceTimersByTimeAsync(10_000)
    await vi.waitFor(() => expect(srv.requests.length - before).toBe(1))
    await new Promise((r) => setImmediate(r)); await vi.advanceTimersByTimeAsync(5_000) // give any (wrong) extra request time to appear
    expect(srv.requests.length - before).toBe(1)
  })
})
