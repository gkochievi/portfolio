/**
 * Light / dark theme. Follows the OS until the visitor picks one; the choice
 * lives in memory only (a reload follows the OS again). Applies class `dark`
 * and data-theme on <html>.
 */
import { useSyncExternalStore } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'

let choice: ThemeChoice = 'system'
const listeners = new Set<() => void>()
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function resolvedTheme(): 'light' | 'dark' {
  if (choice !== 'system') return choice
  return media?.matches ? 'dark' : 'light'
}

function apply(): void {
  const dark = resolvedTheme() === 'dark'
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.setAttribute('data-theme', dark ? 'dark' : 'light')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#12110f' : '#f4f0e6')
  for (const listener of [...listeners]) listener()
}

export function setTheme(next: ThemeChoice): void {
  choice = next
  apply()
}

export function toggleTheme(): void {
  setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark')
}

media?.addEventListener?.('change', () => {
  if (choice === 'system') apply()
})

if (typeof document !== 'undefined') apply()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Current resolved theme + the visitor's choice. */
export function useTheme(): { theme: 'light' | 'dark'; choice: ThemeChoice } {
  const theme = useSyncExternalStore(subscribe, resolvedTheme, resolvedTheme)
  return { theme, choice }
}
