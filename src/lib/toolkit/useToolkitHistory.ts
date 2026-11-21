// src/lib/toolkit/useToolkitHistory.ts
//
// Save / duplicate / compare / history for toolkit scenarios.
// Deliberately local-storage only (no database round-trip) — these are
// scratch-pad "what if" runs, not financial records.

'use client'

import { useCallback, useEffect, useState } from 'react'

export interface SavedScenario<TInput = Record<string, unknown>, TResult = Record<string, unknown>> {
  id: string
  toolSlug: string
  name: string
  input: TInput
  result: TResult
  createdAt: string
}

const STORAGE_KEY_PREFIX = 'finora:toolkit:'
const LEGACY_STORAGE_KEY_PREFIX = 'wealthos:toolkit:' // pre-rename key; migrated on first read so nobody loses saved scenarios

function storageKey(toolSlug: string) {
  return `${STORAGE_KEY_PREFIX}${toolSlug}`
}

function readAll<TInput, TResult>(toolSlug: string): SavedScenario<TInput, TResult>[] {
  if (typeof window === 'undefined') return []
  try {
    let raw = window.localStorage.getItem(storageKey(toolSlug))
    if (!raw) {
      const legacyKey = `${LEGACY_STORAGE_KEY_PREFIX}${toolSlug}`
      const legacy = window.localStorage.getItem(legacyKey)
      if (legacy) { // one-time move from the old product name's key
        window.localStorage.setItem(storageKey(toolSlug), legacy)
        window.localStorage.removeItem(legacyKey)
        raw = legacy
      }
    }
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll<TInput, TResult>(toolSlug: string, scenarios: SavedScenario<TInput, TResult>[]) {
  try {
    window.localStorage.setItem(storageKey(toolSlug), JSON.stringify(scenarios))
  } catch {
    // Storage full or unavailable — fail silently, this is a non-critical feature
  }
}

export function useToolkitHistory<TInput = Record<string, unknown>, TResult = Record<string, unknown>>(toolSlug: string) {
  const [scenarios, setScenarios] = useState<SavedScenario<TInput, TResult>[]>([])

  useEffect(() => {
    setScenarios(readAll<TInput, TResult>(toolSlug))
  }, [toolSlug])

  const save = useCallback((name: string, input: TInput, result: TResult) => {
    const next: SavedScenario<TInput, TResult> = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      toolSlug,
      name: name.trim() || `Scenario ${new Date().toLocaleDateString()}`,
      input,
      result,
      createdAt: new Date().toISOString(),
    }
    setScenarios(prev => {
      const updated = [next, ...prev].slice(0, 25) // cap history so storage never balloons
      writeAll(toolSlug, updated)
      return updated
    })
    return next
  }, [toolSlug])

  const remove = useCallback((id: string) => {
    setScenarios(prev => {
      const updated = prev.filter(s => s.id !== id)
      writeAll(toolSlug, updated)
      return updated
    })
  }, [toolSlug])

  const duplicate = useCallback((id: string) => {
    setScenarios(prev => {
      const target = prev.find(s => s.id === id)
      if (!target) return prev
      const copy: SavedScenario<TInput, TResult> = {
        ...target,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: `${target.name} (copy)`,
        createdAt: new Date().toISOString(),
      }
      const updated = [copy, ...prev].slice(0, 25)
      writeAll(toolSlug, updated)
      return updated
    })
  }, [toolSlug])

  const clear = useCallback(() => {
    setScenarios([])
    writeAll(toolSlug, [])
  }, [toolSlug])

  return { scenarios, save, remove, duplicate, clear }
}
