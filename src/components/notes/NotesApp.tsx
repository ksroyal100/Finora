'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, StickyNote, X } from 'lucide-react'
import type { LocalNote } from '@/lib/notes/db'
import { useLocalNotes, useNotesRuntime, useSyncView } from '@/lib/notes/react'
import { collectLabels, searchNotes, sortNotes } from '@/lib/notes/search'
import { deleteNote, restoreNote, setPinned, updateNote } from '@/lib/notes/store'
import { Composer } from './Composer'
import { NoteCard } from './NoteCard'
import { NoteEditor } from './NoteEditor'
import { SyncBadge } from './parts'
import styles from './notes.module.css'

type View = 'notes' | 'archive'
const UNDO_MS = 6000 // shorter than the sync engine's 7 s undo window, so Undo can never arrive after the delete was sent

export function NotesApp({ userId }: { userId: string }) {
  const runtime = useNotesRuntime(userId)
  const notes = useLocalNotes(runtime)
  const sync = useSyncView(runtime)

  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('notes')
  const [label, setLabel] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null)

  // Offline support for reloads: a small service worker caches this page's shell (see public/finora-notes-sw.js).
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/finora-notes-sw.js').catch(() => { /* notes still work; only offline page reloads are affected */ })
    }
  }, [])

  // Ask the browser not to evict this site's storage under pressure, so unsynced notes survive. Best effort: some
  // browsers decide on their own, and it never blocks anything.
  useEffect(() => { void navigator.storage?.persist?.().catch(() => undefined) }, [])

  const changed = useCallback(() => runtime?.engine.requestSync('edit'), [runtime])

  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), UNDO_MS)
    return () => clearTimeout(t)
  }, [undo])

  const live = useMemo(() => (notes ?? []).filter((n) => !n.deleted), [notes])
  const labels = useMemo(() => collectLabels(live), [live])
  const searching = query.trim() !== ''

  const visible = useMemo(() => {
    let list: LocalNote[] = searching ? searchNotes(live, query) : live.filter((n) => (view === 'archive' ? n.archived : !n.archived))
    if (label) list = list.filter((n) => n.labels.includes(label))
    return sortNotes(list)
  }, [live, query, searching, view, label])

  const pinned = searching || view === 'archive' ? [] : visible.filter((n) => n.pinned)
  const others = searching || view === 'archive' ? visible : visible.filter((n) => !n.pinned)
  const openNote = openId ? live.find((n) => n.id === openId) ?? null : null
  const failedCount = live.filter((n) => n.syncError).length

  const db = runtime?.db
  const onTogglePin = async (n: LocalNote) => { if (db) { await setPinned(db, n.id, !n.pinned); changed() } }
  const onToggleArchive = async (n: LocalNote) => { if (db) { await updateNote(db, n.id, { archived: !n.archived, pinned: n.archived ? n.pinned : false }); changed() } }
  const onDelete = async (n: LocalNote) => {
    if (!db) return
    setOpenId(null)
    await deleteNote(db, n.id)
    setUndo({ id: n.id, title: n.title || 'Note' })
    changed()
  }
  const onUndo = async () => {
    if (!db || !undo) return
    await restoreNote(db, undo.id)
    setUndo(null)
    changed()
  }

  const notice = sync.status.notice
  const noticeText = notice
    ? [
        notice.copies > 0 && `${notice.copies === 1 ? 'A note was' : `${notice.copies} notes were`} edited on another device at the same time. Both versions were kept: look for "(conflict copy)".`,
        notice.restored > 0 && `${notice.restored === 1 ? 'A note' : `${notice.restored} notes`} deleted on another device ${notice.restored === 1 ? 'was' : 'were'} restored because you edited ${notice.restored === 1 ? 'it' : 'them'}.`,
      ].filter(Boolean).join(' ')
    : ''

  const loading = !runtime || notes === undefined
  const nothing = !loading && live.length === 0

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}><StickyNote size={24} aria-hidden="true" /> Notes</h1>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} aria-hidden="true" />
          <input className={styles.search} type="search" value={query} placeholder="Search notes" aria-label="Search notes"
            onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setQuery('') }} />
          {query && <button type="button" className={`${styles.iconBtn} ${styles.searchClear}`} aria-label="Clear search" onClick={() => setQuery('')}><X size={15} /></button>}
        </div>
        <span className={styles.spacer} />
        <SyncBadge view={sync} />
      </div>

      {sync.status.lastError === 'auth' && (
        <div className={styles.banner} data-tone="warn" role="alert">
          <span>Your session has expired, so notes can&apos;t sync right now. Everything is safe on this device. <Link href="/signin">Sign in again</Link> to resume syncing.</span>
        </div>
      )}
      {failedCount > 0 && (
        <div className={styles.banner} data-tone="warn" role="status">
          <span>{failedCount === 1 ? '1 note' : `${failedCount} notes`} couldn&apos;t be synced and {failedCount === 1 ? 'is' : 'are'} marked with a red dot. Edit {failedCount === 1 ? 'it' : 'them'} to try again; your text is still saved here.</span>
        </div>
      )}

      {runtime && !searching && view === 'notes' && <Composer db={runtime.db} onChanged={changed} />}

      <div className={styles.tabs}>
        <button type="button" className={styles.tab} aria-pressed={view === 'notes' && !searching} onClick={() => { setView('notes'); setQuery('') }}>Notes</button>
        <button type="button" className={styles.tab} aria-pressed={view === 'archive' && !searching} onClick={() => { setView('archive'); setQuery('') }}>Archive</button>
        {labels.length > 0 && <span className={styles.tabDivider} aria-hidden="true" />}
        {labels.map((l) => (
          <button key={l} type="button" className={styles.tab} aria-pressed={label === l} onClick={() => setLabel(label === l ? null : l)}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className={styles.skeletonGrid} aria-busy="true" aria-label="Loading notes">
          {[110, 160, 90, 140, 120, 100].map((h, i) => <div key={i} className={styles.skeleton} style={{ height: h }} />)}
        </div>
      ) : nothing ? (
        <div className={styles.empty}>
          <StickyNote size={44} aria-hidden="true" />
          <h2>Your notes live here</h2>
          <p>Notes are saved on this device instantly and sync to your account. They work offline too.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.empty}>
          <h2>{searching ? 'No matching notes' : view === 'archive' ? 'Nothing archived' : 'No notes here'}</h2>
          <p>{searching ? 'Try different words, or check the spelling.' : label ? `No notes have the label “${label}”.` : 'Archived notes show up here.'}</p>
        </div>
      ) : (
        <>
          {pinned.length > 0 && <div className={styles.sectionLabel}>Pinned</div>}
          {pinned.length > 0 && <div className={styles.grid}>{pinned.map((n) => <NoteCard key={n.id} note={n} onOpen={setOpenId} onTogglePin={onTogglePin} onToggleArchive={onToggleArchive} onDelete={onDelete} onLabel={setLabel} />)}</div>}
          {pinned.length > 0 && others.length > 0 && <div className={styles.sectionLabel}>Others</div>}
          <div className={styles.grid}>
            {others.map((n) => <NoteCard key={n.id} note={n} showArchivedTag={searching} onOpen={setOpenId} onTogglePin={onTogglePin} onToggleArchive={onToggleArchive} onDelete={onDelete} onLabel={setLabel} />)}
          </div>
        </>
      )}

      {runtime && openNote && (
        <NoteEditor key={openNote.id} db={runtime.db} note={openNote} suggestions={labels} onClose={() => setOpenId(null)} onDelete={onDelete} onChanged={changed} />
      )}

      <div className={styles.toasts} aria-live="polite">
        {undo && (
          <div className={styles.toast} role="status">
            <span>{undo.title === 'Note' ? 'Note deleted' : `“${undo.title.slice(0, 40)}” deleted`}</span>
            <button type="button" className={styles.toastAction} onClick={onUndo}>Undo</button>
          </div>
        )}
        {notice && (
          <div className={styles.toast} role="status">
            <span>{noticeText}</span>
            <button type="button" className={styles.toastAction} onClick={() => runtime?.engine.dismissNotice()}>Got it</button>
          </div>
        )}
      </div>
    </main>
  )
}
