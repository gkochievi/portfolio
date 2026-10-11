/**
 * Light/dark theme. Follows the OS until the visitor picks one;
 * the choice lives in memory only (a reload follows the OS again).
 * Applies both `class="dark"` and `data-theme` on <html>.
 */
import { useSyncExternalStore } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

let choice: ThemeChoice = 'system'
const listeners = new Set<() => void>()

const media: MediaQueryList | null =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function resolve(): ResolvedTheme {
  if (choice !== 'system') return choice
  return media?.matches ? 'dark' : 'light'
}

let resolved: ResolvedTheme = resolve()

function apply() {
  resolved = resolve()
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
  listeners.forEach((l) => l())
}

media?.addEventListener?.('change', () => {
  if (choice === 'system') apply()
})

if (typeof document !== 'undefined') apply()

export function setTheme(next: ThemeChoice): void {
  choice = next
  apply()
}

export function toggleTheme(): void {
  setTheme(resolved === 'dark' ? 'light' : 'dark')
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The theme in effect ('light' | 'dark'). */
export function useTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, () => resolved, () => 'light')
}
