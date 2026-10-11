import { useEffect, useRef, type AnimationEvent } from 'react'

import { useLang } from '@/i18n/LanguageContext'
import { useTheme } from '@/lib/theme'
import ThemeToggleArt from './ThemeToggleArt'
import { CHROME_COPY } from './chromeCopy'

// boulder.ge's light/dark toggle (components/ThemeToggle.jsx), behaviour and
// all. The theme itself is useTheme()'s (the `boulder.theme` key and the
// no-flash script in index.html); this component owns only the motion.
//
// THE HOVER'S HAND-OVERS. The hover is CSS (controls.css, HOVER): Figma's
// state machine, where the day rays rock 0 -> -90deg -> 0 and the night's
// three short rays blink out and back, every leg on the "Quick" spring, for
// as long as the pointer (or a visible keyboard focus) stays. What CSS
// cannot do is Figma's three hand-overs, because a removed CSS animation
// does not transition — the property snaps to its base value. So these run
// as Web Animations on the very property the loop animates:
//   - LEAVE: back to rest from wherever the leg had got to, on the Quick
//     spring.
//   - COME BACK mid-way home: the first leg runs from where the rays are,
//     aligned with the CSS loop so it hands back exactly when that leg ends.
//   - CLICK mid-loop: the old face returns to rest on the click's Bouncy
//     spring while the morph squashes it away, and the new face's loop
//     waits for the morph to land ([data-morph] on the button).
// The value on screen at leave time is WORKED OUT, not read: with :hover
// gone the CSS animation has gone with it. Every duration and curve is read
// from the CSS variables on the button, so the sheet stays the one place
// they live.
const ROCK = 'theme-toggle-rays-rock'
const BLINK = 'theme-toggle-rays-blink'

type Loop = {
  selector: string
  prop: 'rotate' | 'opacity'
  rest: number
  away: number
  css: (v: number) => string
}

// What each loop moves, and between which two values. The night art's first
// three paths are its rays (controls.css picks them the same way).
const LOOPS: Record<string, Loop> = {
  [ROCK]: { selector: '.theme-toggle__rays--sun', prop: 'rotate', rest: 0, away: -90, css: (v) => `${v}deg` },
  [BLINK]: {
    selector: '.theme-toggle__night > path:nth-child(-n + 3)',
    prop: 'opacity',
    rest: 1,
    away: 0,
    css: (v) => String(v),
  },
}

type Spring = { easing: string; ms: number; stops: number[] }

// Per animated element: the CSS loop running on it (its start on the
// document timeline) and the Web Animation a hand-over put on it.
type Layer = { start: number | null; script: Animation | null }

const toMs = (raw: string) => (raw.endsWith('ms') ? parseFloat(raw) : parseFloat(raw) * 1000)

// Timeline values are CSSNumberish; in every engine that ships these they
// are plain milliseconds.
const asNumber = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const timelineNow = () => asNumber(document.timeline.currentTime)

// A CSS linear() easing with evenly spaced stops, at progress p (0..1).
function atProgress(stops: number[], p: number) {
  const at = Math.min(Math.max(p, 0), 1) * (stops.length - 1)
  const i = Math.min(Math.floor(at), stops.length - 2)
  return stops[i] + (stops[i + 1] - stops[i]) * (at - i)
}

// One spring off the button's custom properties. null where linear() is
// unsupported: the sheet then falls back to a cubic-bezier these stops do
// not describe, and the rays simply snap home.
function readSpring(button: HTMLElement, easingVar: string, durationVar: string): Spring | null {
  const cs = getComputedStyle(button)
  const easing = cs.getPropertyValue(easingVar).trim()
  const ms = toMs(cs.getPropertyValue(durationVar).trim())
  const stops = (easing.match(/^linear\(([^)]*)\)$/)?.[1] ?? '').split(',').map(parseFloat)
  const ok =
    stops.length > 1 &&
    stops.every(Number.isFinite) &&
    ms > 0 &&
    typeof CSS !== 'undefined' &&
    CSS.supports('animation-timing-function', easing)
  return ok ? { easing, ms, stops } : null
}

