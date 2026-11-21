// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within, cleanup, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotesDB } from '@/lib/notes/db'
import { SyncEngine, SyncError, type SyncTransport } from '@/lib/notes/sync'
import { createNote, updateNote } from '@/lib/notes/store'
import type { NotesRuntime } from '@/lib/notes/session'
import type { ServerNote } from '@/lib/notes/types'

// ── a controllable runtime in place of the real one (which talks to the network) ──
let runtime: NotesRuntime
let online = true
let transportCalls = 0
let failTransport: SyncError | null = null

vi.mock('@/lib/notes/session', () => ({ getNotesRuntime: () => runtime }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }))

import { NotesApp } from '@/components/notes/NotesApp'

let n = 0
const transport: SyncTransport = async (req) => {
  transportCalls++
  if (failTransport) throw failTransport
  const changes: ServerNote[] = []
  const results = req.mutations.map((m) => {
    const note: ServerNote = { ...m.note, id: m.id, version: m.base_version + 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    changes.push(note)
    return { mutation_id: m.mutation_id, status: 'applied' as const, note }
  })
  return { results, changes, cursor: null, has_more: false, server_time: new Date().toISOString() }
}

beforeEach(() => {
  online = true; transportCalls = 0; failTransport = null
  const db = new NotesDB(`ui-${n++}`)
  const engine = new SyncEngine(db, { transport, isOnline: () => online, undoWindowMs: 7000, attachWindowListeners: false, debounceMs: 20, minIntervalMs: 0 })
  runtime = { userId: 'u1', db, engine }
})
afterEach(() => { runtime.engine.stop(); cleanup() })

const titles = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent)
const user = () => userEvent.setup()

