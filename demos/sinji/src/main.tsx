import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'

import '@fontsource-variable/newsreader/opsz.css'
import '@fontsource-variable/newsreader/opsz-italic.css'
import '@fontsource-variable/hanken-grotesk/index.css'
import '@fontsource-variable/noto-sans-georgian/index.css'
import '@fontsource-variable/noto-serif-georgian/index.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import '@portfolio/demo-kit/demo-kit.css'
import '@/styles/index.css'
import '@/i18n'
import '@/components/shell/theme'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/router'

const container = document.getElementById('root')
if (!container) throw new Error('Mount point #root is missing')

// Clear the static boot splash before React takes over.
container.replaceChildren()

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
