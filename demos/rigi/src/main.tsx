import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'

import '@fontsource-variable/schibsted-grotesk'
import '@fontsource-variable/instrument-sans'
import '@fontsource-variable/noto-sans-georgian'
import '@fontsource-variable/jetbrains-mono'
import '@portfolio/demo-kit/demo-kit.css'
import '@/styles/index.css'
import '@/i18n'
import '@/app/theme'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/router'

const container = document.getElementById('root')
if (!container) throw new Error('Rigi mount point #root is missing')

// Clear the boot splash before React takes over.
container.replaceChildren()

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>
  </StrictMode>,
)
