/**
 * Pending (not yet applied) roster edits, kept per skill so they survive tab and skill switches.
 * An override maps userId -> desired level, or null for "not staffed". Overrides equal to the
 * server baseline are dropped, so `Object.keys(draft)` is exactly the set of changed rows.
 */
import { useCallback, useState } from 'react'

export type RosterOverrides = Record<string, number | null>

export interface RosterEdit {
  userId: string
  /** Level on the server today (undefined = not staffed). */
  base: number | undefined
  /** Desired level, null = not staffed. */
  desired: number | null
}

export interface RosterDraft {
  get: (skillId: string) => RosterOverrides
  edit: (skillId: string, edits: RosterEdit[]) => void
  reset: (skillId: string) => void
  replace: (skillId: string, overrides: RosterOverrides) => void
}

export function useRosterDraft(): RosterDraft {
  const [drafts, setDrafts] = useState<Record<string, RosterOverrides>>({})

  const get = useCallback((skillId: string): RosterOverrides => drafts[skillId] ?? EMPTY, [drafts])

  const edit = useCallback((skillId: string, edits: RosterEdit[]) => {
    setDrafts((prev) => {
      const next = { ...(prev[skillId] ?? {}) }
      for (const e of edits) {
        if (e.desired === (e.base ?? null)) delete next[e.userId]
        else next[e.userId] = e.desired
      }
      return { ...prev, [skillId]: next }
    })
  }, [])

  const reset = useCallback((skillId: string) => setDrafts((prev) => ({ ...prev, [skillId]: {} })), [])
  const replace = useCallback((skillId: string, overrides: RosterOverrides) => setDrafts((prev) => ({ ...prev, [skillId]: overrides })), [])

  return { get, edit, reset, replace }
}

const EMPTY: RosterOverrides = {}
