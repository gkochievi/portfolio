/** The demo backend: importing this registers every handler. UI code goes through `@/lib/api`. */
import './handlers'

export { api } from './api'
export { auth, useAuthUserId } from './auth'
export { bus, store } from './store'
export { DEMO_ACCOUNTS, DEMO_OTP, DEMO_PASSWORD } from './seed/accounts'
export { startSimulators } from './simulators'
