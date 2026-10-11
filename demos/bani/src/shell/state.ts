/**
 * Shell state that lives only in memory: theme choice (follows the OS until the
 * visitor picks one), persona switching and the demo reset.
 */
import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'

import { bus, session, store } from '@/demo'
import i18n from '@/i18n'
import { firstAllowedPath } from '@/lib/rbac'
import { queryClient } from '@/lib/queryClient'
import type { Lang } from '@/types'

/* -------------------------------------------------------------------- theme */

export type Theme = 'light' | 'dark'

let chosen: Theme | null = null
const listeners = new Set<() => void>()
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function resolvedTheme(): Theme {
  return chosen ?? (media?.matches ? 'dark' : 'light')
}

function applyTheme(): void {
  const theme = resolvedTheme()
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  for (const l of listeners) l()
}

media?.addEventListener('change', () => {
  if (!chosen) applyTheme()
})
if (typeof document !== 'undefined') applyTheme()

export function setTheme(theme: Theme): void {
  chosen = theme
  applyTheme()
}

export function toggleTheme(): void {
  setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark')
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    resolvedTheme,
    () => 'light',
  )
}

/* --------------------------------------------------------------------- lang */

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      i18n.on('languageChanged', cb)
      return () => i18n.off('languageChanged', cb)
    },
    () => (i18n.language === 'ka' ? 'ka' : 'en'),
    () => 'en',
  )
}

/* ------------------------------------------------------- personas and reset */

type Navigate = (to: string, opts?: { replace?: boolean }) => unknown

/** Sign in as another persona and land on its first allowed route. */
export function switchPersona(id: string, navigate: Navigate, opts: { announce?: boolean } = {}): void {
  const persona = session.accounts.find((p) => p.id === id)
  if (!persona) return
  session.signIn(id)
  bus.emit('session:changed')
  // Reset (not clear) so mounted observers such as ['me'] refetch for the new persona.
  void queryClient.resetQueries()
  void navigate(firstAllowedPath(persona.role, store.data.rbacOverrides), { replace: true })
  if (opts.announce !== false) {
    const name = i18n.language === 'ka' ? persona.nameKa : persona.name
    toast.success(i18n.t('shell:header.switched', { name }))
  }
}

export function signOut(navigate: Navigate): void {
  session.signOut()
  queryClient.clear()
  bus.emit('session:changed')
  void navigate('/login', { replace: true })
}

/** Restore the pristine seed without a reload. */
export function resetDemo(): void {
  store.reset()
  bus.emit('demo:reset')
  void queryClient.resetQueries()
}
