import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createDemoRouter } from '@portfolio/demo-kit'

import '@portfolio/demo-kit/demo-kit.css'
import '@/styles/index.css'
import '@/i18n'
import { queryClient } from '@/lib/queryClient'
import { routes } from '@/routes'
import { AppChrome } from '@/shell/AppChrome'

const router = createDemoRouter(routes, {
  mode: import.meta.env.VITE_ROUTER,
  baseUrl: import.meta.env.BASE_URL,
})

const container = document.getElementById('root')
if (!container) throw new Error('Mount point #root is missing')

// Clear the boot splash before React takes over.
container.replaceChildren()

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppChrome router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
