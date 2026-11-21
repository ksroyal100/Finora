'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getNotesRuntime, type NotesRuntime } from './session'
import { deriveSyncLabel, type SyncLabel, type SyncStatus } from './sync'
import { pendingCount } from './store'
import type { LocalNote } from './db'

/** Opens this user's local database and starts background sync. Returns null only during the very first client render. */
export function useNotesRuntime(userId: string): NotesRuntime | null {
  const [runtime, setRuntime] = useState<NotesRuntime | null>(null)
  useEffect(() => {
    const rt = getNotesRuntime(userId)
    rt.engine.start()
    setRuntime(rt)
    return () => rt.engine.stop()
  }, [userId])
  return runtime
}

/** Every local note. `undefined` while IndexedDB is answering the first read (a few milliseconds), then live-updating. */
export function useLocalNotes(runtime: NotesRuntime | null): LocalNote[] | undefined {
  return useLiveQuery(async () => (runtime ? runtime.db.notes.toArray() : undefined), [runtime])
}

const IDLE: SyncStatus = { syncing: false, online: true, lastError: null, lastSyncedAt: null, notice: null }
const noopSubscribe = () => () => {}

export interface SyncView { label: SyncLabel; pending: number; status: SyncStatus }

export function useSyncView(runtime: NotesRuntime | null): SyncView {
  const status = useSyncExternalStore(
    runtime ? runtime.engine.subscribe : noopSubscribe,
    runtime ? runtime.engine.getStatus : () => IDLE,
    () => IDLE,
  )
  const pending = useLiveQuery(async () => (runtime ? pendingCount(runtime.db) : 0), [runtime], 0)
  return { label: deriveSyncLabel({ ...status, pending }), pending, status }
}

/**
 * Debounced auto-save. Every change is written to IndexedDB shortly after the user stops typing (default 250 ms),
 * and ALWAYS flushed immediately when the editor closes, loses focus, the tab is hidden or the page unloads.
 * Saves are serialised so two writes can never interleave.
 */
export function useAutosave<T>(save: (value: T) => Promise<void>, delayMs = 250) {
  const saveRef = useRef(save)
  saveRef.current = save
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<{ value: T } | null>(null)
  const chain = useRef<Promise<void>>(Promise.resolve())

  const flush = useRef(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const item = pending.current
    pending.current = null
    if (item) chain.current = chain.current.then(() => saveRef.current(item.value)).catch((e) => console.error('[notes] save failed', e))
    return chain.current
  }).current

  const schedule = useRef((value: T) => {
    pending.current = { value }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, delayMs)
  }).current

  useEffect(() => {
    const onHidden = () => { if (document.visibilityState === 'hidden') void flush() }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', flush)
      void flush()
    }
  }, [flush])

  return { schedule, flush }
}
