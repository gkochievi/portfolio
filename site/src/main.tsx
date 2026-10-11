import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Tailwind, the boulder.ge tokens, the page shell and the base layer — first,
// so component stylesheets imported further down the tree come after it.
import '@/styles/boulder.css'
import { App } from './App'
// Last on purpose: its reduced-motion rules cancel transitions that component
// stylesheets declare, and only source order lets them win.
import '@/styles/motion.css'

const container = document.getElementById('root')
if (!container) throw new Error('Site mount point #root is missing')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
