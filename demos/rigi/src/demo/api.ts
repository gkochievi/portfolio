/**
 * The mock backend: demo-kit's `createMockApi` with every handler module
 * registered. Owner: data core.
 *
 * Paths are matched without the `/api` prefix. A request is authenticated when
 * a persona is signed in (the five demo accounts, `accounts.ts`); the only
 * public routes are the sign-in family below. Role checks live in the handlers
 * (`requireStaff`, `requirePartnerAdmin` from `./ctx`).
 */
import { createMockApi } from '@portfolio/demo-kit'

import { registerHandlers } from './handlers'
import { session } from './runtime'

/** Routes reachable while signed out: staff + portal sign-in, `me`, forgot/reset password. */
export const PUBLIC_PREFIXES = ['/auth/', '/portal/auth/'] as const

export const mockApi = createMockApi({
  prefix: '/api',
  isAuthenticated: () => session.current() !== null,
  publicPrefixes: PUBLIC_PREFIXES,
})

registerHandlers(mockApi)
