'use client'

import { useState, type KeyboardEvent } from 'react'
import { Check, CloudOff, HardDrive, RefreshCw, X } from 'lucide-react'
import { NOTE_COLORS, type NoteColor } from '@/lib/notes/types'
import { sanitizeLabel } from '@/lib/notes/fields'
import type { SyncView } from '@/lib/notes/react'
import styles from './notes.module.css'

const COLOR_NAMES: Record<NoteColor, string> = {
  default: 'Default', red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', teal: 'Teal', blue: 'Blue', purple: 'Purple', pink: 'Pink', gray: 'Gray',
}

/** Subtle status pill: Offline · Syncing… · Saved locally · Synced. */
export function SyncBadge({ view }: { view: SyncView }) {
  const { label, pending, status } = view
  const text = { offline: 'Offline', syncing: 'Syncing…', saved: 'Saved locally', synced: 'Synced' }[label]
  const n = pending === 1 ? '1 change' : `${pending} changes`
  const title = {
    offline: pending > 0 ? `You're offline. ${n} saved on this device and will sync automatically when you're back online.` : "You're offline. Everything is saved on this device.",
    syncing: 'Syncing your notes…',
    saved: pending > 0 ? `${n} saved on this device, waiting to sync.${status.lastError ? ' Will retry shortly.' : ''}` : 'Saved on this device.',
    synced: 'All changes are saved to your account.',
  }[label]
  const Icon = label === 'offline' ? CloudOff : label === 'syncing' ? RefreshCw : label === 'saved' ? HardDrive : Check
  return (
    <span className={styles.badge} data-state={label} role="status" aria-live="polite" title={title}>
      <Icon size={13} className={label === 'syncing' ? styles.spin : undefined} aria-hidden="true" />
      {text}
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{title}</span>
    </span>
  )
}

export function Swatches({ value, onChange }: { value: NoteColor; onChange: (c: NoteColor) => void }) {
  return (
    <div className={styles.swatches} role="group" aria-label="Note colour">
      {NOTE_COLORS.map((c) => (
        <button key={c} type="button" className={styles.swatch} data-color={c} aria-pressed={value === c} aria-label={COLOR_NAMES[c]} title={COLOR_NAMES[c]} onClick={() => onChange(c)} />
      ))}
    </div>
  )
}

export function LabelEditor({ labels, suggestions, onChange }: { labels: string[]; suggestions: string[]; onChange: (labels: string[]) => void }) {
  const [text, setText] = useState('')
  const add = () => {
    const l = sanitizeLabel(text)
    setText('')
    if (l && !labels.some((x) => x.toLowerCase() === l.toLowerCase())) onChange([...labels, l])
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
    else if (e.key === 'Backspace' && text === '' && labels.length) onChange(labels.slice(0, -1))
  }
  const listId = 'note-label-suggestions'
  return (
    <div className={styles.labelEditor}>
      {labels.map((l) => (
        <span key={l} className={styles.chip}>
          {l}
          <button type="button" className={styles.iconBtn} style={{ width: 18, height: 18 }} aria-label={`Remove label ${l}`} onClick={() => onChange(labels.filter((x) => x !== l))}><X size={11} /></button>
        </span>
      ))}
      <input className={styles.labelInput} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onBlur={add}
        placeholder={labels.length ? 'Add label' : 'Add a label…'} aria-label="Add a label" list={listId} maxLength={40} />
      <datalist id={listId}>{suggestions.filter((s) => !labels.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>
    </div>
  )
}

