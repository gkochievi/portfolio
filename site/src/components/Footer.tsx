import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { EMAIL, MAILTO } from '@/config'
import { useLang } from '@/i18n/LanguageContext'
import { HoverMarker, NavUnderline } from './NavPill'
import {
  CHROME_COPY,
  FOOTER_SOCIALS,
  NAV_ITEMS,
  boulderHref,
  isModifiedClick,
  samePath,
  scrollToTop,
} from './chromeCopy'

// boulder.ge's footer (components/Footer.jsx), compact: the navy slab with a
// lowercase display line and a bracketed indigo line under it, the email
// with the nav's hand-drawn squiggle, the header's items in the header's
// order, the legal line and "back to top", and the BOULDER stamp — indigo
// with its coral copy printed over it — cut off by the slab's bottom edge.
//
// Chrome, like the header, so nothing in it reveals. Every link wears the
// nav's coral highlighter swatch on hover and focus (footer.css).

// The nav pill's hover accent, shared by every footer link: the coral swatch
// grows in behind the label, and footer.css flips the label to navy so it
// stays readable on coral.
function MarkedLabel({ children }: { children: ReactNode }) {
  return (
    <span className="site-footer__label-wrap">
      <span className="site-footer__marker" aria-hidden="true">
        <HoverMarker />
      </span>
      <span className="site-footer__label">{children}</span>
    </span>
  )
}

export default function Footer() {
  const { lang, href } = useLang()
  const { pathname } = useLocation()
  const copy = CHROME_COPY[lang]
  const year = new Date().getFullYear()
  const portalHome = href('/')
  const onPortalHome = samePath(pathname, portalHome)
  // Only real addresses: see FOOTER_SOCIALS.
  const socials = FOOTER_SOCIALS.filter((social) => /^https?:\/\//.test(social.href))

  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div className="site-footer__lead">
          <p className="site-footer__title">{copy.footer.title}</p>
          <p className="site-footer__sub">{copy.footer.subtitle}</p>
        </div>

        <div className="site-footer__contact">
          <a className="site-footer__link site-footer__email" href={MAILTO}>
            <MarkedLabel>{EMAIL}</MarkedLabel>
            <NavUnderline className="site-footer__squiggle" />
          </a>
        </div>
      </div>

      <div className="site-footer__grid">
        <nav className="site-footer__col site-footer__col--explore" aria-label={copy.footer.navLabel}>
          <h2 className="site-footer__heading">{copy.footer.explore}</h2>
          <ul className="site-footer__list">
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                {item.portal ? (
                  <Link
                    className="site-footer__link"
                    to={portalHome}
                    aria-current="page"
                    onClick={(event) => {
                      // On the portal's home already: up, not a second entry.
                      if (!onPortalHome || isModifiedClick(event)) return
                      event.preventDefault()
                      scrollToTop()
                    }}
                  >
                    <MarkedLabel>{copy.nav[item.id]}</MarkedLabel>
                  </Link>
                ) : (
                  <a className="site-footer__link" href={boulderHref(item.path, lang)}>
                    <MarkedLabel>{copy.nav[item.id]}</MarkedLabel>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {socials.length > 0 && (
          <div className="site-footer__col site-footer__col--follow">
            <h2 id="site-footer-follow" className="site-footer__heading">
              {copy.footer.follow}
            </h2>
            <ul className="site-footer__list" aria-labelledby="site-footer-follow">
              {socials.map((social) => (
                <li key={social.id}>
                  <a className="site-footer__link" href={social.href} target="_blank" rel="noopener noreferrer">
                    <MarkedLabel>{social.label}</MarkedLabel>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="site-footer__base">
        <p className="site-footer__legal">{copy.footer.legal(year)}</p>
        <button type="button" className="site-footer__link site-footer__back" onClick={scrollToTop}>
          <MarkedLabel>{copy.footer.backToTop}</MarkedLabel>
          {/* A loose, slightly uneven stroke to sit with the hand-drawn marks
              rather than a UI-kit chevron. currentColor, so it follows the
              label. */}
          <svg className="site-footer__arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
            <path d="M12.4 21c-.5-5.2-.6-10.6-.2-16.2M5.2 11.6c2.5-2.1 4.6-4.4 6.9-7 2.1 2.5 4.3 4.7 6.9 6.5" />
          </svg>
        </button>
      </div>

      {/* The brand mark, not copy: the stamp word stays Latin in Georgian.
          Decorative (the legal line names the studio), so it is hidden from
          screen readers and takes no pointer. */}
      <p className="site-footer__sign" data-text="BOULDER" aria-hidden="true">
        BOULDER
      </p>
    </footer>
  )
}

export { Footer }
