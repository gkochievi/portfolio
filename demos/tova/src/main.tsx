import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { createDemoRouter } from '@portfolio/demo-kit'

import '@portfolio/demo-kit/demo-kit.css'
import '@/styles/index.css'
import '@/shell/theme'
import '@/i18n'
import { startSimulators } from '@/demo'
import { queryClient } from '@/lib/queryClient'
import { routes } from '@/routes'

const router = createDemoRouter(routes, {
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

startSimulators()

const container = document.getElementById('root')
if (!container) throw new Error('Mount point #root is missing')

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>
  </StrictMode>,
)
