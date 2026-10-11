/**
 * The mock backend. Handler modules (`./handlers/*.ts`) register routes
 * WITHOUT the `/api` prefix: `api.register('GET', '/operator/inbox', …)`.
 * Routes under `publicPrefixes` work signed out (the widget, login, demo knobs).
 */
import { createMockApi, type MockApi } from '@portfolio/demo-kit'

import { session } from './session'

export const PUBLIC_PREFIXES = ['/widget/', '/auth/login', '/demo/'] as const

export const api: MockApi = createMockApi({
  prefix: '/api',
  isAuthenticated: () => session.current() !== null,
  publicPrefixes: PUBLIC_PREFIXES,
})
