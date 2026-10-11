/**
 * The demo backend, assembled: core + every group's handlers. `@/lib/api`
 * imports this module, so all routes are registered before the first request.
 */
import { api, bus, resetDemo, roleHome, session, store } from './core'
import { registerAllHandlers } from './handlers'

registerAllHandlers()

export { api, bus, resetDemo, roleHome, session, store }
