/**
 * The demo backend's core: store, session, mock API and event bus.
 * Handlers import from here (never from '@/demo', which imports the handlers).
 */
import {
  createEventBus,
  createMockApi,
  createSession,
  createStore,
  DemoApiError,
  forbidden,
  rebaseDates,
  type DemoParams,
} from '@portfolio/demo-kit'

import { firstAllowedPath, roleCan } from '@/lib/rbac'
import type { DemoDb, DemoEvents, FeatureKey, Paged, Persona, RoleId } from '@/types'
import { refreshDerived, seed, SEED_ANCHOR } from './seed'
import { personas } from './seed/personas'

/**
 * The working copy. Each fresh copy (boot and every reset) is rebased onto
 * "now", then date-bearing strings (recording file names, archive folders) are
 * re-derived so they agree with the shifted timestamps.
 */
export const store = createStore<DemoDb>(seed, {
  prepare: (copy) => {
    const now = new Date()
    rebaseDates(copy, { anchor: SEED_ANCHOR, now })
    return refreshDerived(copy, now.getTime() - Date.parse(SEED_ANCHOR))
  },
})

/** A fresh tab starts signed in as the superadmin. */
export const session = createSession<Persona>(personas, { initial: personas[0]?.id ?? null })

export const bus = createEventBus<DemoEvents>()

/** Restore the pristine seed (rebased onto now) and tell simulators to drop job state. */
export function resetDemo(): void {
  store.reset()
  bus.emit('demo:reset')
}

/** Where each role lands after sign-in or a persona switch (RBAC overrides applied). */
export function roleHome(role: RoleId): string {
  return firstAllowedPath(role, store.data.rbacOverrides)
}

export const api = createMockApi({
  prefix: '/api',
  isAuthenticated: session.isSignedIn,
  // Internal console: the only unauthenticated surface is sign-in and sign-out.
  publicPrefixes: ['/auth/'],
  latency: { read: [120, 380], write: [200, 520] },
})

export function currentPersona(): Persona {
  const persona = session.current()
  if (!persona) throw new DemoApiError(401, 'Authentication credentials were not provided.')
  return persona
}

/** The signed-in persona, or a 403 when its role lacks `feature` (overrides applied). */
export function requireFeature(feature: FeatureKey): Persona {
  const persona = currentPersona()
  if (!roleCan(persona.role, feature, store.data.rbacOverrides)) throw forbidden()
  return persona
}

export function requireRole(...roles: RoleId[]): Persona {
  const persona = currentPersona()
  if (!roles.includes(persona.role)) throw forbidden()
  return persona
}

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Uniform random integer in [min, max]; for latency only, never for seed data. */
export function jitter(min: number, max: number): number {
  return min + Math.round(Math.random() * (max - min))
}

export const nowIso = (): string => new Date().toISOString()

/** Slice a list by `?page=1&pageSize=50`. */
export function paginate<T>(items: readonly T[], params: DemoParams, defaultPageSize = 50): Paged<T> {
  const pageSize = Math.min(500, Math.max(1, Number(params.pageSize) || defaultPageSize))
  const page = Math.max(1, Number(params.page) || 1)
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
    hasMore: start + pageSize < items.length,
  }
}
