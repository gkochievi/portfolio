import type { ReactNode } from 'react'
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'

import { SiteLayout } from '@/components/Layout'
import { PortalPage } from '@/pages/PortalPage'
import { ProjectPage } from '@/pages/ProjectPage'
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
 * Two routes: the grid, and one project.
 *
 * The grid used to link straight into a demo bundle. It no longer does — a
 * visitor dropped into someone else's dispatch console cannot tell what the
 * product is for or which parts were hard, so `/work/<slug>` says that first
 * and the demo is a button on it. The copy those pages need was already in
 * `content/projects.json`, written for the case studies an earlier version of
 * this portal removed.
 *
 * `work/:slug` is declared before the catch-all, and an unknown slug renders
 * the 404 page from inside the route rather than redirecting — see
 * `ProjectPage`.
 */
export function App() {
  return (
    <SiteRouter>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<PortalPage />} />
          <Route path="work/:slug" element={<ProjectPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </SiteRouter>
  )
}
