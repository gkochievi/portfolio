import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { createDemoRouter } from '@portfolio/demo-kit'

import '@/styles/index.css'
import '@/i18n'
import '@/demo'
import { DemoChrome } from '@/app/DemoChrome'
import { queryClient } from '@/lib/queryClient'
import { routes } from '@/routes'

const router = createDemoRouter(routes, {
  mode: import.meta.env.VITE_ROUTER,
  baseUrl: import.meta.env.BASE_URL,
})

const container = document.getElementById('root')
if (!container) throw new Error('Dareke mount point #root is missing')

// Clear the boot splash before React takes over.
container.replaceChildren()

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <DemoChrome router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
