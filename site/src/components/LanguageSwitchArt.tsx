import type { CSSProperties } from 'react'

import { NavUnderline } from './NavPill'

// THE language switch's artwork — the two drawn flags, the pill and the
// underline — ported from boulder-website (components/LanguageSwitchArt.jsx).
//
// The coral five-cross Georgian flag with its tiny GEO wordmark, and the
// dark chip with a bright Union Jack, as theme-aware vectors: separate
// elements so the selected one can animate. Selection reads three ways: the
// active flag is full-strength and the other dimmed + shrunk; the nav's
// hand-drawn indigo underline sits under the active flag and SLIDES to the
// other on a switch; and both move on the same bouncy timing, so it reads as
// one gesture (controls.css).

export type FlagLang = 'en' | 'ka'

// Open five-cross Georgian flag, coral in both themes. The viewBox starts
// 4.6 units ABOVE the drawing so the cross's horizontal bar lands on the
// box's centre line, where the jack's bar is; the long vertical and the GEO
// wordmark then run past the box's bottom (the svg paints overflow).
export function GeoFlag() {
  return (
    <svg viewBox="0 -4.6 34 30" fill="none" aria-hidden="true">
      <g stroke="var(--color-accent)" strokeLinecap="round">
        {/* St. George cross — the vertical runs long, like the original */}
        <path d="M17 2.2 L17 22.5" strokeWidth="2.6" />
        <path d="M3.4 10.6 L30.8 10.2" strokeWidth="2.4" />
        {/* four bolnur crosses, one per quadrant */}
        {[
          [9.2, 5.6],
          [24.8, 5.4],
          [9.2, 15.4],
          [24.8, 15.2],
        ].map(([x, y], i) => (
          <g key={i} strokeWidth="1.7">
            <path d={`M${x} ${y - 2.1} L${x} ${y + 2.1}`} />
            <path d={`M${x - 2.1} ${y} L${x + 2.1} ${y}`} />
          </g>
        ))}
      </g>
      <text
        x="17"
        y="29"
        textAnchor="middle"
        fill="var(--color-accent)"
        fontFamily="var(--font-display)"
        fontSize="6"
        fontWeight="700"
        letterSpacing="0.5"
      >
        GEO
      </text>
    </svg>
  )
}

// Filled chip with a bright Union Jack. The chip is --ink and the lines the
// opposite pole (--lang-jack, controls.css), so light theme matches the
// original navy chip and dark theme inverts cleanly.
export function UkFlag() {
  return (
    <svg viewBox="0 0 34 30" fill="none" aria-hidden="true">
      <g transform="rotate(-2 17 15)">
        <rect x="2.5" y="6" width="29" height="18" rx="6" fill="var(--ink)" />
        <g stroke="var(--lang-jack)" strokeLinecap="round">
          <path d="M6.5 9.5 L27.5 20.5" strokeWidth="2" />
          <path d="M27.5 9.5 L6.5 20.5" strokeWidth="2" />
          <path d="M17 7.5 L17 22.5" strokeWidth="3.4" />
          <path d="M4.5 15 L29.5 15" strokeWidth="3.4" />
        </g>
      </g>
      {/* The GEO flag's wordmark, matched: same size, weight and tracking,
          on the same baseline in the box (GEO's 29 plus its 4.6 shift). */}
      <text
        x="17"
        y="33.6"
        textAnchor="middle"
        fill="var(--ink)"
        fontFamily="var(--font-display)"
        fontSize="6"
        fontWeight="700"
        letterSpacing="0.5"
      >
        ENG
      </text>
    </svg>
  )
}

// inkBottom: where each flag's lowest ink ends, in its own box's units (the
// 34-wide viewBox, 0 at the box top). The underline sits a fixed gap under.
const OPTIONS = [
  { code: 'ka', Flag: GeoFlag, inkBottom: 33.6 },
  { code: 'en', Flag: UkFlag, inkBottom: 33.6 },
] as const

/** The two flags and the sliding underline, for whatever element wraps them. */
export function LanguageFlags({ lang }: { lang: FlagLang }) {
  // An unknown language falls back to the first option rather than -1,
  // which would slide the underline off the track.
  const activeIndex = Math.max(
    0,
    OPTIONS.findIndex((o) => o.code === lang),
  )
  const underline = {
    '--lang-slot': activeIndex,
    '--lang-ink-bottom': OPTIONS[activeIndex].inkBottom,
  } as CSSProperties

  return (
    <span className="language-switch__flags">
      {OPTIONS.map(({ code, Flag }) => (
        <span key={code} className={`language-switch__flag${lang === code ? ' language-switch__flag--on' : ''}`}>
          <Flag />
        </span>
      ))}
      {/* The nav pills' own hand-drawn underline, sliding to whichever flag
          is current. controls.css builds the transform from these two custom
          properties, so the slide stays one transition. */}
      <span className="language-switch__underline" aria-hidden="true" style={underline}>
        <NavUnderline width={26} />
      </span>
    </span>
  )
}

type LanguageSwitchArtProps = { lang: FlagLang; onToggle: () => void; label: string; className?: string }

/** The drawing as a button, for a caller that switches language itself. */
export default function LanguageSwitchArt({ lang, onToggle, label, className = '' }: LanguageSwitchArtProps) {
  return (
    <button
      type="button"
      className={`language-switch${className ? ' ' + className : ''}`}
      onClick={onToggle}
      aria-label={label}
    >
      <LanguageFlags lang={lang} />
    </button>
  )
}

export { LanguageSwitchArt }
