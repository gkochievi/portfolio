/**
 * English glosses for Georgian content (demo aid). When the UI is English and
 * the gloss toggle is on, `pick(ka, en)` returns the English text if present.
 * The toggle lives in memory (shell renders it in the top bar). Shared helper.
 */
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

let enabled = true
const listeners = new Set<() => void>()

export function setGlossEnabled(next: boolean): void {
  if (next === enabled) return
  enabled = next
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const read = () => enabled

export function useGloss(): { enabled: boolean; active: boolean; pick: (text: string, en?: string | null) => string } {
  const on = useSyncExternalStore(subscribe, read, read)
  const { i18n } = useTranslation()
  const active = on && i18n.language === 'en'
  return { enabled: on, active, pick: (text, en) => (active && en ? en : text) }
}
