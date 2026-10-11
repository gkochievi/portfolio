/**
 * The app's data router. Honours VITE_BASE (via BASE_URL) and VITE_ROUTER=hash.
 * Owner: shell. Import `router` to navigate from outside React (demo bar).
 */
import { createDemoRouter } from '@portfolio/demo-kit'

import { routes } from '@/routes'

export const router = createDemoRouter(routes, {
  mode: import.meta.env.VITE_ROUTER,
  baseUrl: import.meta.env.BASE_URL,
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
})
