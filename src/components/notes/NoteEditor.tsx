'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Archive, ArchiveRestore, Pin, PinOff, Trash2 } from 'lucide-react'
import type { LocalNote, NotesDB } from '@/lib/notes/db'
import type { NoteFields } from '@/lib/notes/types'
import { NOTE_LIMITS } from '@/lib/notes/types'
import { discardIfBlankDraft, updateNote } from '@/lib/notes/store'
import { useAutosave } from '@/lib/notes/react'
import { LabelEditor, Swatches } from './parts'
import styles from './notes.module.css'

interface Props {
  db: NotesDB
  note: LocalNote
  suggestions: string[]
  onClose: () => void
  onDelete: (note: LocalNote) => void
  onChanged: () => void
}

type TextDraft = { title?: string; content?: string }

export function NoteEditor({ db, note, suggestions, onClose, onDelete, onChanged }: Props) {
  // A text field is only "owned" by this editor once the user types in it; until then it follows the stored note,
  // so a change merged in from another device is shown instead of being overwritten by stale editor state.
  const [draft, setDraft] = useState<TextDraft>({})
  const pendingPatch = useRef<Partial<NoteFields>>({})
  const dialogRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const returnFocusTo = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null)

  const { schedule, flush } = useAutosave<Partial<NoteFields>>(async (patch) => {
    pendingPatch.current = {}
    await updateNote(db, note.id, patch)
    onChanged()
  })

  const title = draft.title ?? note.title
  const content = draft.content ?? note.content

  const edit = (p: TextDraft) => {
    setDraft((d) => ({ ...d, ...p }))
    pendingPatch.current = { ...pendingPatch.current, ...p }
    schedule(pendingPatch.current)
  }
  const patchNow = async (p: Partial<NoteFields>) => { await updateNote(db, note.id, p); onChanged() }

  const close = async () => {
    await flush() // nothing the user typed is ever dropped on close
    await discardIfBlankDraft(db, note.id)
    onChanged()
    onClose()
    if (returnFocusTo.current instanceof HTMLElement) returnFocusTo.current.focus()
  }

  useEffect(() => { bodyRef.current?.focus() }, [])
  useEffect(() => { // grow the textarea with its content
    const el = bodyRef.current
    if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 460)}px` }
  }, [content])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.stopPropagation(); void close(); return }
    if (e.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')
    if (!focusable || focusable.length === 0) return
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
  const onOverlay = (e: MouseEvent) => { if (e.target === e.currentTarget) void close() }

  return (
    <div className={styles.overlay} onMouseDown={onOverlay}>
      <div ref={dialogRef} className={styles.dialog} data-color={note.color} role="dialog" aria-modal="true" aria-label="Edit note" onKeyDown={onKeyDown}>
        <div className={styles.dialogBody}>
          <input className={`${styles.field} ${styles.fieldTitle}`} value={title} maxLength={NOTE_LIMITS.title} placeholder="Title" aria-label="Title"
            onChange={(e) => edit({ title: e.target.value })} />
          <textarea ref={bodyRef} className={`${styles.field} ${styles.fieldBody}`} value={content} maxLength={NOTE_LIMITS.content} placeholder="Take a note…" aria-label="Note"
            onChange={(e) => edit({ content: e.target.value })} />
          <LabelEditor labels={note.labels} suggestions={suggestions} onChange={(labels) => void patchNow({ labels })} />
          <Swatches value={note.color} onChange={(color) => void patchNow({ color })} />
          <div className={styles.dialogMeta}>
            {note.dirty ? 'Saved on this device' : 'Synced'} · Edited {new Date(note.updatedAt).toLocaleString()}
          </div>
        </div>
        <div className={styles.toolbar}>
          <button type="button" className={styles.iconBtn} aria-pressed={note.pinned} aria-label={note.pinned ? 'Unpin note' : 'Pin note'} title={note.pinned ? 'Unpin' : 'Pin'}
            onClick={() => void patchNow({ pinned: !note.pinned })}>{note.pinned ? <PinOff size={17} /> : <Pin size={17} />}</button>
          <button type="button" className={styles.iconBtn} aria-label={note.archived ? 'Unarchive note' : 'Archive note'} title={note.archived ? 'Unarchive' : 'Archive'}
            onClick={async () => { await patchNow({ archived: !note.archived, pinned: note.archived ? note.pinned : false }); void close() }}>
            {note.archived ? <ArchiveRestore size={17} /> : <Archive size={17} />}
          </button>
          <button type="button" className={`${styles.iconBtn} ${styles.dangerHover}`} aria-label="Delete note" title="Delete"
            onClick={async () => { await flush(); onDelete(note) }}><Trash2 size={17} /></button>
          <span style={{ flex: 1 }} />
          <button type="button" className={styles.closeBtn} onClick={() => void close()}>Close</button>
        </div>
      </div>
    </div>
  )
}

