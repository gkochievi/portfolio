import { createDemoRouter } from '@portfolio/demo-kit'

import { routes } from '@/routes'

/**
 * The demo's data router. Honours `VITE_ROUTER=hash` and the build's base
 * path. Inside components prefer `useNavigate()`; this export is for
 * non-component code (e.g. a forced logout pushed by the mock server).
 */
export const router = createDemoRouter(routes, {
  mode: import.meta.env.VITE_ROUTER,
  baseUrl: import.meta.env.BASE_URL,
})
