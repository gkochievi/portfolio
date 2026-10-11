import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'

import { useLang } from '@/i18n/LanguageContext'
import LanguageSwitch from './LanguageSwitch'
import Logo from './Logo'
import NavPill from './NavPill'
import ThemeToggle from './ThemeToggle'
import {
  CHROME_COPY,
  NAV_ITEMS,
  boulderHref,
  isModifiedClick,
  samePath,
  scrollToTop,
  type NavItem,
} from './chromeCopy'

// boulder.ge's header (components/Header.jsx), as the portal wears it.
//
// Fixed at the top and laid OVER the page: a translucent strip of the page
// colour (--header-bg), so the dots show through it. The logo and every nav
// word but "works" go back to boulder.ge, in the current language; "works"
// is this portal, so it is a router link home and the current item on every
// page here. "connect" is the coral call to action, set apart beside the
// controls.
//
// Below the tablet breakpoint the words collapse behind a hamburger that
// drops down a small card with the same NavPill list (header.css).
//
// It slides up out of the way while the reader scrolls down and returns when
// they scroll up, move the mouse to the top of the window, or tab into it —
// useAutoHideHeader writes data-hidden on the <header> directly (no React
// render per scroll) and header.css slides it. The open phone menu pins it.

// The least room (px) kept between the section words and the logo on one
// side or "connect" on the other before the words are scaled to fit.
const NAV_CLEAR = 16

// ── Auto-hide (boulder.ge hooks/useAutoHideHeader.js) ──────────────────────
// Down travel, in px, before the header hides.
const HIDE_AFTER_PX = 12
// Up travel before it comes back, with an up intent behind the scroll.
const SHOW_AFTER_PX = 16
// Up travel before it comes back when no input explains the scroll (a
// scrollbar drag, find-in-page, focus moving off screen).
const SHOW_WITHOUT_INTENT_PX = 64
// How long a wheel tick, finger move or key stays the reader's intent.
const INTENT_MS = 700
// How far below the header a mouse still counts as reaching for it.
const REVEAL_BAND_PX = 24

const DOWN_KEYS = new Set(['ArrowDown', 'PageDown', 'End'])
const UP_KEYS = new Set(['ArrowUp', 'PageUp', 'Home'])

// Keys typed into a field scroll nothing.
function isEditable(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))
  )
}

