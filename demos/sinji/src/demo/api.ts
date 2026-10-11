/**
 * The mock API instance (`createMockApi` in `core.ts`: prefix `/api`, public
 * prefixes `/auth/` and `/public/`, 401 without a session). Handler modules
 * register routes on it; UI code never calls it directly (it goes through
 * `@/lib/api` or `@/api/client`).
 */
import { api } from './core'

export { api, api as mockApi }
