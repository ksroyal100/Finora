'use client'

import { Archive, ArchiveRestore, Pin, PinOff, Trash2 } from 'lucide-react'
import type { LocalNote } from '@/lib/notes/db'
import styles from './notes.module.css'

interface Props {
  note: LocalNote
  showArchivedTag?: boolean
  onOpen: (id: string) => void
  onTogglePin: (note: LocalNote) => void
  onToggleArchive: (note: LocalNote) => void
  onDelete: (note: LocalNote) => void
  onLabel: (label: string) => void
}

/** <article> with sibling controls: the "open" button and the action buttons are never nested inside each other. */
export function NoteCard({ note, showArchivedTag, onOpen, onTogglePin, onToggleArchive, onDelete, onLabel }: Props) {
  const name = note.title || note.content.slice(0, 40) || 'Empty note'
  const unsynced = note.dirty === 1
  const failed = !!note.syncError

  return (
    <article className={styles.card} data-color={note.color}>
      <button type="button" className={styles.cardMain} onClick={() => onOpen(note.id)} aria-label={`Open note: ${name}`}>
        {showArchivedTag && note.archived ? <div className={styles.archivedTag}>Archived</div> : null}
        {note.title ? <h3 className={styles.cardTitle}>{note.title}</h3> : null}
        {note.content ? <div className={styles.cardBody}>{note.content}</div> : !note.title ? <div className={styles.cardEmpty}>Empty note</div> : null}
      </button>
      {note.labels.length > 0 && (
        <div className={styles.chips}>
          {note.labels.map((l) => (
            <button key={l} type="button" className={`${styles.chip} ${styles.chipBtn}`} onClick={() => onLabel(l)} aria-label={`Filter by label ${l}`}>{l}</button>
          ))}
        </div>
      )}
      <div className={styles.cardFoot}>
        <button type="button" className={styles.iconBtn} aria-pressed={note.pinned} aria-label={note.pinned ? 'Unpin note' : 'Pin note'} title={note.pinned ? 'Unpin' : 'Pin'} onClick={() => onTogglePin(note)}>
          {note.pinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
        <button type="button" className={styles.iconBtn} aria-label={note.archived ? 'Unarchive note' : 'Archive note'} title={note.archived ? 'Unarchive' : 'Archive'} onClick={() => onToggleArchive(note)}>
          {note.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
        </button>
        <button type="button" className={`${styles.iconBtn} ${styles.dangerHover}`} aria-label="Delete note" title="Delete" onClick={() => onDelete(note)}>
          <Trash2 size={16} />
        </button>
        {(unsynced || failed) && (
          <span className={styles.pendingDot} data-error={failed} role="img" aria-label={failed ? "This note couldn't be synced" : 'Saved on this device, waiting to sync'}
            title={failed ? "This note couldn't be synced. Edit it to try again." : 'Saved on this device, waiting to sync'} />
        )}
      </div>
    </article>
  )
}
