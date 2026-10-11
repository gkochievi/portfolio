/**
 * seed -> store -> API -> handlers. Owner: data core.
 * The UI never imports this directly; it goes through `@/lib/api`
 * (or `@/api/client`, which wraps it).
 */
export { bus, session, store } from './runtime'
export { mockApi, mockApi as api, PUBLIC_PREFIXES } from './api'
export { resetDemo } from './store'
export { homeFor, INITIAL_HOME, roleHome } from './session'
