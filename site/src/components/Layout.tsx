import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Mail } from 'lucide-react'

import { COMPANY, EMAIL, LOCATION, MAILTO } from '@/config'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

/** A route change lands at the top — instantly: the html `scroll-behavior:
 *  smooth` would otherwise animate the new page up from the old offset. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-[var(--page)]/85 backdrop-blur-xl">
      <div className="shell flex h-16 items-center justify-between gap-4 sm:h-20">
        <Link to="/" aria-label={`${COMPANY} — home`} className="flex items-center">
          <Logo className="h-6 w-auto sm:h-7" />
        </Link>
        <div className="flex items-center gap-3">
          <a
            href={MAILTO}
            className="hidden items-center gap-2 text-body font-semibold text-ink/70 transition-colors duration-300 ease-bounce hover:text-accent-text sm:inline-flex"
          >
            <Mail className="size-4" aria-hidden />
            Get in touch
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-hairline">
      <div className="shell flex flex-col gap-3 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-small text-ink/60">
          © {new Date().getFullYear()} {COMPANY} · {LOCATION}
        </p>
        <a
          href={MAILTO}
          className="text-small font-semibold text-accent-text transition-opacity duration-300 ease-bounce hover:opacity-70"
        >
          {EMAIL}
        </a>
      </div>
    </footer>
  )
}

export function SiteLayout() {
  return (
    <div className="flex min-h-screen flex-col">
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
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to the work
      </a>
      <SiteHeader />
      <main id="work" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
