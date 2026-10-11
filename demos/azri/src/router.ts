import { createDemoRouter } from '@portfolio/demo-kit'

import { routes } from '@/routes'

/** Browser router under BASE_URL, or the hash router when VITE_ROUTER=hash. */
export const router = createDemoRouter(routes, {
  mode: import.meta.env.VITE_ROUTER,
  baseUrl: import.meta.env.BASE_URL,
})