describe('Notes UI (jsdom + real Dexie)', () => {
  it('shows notes straight from the local database, with no network needed to read them', async () => {
    online = false
    await createNote(runtime.db, { title: 'Offline read', content: 'stored on this device' })
    render(<NotesApp userId="u1" />)
    expect(await screen.findByText('Offline read')).toBeTruthy()
    expect(screen.getByText('stored on this device')).toBeTruthy()
    expect(transportCalls).toBe(0)
    await waitFor(() => expect(screen.getAllByText('Offline').length).toBeGreaterThan(0))
  })

  it('shows a friendly empty state for a brand-new user', async () => {
    render(<NotesApp userId="u1" />)
    expect(await screen.findByText('Your notes live here')).toBeTruthy()
  })

  it('creates a note from the composer: saved to IndexedDB while typing, then shown as a card', async () => {
    const u = user()
    render(<NotesApp userId="u1" />)
    await u.click(await screen.findByRole('button', { name: 'Take a note…' }))
    await u.type(screen.getByLabelText('Title'), 'Shopping')
    await u.type(screen.getByLabelText('Note'), 'milk and eggs')
    await waitFor(async () => expect((await runtime.db.notes.toArray())[0]).toMatchObject({ title: 'Shopping', content: 'milk and eggs' }), { timeout: 2000 })
    await u.click(screen.getByRole('button', { name: 'Close' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Shopping' })).toBeTruthy()
    expect(await runtime.db.notes.count()).toBe(1)
  })

  it('closing the composer IMMEDIATELY after typing still saves everything (flush on close)', async () => {
    const u = user()
    render(<NotesApp userId="u1" />)
    await u.click(await screen.findByRole('button', { name: 'Take a note…' }))
    await u.type(screen.getByLabelText('Note'), 'typed and closed instantly')
    await u.click(screen.getByRole('button', { name: 'Close' })) // no waiting for the debounce
    await screen.findByRole('button', { name: 'Take a note…' })   // the composer has closed...
    expect((await runtime.db.notes.toArray()).map((x) => x.content)).toEqual(['typed and closed instantly']) // ...and the text is already stored
  })

  it('an empty composer leaves no note behind', async () => {
    const u = user()
    render(<NotesApp userId="u1" />)
    await u.click(await screen.findByRole('button', { name: 'Take a note…' }))
    await u.click(screen.getByRole('button', { name: 'Close' }))
    await new Promise((r) => setTimeout(r, 400))
    expect(await runtime.db.notes.count()).toBe(0)
  })

  it('search filters instantly across title, text and labels, and says so when nothing matches', async () => {
    await createNote(runtime.db, { title: 'Budget', content: 'rent and groceries' })
    await createNote(runtime.db, { title: 'Trip', content: 'book flights', labels: ['travel'] })
    const u = user()
    render(<NotesApp userId="u1" />)
    await screen.findByText('Budget')
    await u.type(screen.getByLabelText('Search notes'), 'flights')
    await waitFor(() => expect(titles()).toEqual(['Trip']))
    await u.clear(screen.getByLabelText('Search notes'))
    await u.type(screen.getByLabelText('Search notes'), 'travel')
    await waitFor(() => expect(titles()).toEqual(['Trip'])) // matches the label
    await u.clear(screen.getByLabelText('Search notes'))
    await u.type(screen.getByLabelText('Search notes'), 'zzzz')
    expect(await screen.findByText('No matching notes')).toBeTruthy()
    await u.click(screen.getByRole('button', { name: 'Clear search' }))
    await waitFor(() => expect(titles().sort()).toEqual(['Budget', 'Trip']))
  })

  it('pinning moves a note into a Pinned section and persists it', async () => {
    await createNote(runtime.db, { title: 'First' })
    await createNote(runtime.db, { title: 'Second' })
    const u = user()
    render(<NotesApp userId="u1" />)
    const card = (await screen.findByRole('heading', { level: 3, name: 'Second' })).closest('article')!
    await u.click(within(card).getByRole('button', { name: 'Pin note' }))
    expect(await screen.findByText('Pinned')).toBeTruthy()
    expect(screen.getByText('Others')).toBeTruthy()
    expect((await runtime.db.notes.toArray()).find((x) => x.title === 'Second')!.pinned).toBe(true)
  })

  it('delete shows Undo; Undo restores the note, and without Undo it stays deleted', async () => {
    await createNote(runtime.db, { title: 'Keep me' })
    await createNote(runtime.db, { title: 'Drop me' })
    const u = user()
    render(<NotesApp userId="u1" />)
    const keep = (await screen.findByRole('heading', { level: 3, name: 'Keep me' })).closest('article')!
    await u.click(within(keep).getByRole('button', { name: 'Delete note' }))
    expect(await screen.findByText(/deleted/)).toBeTruthy()
    await waitFor(() => expect(titles()).toEqual(['Drop me']))
    await u.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(titles().sort()).toEqual(['Drop me', 'Keep me']))
    expect((await runtime.db.notes.toArray()).every((x) => !x.deleted)).toBe(true)

    const drop = screen.getByRole('heading', { level: 3, name: 'Drop me' }).closest('article')!
    await u.click(within(drop).getByRole('button', { name: 'Delete note' }))
    await waitFor(() => expect(titles()).toEqual(['Keep me']))
    expect((await runtime.db.notes.toArray()).find((x) => x.title === 'Drop me')!.deleted).toBe(true)
  })

  it('archive moves a note to the Archive tab', async () => {
    await createNote(runtime.db, { title: 'Old stuff' })
    const u = user()
    render(<NotesApp userId="u1" />)
    const card = (await screen.findByRole('heading', { level: 3, name: 'Old stuff' })).closest('article')!
    await u.click(within(card).getByRole('button', { name: 'Archive note' }))
    await waitFor(() => expect(titles()).toEqual([]))
    await u.click(screen.getByRole('button', { name: 'Archive' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Old stuff' })).toBeTruthy()
  })

  it('label chips filter the grid', async () => {
    await createNote(runtime.db, { title: 'Work thing', labels: ['work'] })
    await createNote(runtime.db, { title: 'Home thing', labels: ['home'] })
    const u = user()
    render(<NotesApp userId="u1" />)
    await screen.findByText('Work thing')
    const tabs = screen.getAllByRole('button', { name: 'work' })
    await u.click(tabs[0])
    await waitFor(() => expect(titles()).toEqual(['Work thing']))
  })

  it('the editor is an accessible dialog; typing auto-saves and Escape closes without losing text', async () => {
    const note = await createNote(runtime.db, { title: 'Draft', content: 'start' })
    const u = user()
    render(<NotesApp userId="u1" />)
    await u.click(await screen.findByRole('button', { name: /Open note: Draft/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit note' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const body = within(dialog).getByLabelText('Note')
    await u.type(body, ' + more words')
    await u.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // Checked WITHOUT polling: by the time the editor is gone the text must already be stored. (If saving relied on
    // the 250 ms debounce, closing the tab right after typing would lose it.)
    expect((await runtime.db.notes.get(note.id))!.content).toBe('start + more words')
  })

  it('editing in the dialog never overwrites a field it did not touch (e.g. one merged in from another device)', async () => {
    const note = await createNote(runtime.db, { title: 'Title', content: 'body' })
    const u = user()
    render(<NotesApp userId="u1" />)
    await u.click(await screen.findByRole('button', { name: /Open note: Title/ }))
    const dialog = await screen.findByRole('dialog')
    await u.type(within(dialog).getByLabelText('Note'), ' typed')
    await updateNote(runtime.db, note.id, { title: 'Title changed elsewhere' }) // arrives while the dialog is open
    await u.keyboard('{Escape}')
    await waitFor(async () => expect(await runtime.db.notes.get(note.id)).toMatchObject({ title: 'Title changed elsewhere', content: 'body typed' }))
  })

  it('sync status: Offline while offline, Synced after the queue drains', async () => {
    online = false
    await createNote(runtime.db, { title: 'queued' })
    render(<NotesApp userId="u1" />)
    await screen.findByText('queued')
    await waitFor(() => expect(screen.getAllByText('Offline').length).toBeGreaterThan(0))
    expect(transportCalls).toBe(0)

    online = true
    await act(async () => { await runtime.engine.syncNow() })
    await waitFor(() => expect(screen.getAllByText('Synced').length).toBeGreaterThan(0))
    expect(transportCalls).toBeGreaterThan(0)
  })

  it('a failing server leaves notes readable and shows "Saved locally" or "Offline", never an error screen', async () => {
    failTransport = new SyncError('server')
    await createNote(runtime.db, { title: 'safe' })
    render(<NotesApp userId="u1" />)
    expect(await screen.findByText('safe')).toBeTruthy()
    await act(async () => { await runtime.engine.syncNow() })
    await waitFor(() => expect(screen.getAllByText('Saved locally').length).toBeGreaterThan(0))
    expect(screen.getByText('safe')).toBeTruthy()
  })

  it('an expired session shows a sign-in banner but keeps the notes', async () => {
    failTransport = new SyncError('auth')
    await createNote(runtime.db, { title: 'still mine' })
    render(<NotesApp userId="u1" />)
    await screen.findByText('still mine')
    await act(async () => { await runtime.engine.syncNow() })
    expect(await screen.findByText(/session has expired/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Sign in again' })).toBeTruthy()
    expect(screen.getByText('still mine')).toBeTruthy()
  })

  it('renders note text as plain text, never as HTML', async () => {
    await createNote(runtime.db, { title: '<img src=x onerror=alert(1)>', content: '<script>window.__pwned = true</script>' })
    render(<NotesApp userId="u1" />)
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeTruthy()
    expect(document.querySelector('script')).toBeNull()
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined()
  })
})
