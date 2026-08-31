import type { ReactNode } from 'react'
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'

import { SiteLayout } from '@/components/Layout'
import { PortalPage } from '@/pages/PortalPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

/**
 * `BASE_URL` is the deploy base baked in by `VITE_BASE`, so the router and
 * every demo link relocate together when the site moves under a subpath.
 *
 * `VITE_ROUTER=hash` swaps in the hash router — the escape hatch for a host
 * that cannot serve index.html for an unknown path. It carries its own base in
 * the fragment, so it takes no basename; the demos do exactly the same.
 */
function SiteRouter({ children }: { children: ReactNode }) {
  if (__SITE_ROUTER__ === 'hash') return <HashRouter>{children}</HashRouter>
  return <BrowserRouter basename={import.meta.env.BASE_URL}>{children}</BrowserRouter>
}

/**
 * The portal has exactly one route. Case-study pages were removed when it
 * became a portal: a card now opens the product itself, and a write-up in
 * between was one more click before the thing that actually demonstrates the
 * work. The project copy that fed those pages still lives in
 * `content/projects.json` if it is ever wanted back.
 */
export function App() {
  return (
    <SiteRouter>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<PortalPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </SiteRouter>
  )
}
