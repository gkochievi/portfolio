/**
 * Light / dark theme. Follows the OS (`prefers-color-scheme`) until the
 * visitor picks a theme in a header toggle; the choice lives in memory only
 * (a reload follows the OS again). Applies class "dark" on <html>.
 * Owner: design-system agent.
 */
import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

let choice: Theme | null = null
let started = false
const listeners = new Set<() => void>()

function media(): MediaQueryList | null {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null
}

function resolved(): Theme {
  if (choice) return choice
  return media()?.matches ? 'dark' : 'light'
}

function apply(): void {
  const theme = resolved()
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  for (const listener of [...listeners]) listener()
}

/** Call once at boot (src/main.tsx). */
export function initTheme(): void {
  if (started) return
  started = true
  apply()
  media()?.addEventListener('change', () => {
    if (!choice) apply()
  })
}

export function setTheme(theme: Theme): void {
  choice = theme
  apply()
}

export function toggleTheme(): void {
  setTheme(resolved() === 'dark' ? 'light' : 'dark')
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The active theme, re-rendering on change. */
export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, resolved, () => 'light' as Theme)
  return { theme, setTheme, toggle: toggleTheme }
}
