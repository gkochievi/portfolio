/**
 * @portfolio/demo-kit — the shared seam for the backend-less portfolio demos.
 *
 * Styles ship separately: `import '@portfolio/demo-kit/demo-kit.css'` once,
 * in the demo's entry.
 */

// The mock backend
export {
  DemoApiError,
  notFound,
  forbidden,
  conflict,
  createMockApi,
  type FieldErrors,
  type FieldErrorInput,
  type HttpMethod,
  type DemoParams,
  type DemoRequest,
  type DemoHandler,
  type RouteOptions,
  type LatencyRange,
  type MockApiOptions,
  type DispatchOptions,
  type RouteInfo,
  type MockApi,
} from './mock/api'
export { createStore, type StoreOptions, type DemoStore } from './mock/store'
export { createEventBus, type EventBus, type BusListener, type EmitArgs } from './mock/events'
export { every, rebaseDates, type RebaseOptions } from './mock/clock'
export { createRandom, type Random } from './mock/random'

// Session, routing, locales
export {
  createSession,
  useSession,
  accountInitial,
  type DemoAccount,
  type DemoSession,
  type SessionOptions,
} from './session'
export { createDemoRouter, portfolioUrl, type DemoRouter, type DemoRouterOptions } from './router'
export { buildResources, type Lang, type LocaleResources } from './i18n'

// Chrome
export { DemoBar, BoulderMark, DEMO_BAR_STRINGS, type DemoBarProps, type DemoBarStrings } from './DemoBar'
export { DemoAccounts, type DemoAccountsProps, type DemoAccountsSlot } from './DemoAccounts'
