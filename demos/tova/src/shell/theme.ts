/**
 * Light/dark theme: the class "dark" on <html>. Follows the OS until the
 * visitor picks one; the choice lives in memory only (a reload follows the
 * OS again). Imported once by main.tsx so the class is set before paint.
 */
import { useSyncExternalStore } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const query = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null

let choice: ThemeChoice = 'system'
const listeners = new Set<() => void>()

function resolve(): ResolvedTheme {
  if (choice !== 'system') return choice
  return query?.matches ? 'dark' : 'light'
}

function apply(): void {
  const resolved = resolve()
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', resolved === 'dark' ? '#071B20' : '#0A6F94')
  for (const listener of [...listeners]) listener()
}

query?.addEventListener('change', () => {
  if (choice === 'system') apply()
})

apply()

export function setTheme(next: ThemeChoice): void {
  choice = next
  apply()
}

/** Flip to the opposite of what is showing now (becomes an explicit choice). */
export function toggleTheme(): void {
  setTheme(resolve() === 'dark' ? 'light' : 'dark')
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, resolve, () => 'light')
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, () => choice, () => 'system')
}
