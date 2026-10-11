/**
 * The demo database and its reset. Owner: data core.
 *
 * The store is built in `./runtime` (seed -> `createStore`), kept there so
 * handler modules can import it without a cycle. It lives in memory only:
 * a page reload restores the pristine seed, `resetDemo()` does the same
 * without the reload.
 */
import { CHANGED_ENTITIES } from './events'
import { bus, store } from './runtime'

export { store }

/**
 * Throw away every change and regenerate the seed relative to "now" (the
 * store's `prepare` hook rebuilds it), then tell the UI to refetch everything.
 * The signed-in persona is left as it is.
 */
export function resetDemo(): void {
  store.reset()
  bus.emit('changed', { entities: [...CHANGED_ENTITIES] })
}