// What the element shows right now, from its computed style — only
// meaningful while something that still applies is driving it.
function readValue(el: Element, loop: Loop) {
  const v = parseFloat(getComputedStyle(el).getPropertyValue(loop.prop)) // rotate 'none' -> NaN
  return Number.isFinite(v) ? v : loop.rest
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const { lang } = useLang()
  const dark = theme === 'dark'

  // None of this is ever rendered, and the pointer must never cause a React
  // render: the layers, whether the pointer / a VISIBLE focus is on the
  // button (either keeps the loop going), and the click's morph timer.
  const buttonRef = useRef<HTMLButtonElement>(null)
  const layers = useRef(new Map<Element, Layer>())
  const pointerIn = useRef(false)
  const focusShown = useRef(false)
  const morphTimer = useRef(0)

  const layer = (el: Element): Layer => {
    let s = layers.current.get(el)
    if (!s) {
      s = { start: null, script: null }
      layers.current.set(el, s)
    }
    return s
  }
  const scriptRunning = (s: Layer) => Boolean(s.script && s.script.playState === 'running')

  // Put a spring on `el` from `from` to `to`, replacing any hand-over on it.
  const play = (el: Element, s: Layer, loop: Loop, from: number, to: number, spring: Spring) => {
    s.script?.cancel()
    s.script = null
    if (Math.abs(from - to) < 1e-3) return null
    const anim = el.animate([{ [loop.prop]: loop.css(from) }, { [loop.prop]: loop.css(to) }], {
      duration: spring.ms,
      easing: spring.easing,
    })
    s.script = anim
    anim.onfinish = () => {
      if (s.script === anim) s.script = null
    }
    return anim
  }

  // The value on screen now: a hand-over's, read (it outranks the CSS loop);
  // else the CSS loop's, worked out from its start; else rest.
  const valueNow = (el: Element, s: Layer, loop: Loop, quick: Spring | null, hold: number) => {
    if (scriptRunning(s) || s.start == null || !quick) return readValue(el, loop)
    const now = timelineNow()
    if (now == null) return readValue(el, loop)
    const elapsed = now - s.start
    if (!(elapsed > 0)) return loop.rest
    const step = quick.ms + hold
    const x = atProgress(quick.stops, Math.min((elapsed % step) / quick.ms, 1))
    // Even legs go out (rest -> far pose), odd legs come back.
    const out = Math.floor(elapsed / step) % 2 === 0 ? x : 1 - x
    return loop.rest + (loop.away - loop.rest) * out
  }

  // Everything the loops have touched goes home on `spring`.
  const handBack = (spring: Spring | null) => {
    const button = buttonRef.current
    if (!button) return
    const quick = readSpring(button, '--theme-toggle-spring', '--theme-toggle-leg')
    const hold = toMs(getComputedStyle(button).getPropertyValue('--theme-toggle-hold').trim()) || 0
    for (const loop of Object.values(LOOPS)) {
      for (const el of button.querySelectorAll(loop.selector)) {
        const s = layers.current.get(el)
        if (!s || (s.start == null && !scriptRunning(s))) continue
        const from = valueNow(el, s, loop, quick, hold)
        s.start = null
        if (spring && !reducedMotion()) play(el, s, loop, from, loop.rest, spring)
        else {
          s.script?.cancel()
          s.script = null
        }
      }
    }
  }

  const onAnimationStart = (e: AnimationEvent<HTMLButtonElement>) => {
    const loop = LOOPS[e.animationName]
    if (!loop || !(e.target instanceof Element)) return
    const el = e.target
    const s = layer(el)
    const css = el
      .getAnimations()
      .find((a) => (a as Animation & { animationName?: string }).animationName === e.animationName)
    // startTime is resolved by animationstart in Chromium; where it is not
    // (WebKit reported null), currentTime gives the same instant.
    const cssStart = asNumber(css?.startTime)
    const cssCurrent = asNumber(css?.currentTime)
    const tl = timelineNow()
    const start = cssStart ?? (cssCurrent != null && tl != null ? tl - cssCurrent : null)
    // Still on its way home? Run the first leg from where it is instead of
    // letting the restarted loop snap it, aligned so the loop takes over at
    // the leg's end, where both are at the far pose.
    const from = scriptRunning(s) ? readValue(el, loop) : loop.rest
    s.script?.cancel()
    s.script = null
    s.start = start
    const quick = readSpring(e.currentTarget, '--theme-toggle-spring', '--theme-toggle-leg')
    if (start == null || !quick || Math.abs(from - loop.rest) < 1e-3) return
    // Both start NOW, the CSS loop re-timed to match: animationstart arrives
    // a frame or more after the loop really started.
    const t = timelineNow()
    if (css && t != null) {
      css.startTime = t
      s.start = t
    }
    const first = play(el, s, loop, from, loop.away, quick)
    if (first && s.start != null) first.startTime = s.start
  }

  const release = () => {
    if (pointerIn.current || focusShown.current) return
    const button = buttonRef.current
    handBack(button && readSpring(button, '--theme-toggle-spring', '--theme-toggle-leg'))
  }

  useEffect(() => {
    const live = layers.current
    return () => {
      window.clearTimeout(morphTimer.current)
      live.forEach((s) => s.script?.cancel())
      live.clear()
    }
  }, [])

  const onToggle = () => {
    const button = buttonRef.current
    // Pressed mid-loop: the face going away comes home on the click's own
    // spring while the morph squashes it into its partner, and the new
    // face's loop waits for the morph to land.
    if (button && !reducedMotion()) {
      handBack(readSpring(button, '--theme-toggle-morph-spring', '--theme-toggle-morph'))
      const morphMs = toMs(getComputedStyle(button).getPropertyValue('--theme-toggle-morph').trim())
      if (morphMs > 0) {
        button.setAttribute('data-morph', '')
        window.clearTimeout(morphTimer.current)
        morphTimer.current = window.setTimeout(() => button.removeAttribute('data-morph'), morphMs)
      }
    }
    toggle()
  }

  return (
    <ThemeToggleArt
      ref={buttonRef}
      dark={dark}
      onToggle={onToggle}
      label={CHROME_COPY[lang].a11y.themeToggle}
      onAnimationStart={onAnimationStart}
      onPointerEnter={() => {
        pointerIn.current = true
      }}
      onPointerLeave={() => {
        pointerIn.current = false
        // A finger never starts the loop (hover: hover only), so release()
        // finds nothing running for one and does nothing.
        release()
      }}
      onFocus={(e) => {
        try {
          focusShown.current = e.currentTarget.matches(':focus-visible')
        } catch {
          focusShown.current = false // no :focus-visible: never from a mouse press
        }
      }}
      onBlur={() => {
        focusShown.current = false
        release()
      }}
    />
  )
}

export { ThemeToggle }
