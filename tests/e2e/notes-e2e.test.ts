/**
 * End-to-end: simulated browsers (real Dexie code on fake-indexeddb) -> real HTTP -> the Next.js API route -> Postgres.
 * Skipped unless NOTES_E2E_URL is set. It needs a running Finora Main, a database with migrations 001-018, and an auth
 * gateway that accepts the test tokens "tok-u<N>" (users N = 1..30 must exist in auth.users + profiles).
 * See docs/NOTES_FEATURE.md ("How this was verified") and scripts/notes-e2e/ for the harness.
 */
import { describe, it, expect } from 'vitest'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { NotesDB } from '@/lib/notes/db'
import { createNote, updateNote, deleteNote } from '@/lib/notes/store'
import { SyncEngine, SyncError, createHttpTransport, deriveSyncLabel, type SyncTransport } from '@/lib/notes/sync'
import { pendingCount } from '@/lib/notes/store'
import type { ServerNote, SyncMutation } from '@/lib/notes/types'
import { v4 as uuid } from 'uuid'

const URL_ = process.env.NOTES_E2E_URL
const run = describe.skipIf(!URL_)

let seq = 0
// Each simulated device/client gets its own client IP (like real users on different networks), because the API's
// rate limiter is per IP and this suite deliberately sends far more traffic than any real user would.
let ipSeq = 1
const http = (user: string): SyncTransport => createHttpTransport({
  baseUrl: URL_!,
  headers: { Authorization: `Bearer tok-${user}`, 'x-forwarded-for': `10.${Math.floor(ipSeq / 250)}.${ipSeq++ % 250}.7` },
})

class Device {
  online = true
  hook?: (req: Parameters<SyncTransport>[0], real: SyncTransport) => ReturnType<SyncTransport>
  readonly db: NotesDB
  readonly engine: SyncEngine
  constructor(user: string, token = user) {
    this.db = new NotesDB(`e2e-${seq++}`, { indexedDB: new IDBFactory(), IDBKeyRange })
    const real = http(token)
    this.engine = new SyncEngine(this.db, {
      transport: (req) => (this.hook ? this.hook(req, real) : real(req)),
      isOnline: () => this.online,
      undoWindowMs: 0, overlapMs: 500, attachWindowListeners: false,
    })
  }
  sync() { return this.engine.syncNow() }
  async note(id: string) { return this.db.notes.get(id) }
}

async function serverAll(user: string): Promise<ServerNote[]> {
  const t = http(user)
  const out: ServerNote[] = []
  let cursor = null as Awaited<ReturnType<SyncTransport>>['cursor']
  for (let i = 0; i < 50; i++) {
    const r = await t({ mutations: [], cursor, limit: 100 })
    out.push(...r.changes)
    if (!r.has_more) break
    cursor = r.cursor
  }
  return out
}
const live = (all: ServerNote[]) => all.filter((n) => !n.deleted)

/** A note that both devices already have, in sync. */
async function sharedNote(user: string, fields: { title?: string; content?: string } = { title: 'T', content: 'c0' }) {
  const A = new Device(user), B = new Device(user)
  const n = await createNote(A.db, fields)
  await A.sync(); await B.sync()
  return { A, B, id: n.id }
}

