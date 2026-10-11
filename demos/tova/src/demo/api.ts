/** The mock backend instance. Handlers register on it from `handlers/*.ts`. */
import { createMockApi } from '@portfolio/demo-kit'

import { auth } from './auth'

/**
 * Routes are protected by default (401 when signed out). Public routes pass
 * `{ requiresAuth: false }` to `register` (events/current, leaderboard,
 * prizes); everything under `/auth/` is public by prefix.
 */
export const api = createMockApi({ prefix: '/api', isAuthenticated: auth.isSignedIn })
