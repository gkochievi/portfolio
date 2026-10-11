/**
 * The mock backend, wired: singletons + every group's handler module.
 * Add nothing here except exports; new handler files go in `handlers/index.ts`.
 */
import './handlers'

export { api, bus, session, store } from './core'
export { api as mockApi } from './api'
export { bus as events } from './events'
export { resetDemo, demoEpoch } from './store'
export { FIRST_LOAD, homeFor, roleHome } from './session'
export { getActingTenantId, setActingTenantId } from './context'
export { accounts, DEMO_PASSWORD, DEFAULT_TENANT_ID } from './accounts'
