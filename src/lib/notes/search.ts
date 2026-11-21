import type { LocalNote } from './db'

type SortableNote = Pick<LocalNote, 'pinned' | 'updatedAt'>

/** Pinned first, then most recently edited. */
export function sortNotes<T extends SortableNote>(notes: readonly T[]): T[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
}

/** Every whitespace-separated term must appear (case-insensitive) in the title, text or a label. Runs on local data: instant and offline. */
export function searchNotes<T extends Pick<LocalNote, 'title' | 'content' | 'labels'>>(notes: readonly T[], query: string): T[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return [...notes]
  return notes.filter((n) => {
    const hay = `${n.title}\n${n.content}\n${n.labels.join(' ')}`.toLowerCase()
    return terms.every((t) => hay.includes(t))
  })
}

export function collectLabels(notes: readonly Pick<LocalNote, 'labels' | 'deleted'>[]): string[] {
  const byLower = new Map<string, string>()
  for (const n of notes) {
    if (n.deleted) continue
    for (const l of n.labels) if (!byLower.has(l.toLowerCase())) byLower.set(l.toLowerCase(), l)
  }
  return [...byLower.values()].sort((a, b) => a.localeCompare(b))
}
