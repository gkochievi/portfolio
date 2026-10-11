import { createDemoRouter } from '@portfolio/demo-kit'

import { routes } from '@/routes'

/** The app's data router (browser router under BASE_URL, or hash router with VITE_ROUTER=hash). */
export const router = createDemoRouter(routes, {
  mode: import.meta.env.VITE_ROUTER,
  baseUrl: import.meta.env.BASE_URL,
})
