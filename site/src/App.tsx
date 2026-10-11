import type { ReactNode } from 'react'
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'

import { LanguageProvider } from '@/i18n/LanguageContext'
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
 * The same three routes twice: English at the root, Georgian under `/ka` —
 * boulder.ge's scheme, so each language is an address of its own. The pages
 * never read the prefix; `LanguageProvider` takes the language from the
 * location and every page asks `useLang()`.
 *
 * `/ka/<anything unknown>` is the Georgian 404 rather than the English one,
 * which is why `ka` carries its own catch-all. An unknown slug renders the
 * 404 page from inside the project route rather than redirecting — see
 * `ProjectPage`.
 *
 * The shell — `.app`, the header, `main.page` with the dot grid and the side
 * boulder, the footer — is boulder.ge's, and lives in the layout route
 * (`SiteLayout`), so it is drawn once around every page, the 404 included.
 */
export function App() {
  return (
    <SiteRouter>
      <LanguageProvider>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<PortalPage />} />
            <Route path="work/:slug" element={<ProjectPage />} />
            <Route path="ka">
              <Route index element={<PortalPage />} />
              <Route path="work/:slug" element={<ProjectPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </LanguageProvider>
    </SiteRouter>
  )
}