// boulder.ge's version also reads through its sections' proximity snap and
// the services page's own corrective scrolls; the portal has neither, so
// this keeps the rest: the last real scroll input is the reader's intent,
// movement AGAINST a fresh intent is ignored, and the bar is always shown
// near the top, while `pinned`, while a mouse is near the top of the window,
// while keyboard focus is inside it, and is left alone while
// `body.modal-open` locks the page.
function useAutoHideHeader(headerRef: RefObject<HTMLElement>, pinned: boolean) {
  const pinnedRef = useRef(pinned)
  const showRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    pinnedRef.current = pinned
    if (pinned) showRef.current?.()
  }, [pinned])

  useEffect(() => {
    const header = headerRef.current
    if (!header) return undefined

    let hidden = false
    let lastY = Math.max(0, window.scrollY)
    let travel = 0 // signed px travelled since the direction last turned
    let frame = 0
    let intentDir = 0 // 1 down, -1 up
    let intentUntil = 0
    let pointerNear = false
    let keyboardInside = false
    let barHeight = header.offsetHeight
    let touchY: number | null = null

    const setHidden = (next: boolean) => {
      if (next === hidden) return
      hidden = next
      if (next) header.setAttribute('data-hidden', '')
      else header.removeAttribute('data-hidden')
    }
    const show = () => {
      travel = 0
      setHidden(false)
    }
    showRef.current = show
    const held = () => pinnedRef.current || pointerNear || keyboardInside

    const update = () => {
      frame = 0
      // Clamped: iOS reports a negative scrollY while the top rubber-bands.
      const y = Math.max(0, window.scrollY)
      const dy = y - lastY
      lastY = y
      if (document.body.classList.contains('modal-open')) {
        travel = 0
        return
      }
      if (y <= barHeight) {
        show()
        return
      }
      if (dy === 0) return
      if (dy > 0 !== travel > 0) travel = 0
      travel += dy
      const intentFresh = performance.now() < intentUntil
      if (travel >= HIDE_AFTER_PX) {
        if (held() || (intentFresh && intentDir < 0)) return
        setHidden(true)
      } else if (-travel >= (intentFresh ? SHOW_AFTER_PX : SHOW_WITHOUT_INTENT_PX)) {
        if (!intentFresh || intentDir < 0) setHidden(false)
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    const setIntent = (dir: number) => {
      intentDir = dir
      intentUntil = performance.now() + INTENT_MS
    }
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY) setIntent(Math.sign(e.deltaY))
    }
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null
    }
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t || touchY === null) return
      const d = t.clientY - touchY
      if (Math.abs(d) < 2) return
      touchY = t.clientY
      // A finger moving up drags the content up: the reader goes down.
      setIntent(d < 0 ? 1 : -1)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isEditable(e.target)) return
      if (DOWN_KEYS.has(e.key) || (e.key === ' ' && !e.shiftKey)) setIntent(1)
      else if (UP_KEYS.has(e.key) || (e.key === ' ' && e.shiftKey)) setIntent(-1)
    }

    // Fine pointers only: a finger has no "near the top" before it touches.
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
      const near = e.clientY <= barHeight + REVEAL_BAND_PX
      if (near === pointerNear) return
      pointerNear = near
      if (near) show()
    }
    // Leaving the window (out through the top) must not hold it forever.
    const onPointerOut = (e: PointerEvent) => {
      if (!e.relatedTarget) pointerNear = false
    }

    const onFocusIn = (e: FocusEvent) => {
      let visible = true
      try {
        visible = e.target instanceof Element && e.target.matches(':focus-visible')
      } catch {
        // No :focus-visible support: treat any focus as keyboard focus.
      }
      keyboardInside = visible
      if (visible) show()
    }
    const onFocusOut = (e: FocusEvent) => {
      if (!(e.relatedTarget instanceof Node) || !header.contains(e.relatedTarget)) keyboardInside = false
    }

    const ro = new ResizeObserver(() => {
      barHeight = header.offsetHeight
    })
    ro.observe(header)

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerout', onPointerOut, { passive: true })
    header.addEventListener('focusin', onFocusIn)
    header.addEventListener('focusout', onFocusOut)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerout', onPointerOut)
      header.removeEventListener('focusin', onFocusIn)
      header.removeEventListener('focusout', onFocusOut)
      ro.disconnect()
      cancelAnimationFrame(frame)
      header.removeAttribute('data-hidden')
      showRef.current = null
    }
  }, [headerRef])
}

