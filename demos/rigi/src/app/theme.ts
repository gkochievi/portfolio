/**
 * Theme state: light / dark / system, in memory only (a reload follows the OS
 * again). Applies class "dark" + data-theme on <html>. Owner: shell.
 */
import { useSyncExternalStore } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
let mode: ThemeMode = 'system'
const listeners = new Set<() => void>()

function resolve(): ResolvedTheme {
  if (mode === 'system') return media?.matches ? 'dark' : 'light'
  return mode
}

function apply(): void {
  const theme = resolve()
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset.theme = theme
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121316' : '#F4F4F0')
}

function emit(): void {
  apply()
  listeners.forEach((l) => l())
}

media?.addEventListener('change', () => {
  if (mode === 'system') emit()
})

if (typeof document !== 'undefined') apply()

export function setThemeMode(next: ThemeMode): void {
  mode = next
  emit()
}

export function toggleTheme(): void {
  setThemeMode(resolve() === 'dark' ? 'light' : 'dark')
}

let snapshot = `${mode}:${resolve()}`
function getSnapshot(): string {
  const next = `${mode}:${resolve()}`
  if (next !== snapshot) snapshot = next
  return snapshot
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme(): { mode: ThemeMode; resolved: ResolvedTheme; setMode: (m: ThemeMode) => void; toggle: () => void } {
  const snap = useSyncExternalStore(subscribe, getSnapshot)
  const [m, r] = snap.split(':') as [ThemeMode, ResolvedTheme]
  return { mode: m, resolved: r, setMode: setThemeMode, toggle: toggleTheme }
}
