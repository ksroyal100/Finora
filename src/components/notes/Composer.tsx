'use client'

import { useEffect, useRef, useState } from 'react'
import type { NotesDB } from '@/lib/notes/db'
import { NOTE_LIMITS, type NoteColor } from '@/lib/notes/types'
import { createNote, discardIfBlankDraft, updateNote } from '@/lib/notes/store'
import { useAutosave } from '@/lib/notes/react'
import { Swatches } from './parts'
import styles from './notes.module.css'

interface Draft { title: string; content: string; color: NoteColor }

/**
 * "Take a note…". The note is created in IndexedDB as soon as there is something to save and then updated as the user
 * types, so closing the tab mid-sentence never loses text. It never waits for the network.
 */
export function Composer({ db, onChanged }: { db: NotesDB; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [color, setColor] = useState<NoteColor>('default')
  const noteId = useRef<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const { schedule, flush } = useAutosave<Draft>(async (d) => {
    if (!noteId.current) {
      if (!d.title.trim() && !d.content.trim()) return
      noteId.current = (await createNote(db, d)).id
    } else {
      await updateNote(db, noteId.current, d)
    }
    onChanged()
  })

  const update = (next: Partial<Draft>) => {
    const d = { title, content, color, ...next }
    if (next.title !== undefined) setTitle(next.title)
    if (next.content !== undefined) setContent(next.content)
    if (next.color !== undefined) setColor(next.color)
    schedule(d)
  }

  const close = async () => {
    await flush()
    if (noteId.current) await discardIfBlankDraft(db, noteId.current)
    noteId.current = null
    setTitle(''); setContent(''); setColor('default'); setOpen(false)
    onChanged()
  }
  const closeRef = useRef(close)
  closeRef.current = close

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) void closeRef.current() }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => { if (open) bodyRef.current?.focus() }, [open])
  useEffect(() => {
    const el = bodyRef.current
    if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 360)}px` }
  }, [content, open])

  return (
    <div className={styles.composerWrap}>
      <div ref={wrapRef} className={styles.composer} data-color={color}
        onKeyDown={(e) => { if (e.key === 'Escape') void close() }}>
        {!open ? (
          <button type="button" className={styles.composerCollapsed} onClick={() => setOpen(true)}>Take a note…</button>
        ) : (
          <>
            <input className={`${styles.field} ${styles.fieldTitle}`} value={title} maxLength={NOTE_LIMITS.title} placeholder="Title" aria-label="Title"
              onChange={(e) => update({ title: e.target.value })} />
            <textarea ref={bodyRef} className={`${styles.field} ${styles.fieldBody}`} value={content} maxLength={NOTE_LIMITS.content} placeholder="Take a note…" aria-label="Note"
              onChange={(e) => update({ content: e.target.value })} />
            <Swatches value={color} onChange={(c) => update({ color: c })} />
            <div className={styles.toolbar}>
              <span style={{ flex: 1 }} />
              <button type="button" className={styles.closeBtn} onClick={() => void close()}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
