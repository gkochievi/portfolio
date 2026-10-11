/**
 * The demo database and its reset. The store itself is created in `core.ts`
 * (`createStore(seed, { prepare })`: seed -> rebased dates -> generated usage
 * rows); this module is the stable name for it plus `resetDemo()`.
 */
import { DEFAULT_TENANT_ID } from './accounts'
import { setActingTenantId } from './context'
import { bus, store } from './core'

export { store }
export { SEED_DATE, seed } from './seed'

let epoch = 0

/**
 * Bumps on every `resetDemo()`. A timer started before a reset (an analyser
 * run, an import, a re-embed) compares the epoch it captured with this one and
 * drops its write, so it never lands on the fresh copy.
 */
export const demoEpoch = (): number => epoch

/**
 * Put the pristine seed back: fresh data (dates rebased to now, usage rows
 * regenerated), the operator acting as the default workspace again, and a nudge
 * to every screen that listens on the bus. The session is left alone; the
 * caller decides whether to sign out. The caller also clears the query cache.
 */
export function resetDemo(): void {
  epoch += 1
  store.reset()
  setActingTenantId(DEFAULT_TENANT_ID)
  for (const tenant of store.data.tenants) {
    bus.emit('kb:changed', { client_id: tenant.id })
    bus.emit('curation:changed', { client_id: tenant.id })
  }
  bus.emit('bot:kill-changed', { state: store.data.killState })
  bus.emit('usage:appended', { count: 0 })
}
