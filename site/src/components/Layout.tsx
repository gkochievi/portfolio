import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { useLang } from '@/i18n/LanguageContext'
// The chrome's stylesheets, in boulder.ge's cascade order (styles/index.css).
// motion.css is not here: main.tsx loads it after everything else.
import '@/styles/header.css'
import '@/styles/controls.css'
import '@/styles/footer.css'
import Footer from './Footer'
import Header from './Header'
import { PageBackground } from './PageBackground'
import SparkCanvas from './SparkCanvas'

/**
 * A route change lands at the top — instantly: the html `scroll-behavior:
 * smooth` would otherwise animate the new page up from the old offset.
 *
 * It also moves focus, which scrolling alone does not. A client-side
 * navigation replaces everything inside `<main>` without a document load, so
 * the anchor that was focused is destroyed, focus falls back to `<body>`, and
 * assistive tech is told nothing at all — no title, no heading, no
 * announcement. Focusing the container puts the screen-reader cursor at the top
 * of the new page and makes the next Tab continue from there rather than from
 * the start of the document.
 *
 * Skipped on the first mount: a fresh page load already starts at the top with
 * focus where the browser wants it, and stealing it there would suppress the
 * skip link.
 */
function ScrollToTop() {
  const { pathname } = useLocation()
  const first = useRef(true)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (first.current) {
      first.current = false
      return
    }
    // `<main>` carries tabIndex={-1} for exactly this, and `outline-none`
    // keeps the ring off a container the user never reached by keyboard.
    document.getElementById('work')?.focus()
  }, [pathname])

  return null
}

/**
 * boulder.ge's app shell (App.jsx), as one layout route around every page:
 *
 *   .app
 *     SparkCanvas      the click burst, one canvas for the whole document
 *     Header           fixed, laid over the page
 *     main.page        the dot grid and the side boulder, then the route
 *     Footer           AFTER `.page`, not inside it — the rock is sized from
 *                      `.page`'s height, and a footer inside would stretch it
 *                      past where the design puts it
 *
 * The pages render no `<main>` of their own; they start with a `.section`,
 * which clears the fixed header itself (boulder.css).
 */
export function SiteLayout() {
  const { t } = useLang()

  return (
    <div className="app">
      <SparkCanvas />
      <ScrollToTop />
      {/* JS-driven rather than a fragment link: under VITE_ROUTER=hash the
          fragment would be read as a route ("#work" → /work) and land on the
          404 page instead of skipping. */}
      <a
        href="#work"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('work')?.focus()
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-surface focus:px-4 focus:py-2 focus:font-bold focus:text-ink"
      >
        {t('a11y.skip')}
      </a>
      <Header />
      <main id="work" tabIndex={-1} className="page outline-none">
        <PageBackground />
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