export default function Header() {
  const { lang, href } = useLang()
  const copy = CHROME_COPY[lang]
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  useAutoHideHeader(headerRef, menuOpen)

  // A navigation (a project opened, a language switched) closes the menu.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // The phone menu is a small card, and the page behind it stays live, so a
  // press outside closes it, and so does Escape (which hands focus back to
  // the hamburger). `pointerdown`, not `click`: the card has to be gone
  // before the press resolves into whatever is under it. The hamburger is
  // excluded because its own click toggles.
  useEffect(() => {
    if (!menuOpen) return undefined
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target instanceof Node ? e.target : null
      if (target && menuRef.current?.contains(target)) return
      if (target && toggleRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMenuOpen(false)
      toggleRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  // Leaving the phone layout (a phone turned to landscape) closes the menu:
  // nothing on screen could close it any more, and an open menu pins the
  // header. A media-query listener fires once per crossing.
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 767px)')
    const onChange = (e: MediaQueryListEvent) => {
      if (!e.matches) setMenuOpen(false)
    }
    phone.addEventListener('change', onChange)
    return () => phone.removeEventListener('change', onChange)
  }, [])

  // THE WORDS FIT BETWEEN THEIR ANCHORS. The logo is anchored left and
  // "connect" with the controls right; the section words are centred between.
  // In Georgian the words are wider than the room they have at some widths,
  // so when they would not fit either side of their centre they are scaled
  // down (--nav-fit, a factor on the pills' font size, so padding and the
  // drawn underline scale with them) instead of pushing an anchor. English
  // fits at every width (1); the phone menu is not affected.
  const sectionsRef = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const group = sectionsRef.current
    const header = group?.closest('.site-header')
    if (!group || !header) return undefined
    const wide = window.matchMedia('(min-width: 768px)')
    let raf = 0
    const fit = () => {
      group.style.setProperty('--nav-fit', '1')
      if (!wide.matches) return
      const logo = header.querySelector('.logo')
      const connect = header.querySelector('.nav--desktop .nav-pill--accent')
      if (!logo || !connect) return
      const g = group.getBoundingClientRect()
      const centre = g.left + g.width / 2
      const room =
        2 *
        (Math.min(centre - logo.getBoundingClientRect().right, connect.getBoundingClientRect().left - centre) -
          NAV_CLEAR)
      const need = group.scrollWidth
      if (need <= room) return
      const gaps = (group.children.length - 1) * (parseFloat(getComputedStyle(group).columnGap) || 0)
      const k = (room - gaps) / (need - gaps)
      group.style.setProperty('--nav-fit', Math.max(0.7, k).toFixed(4))
    }
    fit()
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(fit)
    })
    ro.observe(header)
    document.fonts?.ready.then(fit)
    wide.addEventListener('change', fit)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      wide.removeEventListener('change', fit)
    }
  }, [lang])

  const portalHome = href('/')

  // "works" pressed on the portal's home: back to the top rather than a
  // second history entry for the page the reader is on. Any other press
  // navigates (the router link), and every modified one is the browser's.
  const onWorks = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isModifiedClick(event)) return
    setMenuOpen(false)
    if (!samePath(pathname, portalHome)) return
    event.preventDefault()
    scrollToTop()
  }

  const pill = (item: NavItem) =>
    item.portal ? (
      <NavPill key={item.id} label={copy.nav[item.id]} href={portalHome} internal active onClick={onWorks} />
    ) : (
      <NavPill
        key={item.id}
        label={copy.nav[item.id]}
        href={boulderHref(item.path, lang)}
        accent={Boolean(item.accent)}
        onClick={() => setMenuOpen(false)}
      />
    )

  return (
    <header
      ref={headerRef}
      className="site-header"
      style={{
        // Height and side padding are :root tokens (boulder.css) so page top
        // padding can never drift from the real header. max() keeps the logo
        // and controls clear of a landscape notch; env() is 0 elsewhere. The
        // bar is padded on top by the row drop, the room the logo
        // animation's rising thumb needs (--header-row-drop).
        height: 'var(--header-bar-height)',
        paddingTop: 'var(--header-row-drop)',
        paddingLeft: 'max(var(--header-pad-x), env(safe-area-inset-left, 0px))',
        paddingRight: 'max(var(--header-pad-x), env(safe-area-inset-right, 0px))',
        pointerEvents: 'none', // re-enabled on children via .site-header > *
      }}
    >
      <Logo className="logo" href={boulderHref('/', lang)} label={copy.a11y.logo} />

      {/* The four words are wrapped so they can be centred on the WINDOW
          rather than on whatever the logo and the controls leave over
          (header.css). "connect" stays outside the group, with the
          controls; the phone nav below keeps the flat list. */}
      <nav className="nav nav--desktop" aria-label={copy.a11y.navSections}>
        <span className="nav__sections" ref={sectionsRef}>
          {NAV_ITEMS.filter((item) => !item.accent).map(pill)}
        </span>
        {NAV_ITEMS.filter((item) => item.accent).map(pill)}
      </nav>

      <div className="header-right">
        <ThemeToggle />
        <LanguageSwitch />
        <button
          type="button"
          ref={toggleRef}
          className={`nav-toggle${menuOpen ? ' nav-toggle--open' : ''}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="site-nav-mobile"
          aria-label={menuOpen ? copy.a11y.closeMenu : copy.a11y.openMenu}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      <nav
        id="site-nav-mobile"
        ref={menuRef}
        className={`nav nav--mobile${menuOpen ? ' nav--mobile-open' : ''}`}
        aria-label={copy.a11y.navSections}
        aria-hidden={!menuOpen}
      >
        {NAV_ITEMS.map(pill)}
      </nav>
    </header>
  )
}

export { Header }