run('notes sync end-to-end (real HTTP + API route + Postgres)', () => {
  it('a note created on one device appears on another', async () => {
    const A = new Device('u1'), B = new Device('u1')
    const n = await createNote(A.db, { title: 'Hello', content: 'from A' })
    await A.sync()
    expect(live(await serverAll('u1')).find((x) => x.id === n.id)).toMatchObject({ title: 'Hello', content: 'from A', version: 1 })
    await B.sync()
    expect(await B.note(n.id)).toMatchObject({ title: 'Hello', content: 'from A', dirty: 0, serverVersion: 1 })
  })

  it('OFFLINE: edits are queued locally, nothing reaches the server, then everything syncs when online returns', async () => {
    const A = new Device('u2'), B = new Device('u2')
    A.online = false
    const n = await createNote(A.db, { title: 'offline' })
    await updateNote(A.db, n.id, { content: 'edit 1' })
    await updateNote(A.db, n.id, { content: 'edit 2', pinned: true })
    await A.sync()
    expect(live(await serverAll('u2')).length).toBe(0)
    expect(await pendingCount(A.db)).toBe(1)
    expect(deriveSyncLabel({ ...A.engine.getStatus(), pending: 1 })).toBe('offline')

    A.online = true
    await A.sync()
    expect(live(await serverAll('u2'))[0]).toMatchObject({ title: 'offline', content: 'edit 2', pinned: true })
    expect(await pendingCount(A.db)).toBe(0)
    await B.sync()
    expect(await B.note(n.id)).toMatchObject({ content: 'edit 2', pinned: true })
  })

  it('edits to DIFFERENT fields on two devices merge cleanly, with no conflict copy', async () => {
    const { A, B, id } = await sharedNote('u3')
    A.online = false; B.online = false
    await updateNote(A.db, id, { content: 'A rewrote the body' })
    await updateNote(B.db, id, { title: 'B retitled', pinned: true })
    A.online = true; await A.sync()
    B.online = true; await B.sync()
    await A.sync()
    const all = live(await serverAll('u3'))
    expect(all.length).toBe(1)
    expect(all[0]).toMatchObject({ title: 'B retitled', content: 'A rewrote the body', pinned: true, version: 3 })
    for (const d of [A, B]) expect(await d.note(id)).toMatchObject({ title: 'B retitled', content: 'A rewrote the body', pinned: true, dirty: 0 })
  })

  it('the SAME text edited on two devices: nobody is overwritten, the loser is kept as a conflict copy', async () => {
    const { A, B, id } = await sharedNote('u4')
    A.online = false; B.online = false
    await updateNote(A.db, id, { content: 'Version written on device A' })
    await updateNote(B.db, id, { content: 'Version written on device B' })
    A.online = true; await A.sync()
    B.online = true; const rb = await B.sync()

    expect(rb.copies).toBe(1)
    expect(B.engine.getStatus().notice).toMatchObject({ copies: 1 })
    const all = live(await serverAll('u4'))
    expect(all.find((n) => n.id === id)!.content).toBe('Version written on device A')   // first writer kept, NOT silently replaced
    const copy = all.find((n) => n.id !== id)!
    expect(copy.content).toBe('Version written on device B')                              // the other text still exists
    expect(copy.title).toBe('T (conflict copy)')
    expect(await B.note(id)).toMatchObject({ content: 'Version written on device A', dirty: 0 })
    expect(await B.note(copy.id)).toMatchObject({ content: 'Version written on device B' })
    await A.sync()
    expect(await A.note(copy.id)).toMatchObject({ content: 'Version written on device B' }) // and A sees it too
  })

  it('both devices syncing AT THE SAME TIME still lose nothing', async () => {
    const { A, B, id } = await sharedNote('u5')
    A.online = false; B.online = false
    await updateNote(A.db, id, { content: 'simultaneous A' })
    await updateNote(B.db, id, { content: 'simultaneous B' })
    A.online = true; B.online = true
    await Promise.all([A.sync(), B.sync()])
    await Promise.all([A.sync(), B.sync()])
    const texts = live(await serverAll('u5')).map((n) => n.content).sort()
    expect(texts).toEqual(['simultaneous A', 'simultaneous B'])
    const mine = (d: Device) => d.db.notes.toArray().then((x) => x.map((n) => n.content).sort())
    expect(await mine(A)).toEqual(texts)
    expect(await mine(B)).toEqual(texts)
  })

  it('a note deleted on one device but edited on another is RESTORED with the edit (never silently lost)', async () => {
    const { A, B, id } = await sharedNote('u6')
    B.online = false
    await deleteNote(A.db, id)
    await A.sync()
    expect(live(await serverAll('u6')).length).toBe(0)
    await updateNote(B.db, id, { content: 'edited while it was deleted elsewhere' })
    B.online = true
    const r = await B.sync()
    expect(r.restored).toBe(1)
    expect(live(await serverAll('u6'))[0]).toMatchObject({ id, content: 'edited while it was deleted elsewhere' })
    await A.sync()
    expect(await A.note(id)).toMatchObject({ content: 'edited while it was deleted elsewhere' })
  })

  it('a delete is propagated to the other device', async () => {
    const { A, B, id } = await sharedNote('u7')
    await deleteNote(A.db, id)
    await A.sync()
    await B.sync()
    expect(await B.note(id)).toBeUndefined()
  })

  it('typing DURING a sync is kept, other devices\' merged edits are adopted, and nothing stale is re-sent', async () => {
    const { A, B, id } = await sharedNote('u8')
    await updateNote(A.db, id, { pinned: true }); await A.sync()             // another device pins the note
    await updateNote(B.db, id, { content: 'c1' })
    B.hook = async (req, real) => {                                          // the user keeps typing while B's request is in flight
      const res = await real(req)
      await updateNote(B.db, id, { title: 'typed during sync' })
      return res
    }
    await B.sync()
    B.hook = undefined
    expect(await B.note(id)).toMatchObject({ title: 'typed during sync', content: 'c1', pinned: true, dirty: 1 })
    await B.sync()
    const all = live(await serverAll('u8'))
    expect(all.length).toBe(1)
    expect(all[0]).toMatchObject({ title: 'typed during sync', content: 'c1', pinned: true })
  })

  it('a LOST RESPONSE is retried safely: applied exactly once, no duplicate, no false conflict', async () => {
    const { B, id } = await sharedNote('u9')
    await updateNote(B.db, id, { content: 'sent once' })
    B.hook = async (req, real) => { await real(req); throw new SyncError('network') } // server applied it, the reply never arrived
    const r1 = await B.sync()
    expect(r1.error).toBe('network')
    expect((await B.note(id))!.dirty).toBe(1)
    B.hook = undefined
    const r2 = await B.sync()
    expect(r2.error).toBeNull()
    const all = live(await serverAll('u9'))
    expect(all.length).toBe(1)                                   // no conflict copy
    expect(all[0]).toMatchObject({ content: 'sent once', version: 2 }) // version bumped once, not twice
    expect(r2.copies).toBe(0)
    expect((await B.note(id))!.dirty).toBe(0)
  })

  it('a replayed mutation is a harmless duplicate', async () => {
    const t = http('u10')
    const m: SyncMutation = { mutation_id: uuid(), id: uuid(), base_version: 0, dirty: ['title'],
      note: { title: 'once', content: '', color: 'default', labels: [], pinned: false, archived: false, deleted: false } }
    expect((await t({ mutations: [m], cursor: null })).results[0].status).toBe('applied')
    expect((await t({ mutations: [m], cursor: null })).results[0].status).toBe('duplicate')
    expect(live(await serverAll('u10')).length).toBe(1)
  })

  it('SECURITY: another user can neither read nor overwrite your notes', async () => {
    const A = new Device('u11')
    const n = await createNote(A.db, { title: 'private', content: 'secret' })
    await A.sync()

    const bob = http('u12')
    const attack: SyncMutation = { mutation_id: uuid(), id: n.id, base_version: 0, dirty: ['title', 'content'],
      note: { title: 'HACKED', content: 'HACKED', color: 'default', labels: [], pinned: false, archived: false, deleted: false } }
    const res = await bob({ mutations: [attack], cursor: null })
    expect(res.results[0]).toMatchObject({ status: 'rejected', error: 'forbidden' })
    expect(res.changes.length).toBe(0)                           // and bob's pull contains none of alice's notes
    expect(live(await serverAll('u11'))[0]).toMatchObject({ title: 'private', content: 'secret', version: 1 })
    expect((await serverAll('u12')).some((x) => x.id === n.id)).toBe(false)

    const deleteAttack = { ...attack, mutation_id: uuid(), dirty: ['deleted' as const], note: { ...attack.note, deleted: true } }
    expect((await bob({ mutations: [deleteAttack], cursor: null })).results[0].status).toBe('rejected')
    expect(live(await serverAll('u11')).length).toBe(1)
  })

  it('SECURITY: the user id can only come from the credentials (a body user_id is ignored)', async () => {
    const t = http('u13')
    const m = { mutation_id: uuid(), id: uuid(), base_version: 0, dirty: ['title'], user_id: '00000000-0000-4000-8000-000000000014',
      note: { title: 'mine', content: '', color: 'default', labels: [], pinned: false, archived: false, deleted: false } }
    await t({ mutations: [m as unknown as SyncMutation], cursor: null })
    expect(live(await serverAll('u13')).length).toBe(1)
    expect((await serverAll('u14')).length).toBe(0)
  })

  it('without valid credentials the engine reports an auth problem and keeps every note', async () => {
    const bad = new Device('u15', 'nobody')
    const n = await createNote(bad.db, { title: 'still here' })
    const r = await bad.sync()
    expect(r.error).toBe('auth')
    expect(await bad.note(n.id)).toMatchObject({ title: 'still here', dirty: 1 })
    await expect(createHttpTransport({ baseUrl: URL_! })({ mutations: [], cursor: null })).rejects.toMatchObject({ kind: 'auth' }) // no credentials at all
  })

  it('malformed or oversized requests are rejected by the API (400), never stored', async () => {
    const t = http('u16')
    const base = { mutation_id: uuid(), id: uuid(), base_version: 0, dirty: ['content'] as const }
    const note = { title: '', content: '', color: 'default', labels: [], pinned: false, archived: false, deleted: false }
    await expect(t({ mutations: [{ ...base, note: { ...note, content: 'x'.repeat(100_001) } } as unknown as SyncMutation], cursor: null })).rejects.toMatchObject({ kind: 'bad_request' })
    await expect(t({ mutations: [{ ...base, note: { ...note, color: 'neon' } } as unknown as SyncMutation], cursor: null })).rejects.toMatchObject({ kind: 'bad_request' })
    await expect(t({ mutations: [{ ...base, id: 'not-a-uuid', note } as unknown as SyncMutation], cursor: null })).rejects.toMatchObject({ kind: 'bad_request' })
    await expect(t({ mutations: Array.from({ length: 21 }, () => ({ ...base, mutation_id: uuid(), id: uuid(), note })) as unknown as SyncMutation[], cursor: null })).rejects.toMatchObject({ kind: 'bad_request' })
    await expect(t({ mutations: [], cursor: { ts: 'garbage', id: uuid() } })).rejects.toMatchObject({ kind: 'bad_request' })
    expect(live(await serverAll('u16')).length).toBe(0)
  })

  it('a large offline backlog syncs in batches, and a second device pulls it across multiple pages', async () => {
    const A = new Device('u17'), B = new Device('u17')
    A.online = false
    for (let i = 0; i < 210; i++) await createNote(A.db, { title: `note ${i}`, content: `body ${i}` })
    A.online = true
    const r = await A.sync()
    expect(r.pushed).toBe(210)
    expect(live(await serverAll('u17')).length).toBe(210)
    await B.sync()
    expect(await B.db.notes.count()).toBe(210)
    expect(await pendingCount(B.db)).toBe(0)
  }, 120_000)

  it('search-relevant data round-trips intact (unicode, newlines, labels, colour, archive)', async () => {
    const A = new Device('u18'), B = new Device('u18')
    const n = await createNote(A.db, { title: 'Päivä 🌍 — 日本語', content: 'line1\nline2\n\ttabbed "quoted" <b>not html</b>', labels: ['Work', 'home'], color: 'teal', archived: true, pinned: false })
    await A.sync(); await B.sync()
    expect(await B.note(n.id)).toMatchObject({ title: 'Päivä 🌍 — 日本語', content: 'line1\nline2\n\ttabbed "quoted" <b>not html</b>', labels: ['Work', 'home'], color: 'teal', archived: true })
  })
})
