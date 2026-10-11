import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'

import LogoArt from './LogoArt'

// The real "full" lockup (wordmark + rock icon) in var(--ink), plus
// boulder.ge's hover animation (components/Logo.jsx).
//
// ── Hover animation ───────────────────────────────────────────────────────
// /brand/logo-hover.gif is a 62-frame, 80ms-per-frame hand-drawn sequence
// (4.96s) in which the lockup erases itself, is redrawn by a visible pen and
// returns to the mark; frame 0 is this same lockup and frame 61 returns to
// it. It cannot be rebuilt as a path morph (62 topologically different
// frames), so the GIF is used as a CSS *mask* over a solid block: the art is
// one colour, so the animation takes var(--ink) and flips with the theme,
// which a raster <img> never could.
//
// The layer is mounted only while a run is playing, and that is
// load-bearing: remounting an element with the same GIF URL restarts it from
// frame 0, so each run begins at the start without a cache-busting query
// that would re-download it. A run always plays to completion — hover only
// STARTS it — and it plays itself once on landing.
const ANIM_SRC = `${import.meta.env.BASE_URL}brand/logo-hover.gif`

// 62 frames x 80ms, read off the GIF itself.
const RUN_MS = 4960

// boulder.ge waits out its 1.8s splash before the landing run; the portal
// has no splash, so it only gives the page a beat to settle.
const AUTOPLAY_DELAY_MS = 600

type LogoProps = {
  className?: string
  style?: CSSProperties
  /** Where the logo goes. Without one it is a plain image (no link). */
  href?: string
  label?: string
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}

export default function Logo({ className, style, href, label = 'Boulder', onClick }: LogoProps) {
  // `runs` increments per run and is the layer's key, which is what forces
  // the remount that rewinds the GIF. `playing` gates the layer.
  const [runs, setRuns] = useState(0)
  const [playing, setPlaying] = useState(false)
  const playingRef = useRef(false)

  const play = useCallback(() => {
    if (playingRef.current) return // already running — let it finish
    playingRef.current = true
    setRuns((n) => n + 1)
    setPlaying(true)
  }, [])

  // End the run on its own clock rather than on pointer state.
  useEffect(() => {
    if (!playing) return undefined
    const timer = window.setTimeout(() => {
      playingRef.current = false
      setPlaying(false)
    }, RUN_MS)
    return () => window.clearTimeout(timer)
  }, [playing, runs])

  // Preload, then play the landing run once. Waiting for `onload` matters:
  // the static mark is hidden while the layer is mounted, so starting before
  // the GIF has decoded would blank the logo instead of animating it.
  useEffect(() => {
    let timer = 0
    const img = new Image()
    img.onload = () => {
      timer = window.setTimeout(play, AUTOPLAY_DELAY_MS)
    }
    img.src = ANIM_SRC
    return () => {
      img.onload = null
      window.clearTimeout(timer)
    }
  }, [play])

  const classes = `logo${playing ? ' logo--playing' : ''}${className && className !== 'logo' ? ` ${className}` : ''}`
  const inner = (
    <>
      <LogoArt className="logo__mark" />
      {/* Painted block, shaped by the animation. Position and size come from
          the measured frame-0 box (header.css .logo__anim), so the swap from
          the vector to the animation is invisible. */}
      {playing && (
        <span
          key={runs}
          className="logo__anim"
          aria-hidden="true"
          style={{ WebkitMaskImage: `url(${ANIM_SRC})`, maskImage: `url(${ANIM_SRC})` }}
        />
      )}
    </>
  )

  if (!href) {
    return (
      <span className={classes} style={style} onMouseEnter={play} role="img" aria-label={label}>
        {inner}
      </span>
    )
  }
  return (
    <a className={classes} style={style} href={href} onMouseEnter={play} onClick={onClick} aria-label={label}>
      {inner}
    </a>
  )
}

export { Logo }
