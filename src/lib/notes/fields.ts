import { EMPTY_FIELDS, NOTE_COLORS, NOTE_FIELDS, NOTE_LIMITS, type NoteColor, type NoteField, type NoteFields } from './types'

export function sanitizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').slice(0, NOTE_LIMITS.label)
}

/** Trim, drop empties, de-duplicate case-insensitively (first spelling wins), cap the count, sort (byte order). */
export function sanitizeLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of labels) {
    const label = sanitizeLabel(raw)
    const key = label.toLowerCase()
    if (!label || seen.has(key)) continue
    seen.add(key)
    out.push(label)
    if (out.length >= NOTE_LIMITS.labels) break
  }
  return out.sort()
}

/** Coerce any input into a valid NoteFields (clamps lengths; the server validates the same limits). */
export function normalizeFields(input: Partial<NoteFields>): NoteFields {
  return {
    title: String(input.title ?? EMPTY_FIELDS.title).slice(0, NOTE_LIMITS.title),
    content: String(input.content ?? EMPTY_FIELDS.content).slice(0, NOTE_LIMITS.content),
    color: (NOTE_COLORS as readonly string[]).includes(input.color as string) ? (input.color as NoteColor) : 'default',
    labels: sanitizeLabels(input.labels ?? []),
    pinned: !!input.pinned,
    archived: !!input.archived,
    deleted: !!input.deleted,
  }
}

export function fieldsOf(n: NoteFields): NoteFields {
  return { title: n.title, content: n.content, color: n.color, labels: [...n.labels], pinned: n.pinned, archived: n.archived, deleted: n.deleted }
}

export function sameLabels(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

export function fieldEqual(field: NoteField, a: NoteFields, b: NoteFields): boolean {
  return field === 'labels' ? sameLabels(a.labels, b.labels) : a[field] === b[field]
}

/** Which fields differ between two notes (labels compared as sets, so ordering never causes a false change). */
export function diffFields(a: NoteFields, b: NoteFields): NoteField[] {
  return NOTE_FIELDS.filter((f) => !fieldEqual(f, a, b))
}

export function isBlank(n: Pick<NoteFields, 'title' | 'content' | 'labels'>): boolean {
  return n.title.trim() === '' && n.content.trim() === '' && n.labels.length === 0
}
