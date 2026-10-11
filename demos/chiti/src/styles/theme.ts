/**
 * Colour-scheme store (in memory only - nothing is persisted).
 * Follows the OS until the visitor picks light or dark; toggles `dark` on <html>.
 */
import { useSyncExternalStore } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
let choice: ThemeChoice = 'system'
const listeners = new Set<() => void>()

function resolve(): ResolvedTheme {
  if (choice === 'system') return media?.matches ? 'dark' : 'light'
  return choice
}

function apply() {
  const resolved = resolve()
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#13130D' : '#FBF7EE')
  listeners.forEach((l) => l())
}

media?.addEventListener('change', () => {
  if (choice === 'system') apply()
})
if (typeof document !== 'undefined') apply()

export function setTheme(next: ThemeChoice): void {
  choice = next
  apply()
}

/** Flip between light and dark (leaves "system" mode). */
export function toggleTheme(): void {
  setTheme(resolve() === 'dark' ? 'light' : 'dark')
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, () => choice)
}

export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, resolve)
}
