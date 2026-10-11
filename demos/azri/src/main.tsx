import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'

// Fonts (bundled; no network): Fraunces with SOFT/WONK/opsz axes, Figtree,
// the two Georgian Noto families and JetBrains Mono.
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/figtree'
import '@fontsource-variable/noto-sans-georgian'
import '@fontsource-variable/noto-serif-georgian'
import '@fontsource-variable/jetbrains-mono'
import '@portfolio/demo-kit/demo-kit.css'
import '@/styles/index.css'
import '@/i18n'
import { bootDemo } from '@/demo'
import { queryClient } from '@/lib/queryClient'
import { connectRealtime } from '@/lib/realtime'
import { router } from '@/router'
import { DemoChrome } from '@/components/layout/DemoChrome'
import { Toaster } from '@/components/ui/Feedback'
import { initTheme } from '@/components/ui/theme'

initTheme()
bootDemo()
connectRealtime(queryClient)

const container = document.getElementById('root')
if (!container) throw new Error('Mount point #root is missing')

// Clear the static boot splash before React takes over.
container.replaceChildren()

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
      <DemoChrome />
    </QueryClientProvider>
  </StrictMode>,
)
