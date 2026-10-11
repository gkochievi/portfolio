import { useEffect, useRef, type CSSProperties } from 'react'

import { fromBase } from '@/lib/url'

/**
 * The one background behind the whole portal — a port of boulder-website's
 * `PageBackground.jsx` (design v2): a dot grid over the flat page colour, and
 * the pre-rendered side boulder over that on the left.
 *
 * Both layers are painted by CSS (`styles/boulder.css`, "Page shell"), not by
 * `<img>`, so the browser fetches only the rock the current theme applies, and
 * only the 1x or 2x render the display needs. The renders are boulder.ge's own
 * (`public/brand/boulder-{bright,dark}[@2x].webp`), already rotated and
 * cropped: rotating a ~3100 x 5500 image at runtime would hand the compositor a
 * texture in the hundreds of megabytes.
 *
 * The one change from boulder.ge is where the image URLs come from. boulder.ge
 * is always served from the domain root; the portal may live under
 * `VITE_BASE`, so the URLs are resolved here through `fromBase` and handed to
 * the stylesheet as custom properties, which its `image-set()` reads.
 *
 * ── Depth ──────────────────────────────────────────────────────────────────
 * Only the DOTS move: they travel at DOTS_SPEED of the page's scroll, so the
 * rock — which sits in the content plane, moving 1:1 — reads as nearer.
 *
 * The dot layer is `position: fixed` and viewport-sized, and the shift is taken
 * modulo one tile. The pattern repeats every `--dots-gap`, so translating by
 * the remainder is pixel-identical to translating by the whole distance, at the
 * memory cost of one screen instead of the whole document. The value is written
 * straight to a custom property from a rAF-throttled passive listener — never
 * through React state, which would re-render the page every frame.
 */

// What fraction of the page's scroll speed the dot grid travels at. 1 would pin
// it to the content, 0 nail it to the viewport.
const DOTS_SPEED = 0.6

const url = (path: string) => `url("${fromBase(path)}")`

const ROCK = {
  '--rock-bright-1x': url('brand/boulder-bright.webp'),
  '--rock-bright-2x': url('brand/boulder-bright@2x.webp'),
  '--rock-dark-1x': url('brand/boulder-dark.webp'),
  '--rock-dark-2x': url('brand/boulder-dark@2x.webp'),
} as CSSProperties

export function PageBackground() {
  const dotsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dots = dotsRef.current
    if (!dots) return undefined

    // Reduced motion gets no parallax at all: a background sliding against the
    // content is exactly the vestibular trigger the setting exists for. Read
    // live, because the setting can change mid-session.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')

    // One tile, read from the token rather than duplicated as a literal. The
    // token stays a plain px value in boulder.css for exactly this parse.
    const gap = parseFloat(getComputedStyle(dots).getPropertyValue('--dots-gap')) || 40.6

    let frame = 0
    const write = () => {
      frame = 0
      const travelled = (window.scrollY * DOTS_SPEED) % gap
      dots.style.setProperty('--dots-shift', `${-travelled}px`)
    }
    const onScroll = () => {
      // Coalesce to one write per frame; a scroll event can outpace paint.
      if (!frame) frame = requestAnimationFrame(write)
    }

    const apply = () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      if (reduce.matches) {
        dots.style.setProperty('--dots-shift', '0px')
      } else {
        window.addEventListener('scroll', onScroll, { passive: true })
        write()
      }
    }

    apply()
    reduce.addEventListener('change', apply)
    return () => {
      reduce.removeEventListener('change', apply)
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="page-bg" aria-hidden="true">
      <div className="page-bg__dots" ref={dotsRef} />
      <div className="page-bg__boulder" style={ROCK} />
    </div>
  )
}
