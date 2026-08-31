import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@/styles/theme.css'
import '@/i18n'
import { App } from './App'

const container = document.getElementById('root')
if (!container) throw new Error('Console mount point #root is missing')

// Clear the server-rendered boot splash before React takes over.
container.replaceChildren()

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
