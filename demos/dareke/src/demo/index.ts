/**
 * The mock backend, wired: store + session + API +
 * handlers + simulators. Importing this module boots the demo once.
 */
import { createMockApi } from '@portfolio/demo-kit'

import { bus, startTabSync } from './bus'
import { registerAllHandlers } from './handlers'
import { startAutoDialer } from './sim/autoDialer'
import { startFloorSimulator } from './sim/floor'
import { startOperatorEngine } from './sim/operator'
import { currentUser, session, store } from './store'

export { accounts, accountNameKa, DEMO_PASSWORD, roleHome } from './accounts'
export { bus, currentUser, session, store }

export const api = createMockApi({
  prefix: '/api',
  isAuthenticated: () => session.current() !== null,
  // Only signing in is public; /auth/me and the rest need a session.
  publicPrefixes: ['/auth/login'],
  latency: { read: [150, 320], write: [200, 400] },
})

registerAllHandlers(api)

startTabSync()
startOperatorEngine()
startFloorSimulator()
startAutoDialer()

/** The DemoBar's "Reset demo data": a fresh seed relative to now; simulators drop their timers on 'demo:reset'. */
export function resetDemo(): void {
  store.reset()
  bus.emit('demo:reset')
  bus.emit('data:changed', {
    scopes: ['me', 'agents', 'calls', 'campaigns', 'numbers', 'users', 'statuses', 'dispositions', 'dnc', 'settings', 'config', 'dialer', 'metrics', 'reports'],
  })
}
