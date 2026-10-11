/**
 * Bani brand art, all inline SVG (no external assets).
 * The motif: two thin "voices" rise and fall over one straight bronze bar, the bass (ბანი).
 */
import { cn } from '@/lib/cn'
import type { Lang } from '@/types'

export interface LogoMarkProps {
  size?: number
  className?: string
  /** Single-colour versions for tight spots. */
  mono?: 'ink' | 'linen'
  title?: string
}

/** 32x32 mark: pine tile, brass + linen voices, bronze bass bar. Middle voice dropped at <= 16px. */
export function LogoMark({ size = 32, className, mono, title }: LogoMarkProps) {
  const small = size <= 16
  const tile = mono === 'linen' ? '#F1F2EB' : mono === 'ink' ? '#16211B' : '#16211B'
  const fg = mono === 'linen' ? '#16211B' : mono === 'ink' ? '#F1F2EB' : null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="32" height="32" rx="7" fill={tile} />
      <rect x="6" y="21" width="20" height="4" rx="2" fill={fg ?? '#A3441A'} />
      <path
        d="M6 11 C10 7 13 7 16 10 C19 13 22 13 26 9"
        fill="none"
        stroke={fg ?? '#D9A33B'}
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      {!small && (
        <path
          d="M6 16.5 C9 14.5 12 14.5 16 16.5 C20 18.5 23 18.5 26 16"
          fill="none"
          stroke={fg ?? '#F1F2EB'}
          strokeOpacity={fg ? 1 : 0.85}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

export interface WordmarkProps {
  lang?: Lang
  className?: string
  /** Colour of the letters; the bass bar is always bronze. */
  tone?: 'ink' | 'linen' | 'current'
  /** Animate the bass bar drawing in once. */
  animate?: boolean
}

/**
 * Lowercase 'bani' (Epilogue 800, -0.03em) with a rounded bronze bar under the whole word,
 * 0.09em thick and 0.14em below the baseline. In ka the word is 'ბანი' in Noto Sans Georgian 700.
 */
export function Wordmark({ lang = 'en', className, tone = 'current', animate = false }: WordmarkProps) {
  const ka = lang === 'ka'
  const color = tone === 'ink' ? 'text-[#16211B]' : tone === 'linen' ? 'text-[#F1F2EB]' : ''
  return (
    <span
      className={cn('relative inline-block leading-none', color, className)}
      style={{ paddingBottom: '0.26em' }}
      lang={ka ? 'ka' : 'en'}
    >
      <span
        style={{
          fontFamily: ka ? 'var(--font-ka)' : 'var(--font-display)',
          fontWeight: ka ? 700 : 800,
          letterSpacing: ka ? 0 : '-0.03em',
        }}
      >
        {ka ? 'ბანი' : 'bani'}
      </span>
      <span
        aria-hidden
        className={cn('absolute rounded-full bg-[#A3441A] origin-left', animate && 'animate-draw')}
        style={{ left: '0.04em', right: '0.02em', height: '0.09em', bottom: '0.03em' }}
      />
    </span>
  )
}

/** Mark + wordmark lockup (gap = half the mark). */
export function Lockup({
  lang = 'en',
  size = 28,
  tone = 'current',
  className,
  animate,
}: {
  lang?: Lang
  size?: number
  tone?: WordmarkProps['tone']
  className?: string
  animate?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center', className)} style={{ gap: size / 2 }}>
      <LogoMark size={size} />
      <Wordmark lang={lang} tone={tone} animate={animate} className="text-[1.35rem]" />
    </span>
  )
}

export interface PolyphonyMotifProps {
  className?: string
  /** 'linen' = brass + bronze voices on light; 'pine' = brass + linen voices on dark. */
  ground?: 'linen' | 'pine'
  /** Draw the bass bar once and let the voices settle onto it. */
  animate?: boolean
  /** Small dots along the voices, like connected endpoints. */
  dots?: boolean
}

/** Two waving voices over one thick straight bar. Scales to its container width. */
export function PolyphonyMotif({ className, ground = 'linen', animate = false, dots = false }: PolyphonyMotifProps) {
  const upper = '#D9A33B'
  const middle = ground === 'pine' ? '#F1F2EB' : '#2F5D4E'
  return (
    <svg viewBox="0 0 320 120" className={cn('block', className)} aria-hidden preserveAspectRatio="xMidYMid meet">
      <g className={animate ? 'animate-settle' : undefined} style={animate ? { animationDelay: '380ms' } : undefined}>
        <path
          d="M12 40 C52 14 84 14 120 34 C156 54 188 56 224 32 C252 14 284 16 308 30"
          fill="none"
          stroke={upper}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M12 70 C48 58 80 58 116 70 C152 82 186 84 222 70 C254 58 284 60 308 66"
          fill="none"
          stroke={middle}
          strokeOpacity={ground === 'pine' ? 0.85 : 0.75}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {dots && (
          <g fill={ground === 'pine' ? '#F1F2EB' : '#16211B'}>
            <circle cx="120" cy="34" r="3.2" />
            <circle cx="224" cy="32" r="3.2" />
            <circle cx="116" cy="70" r="3" />
            <circle cx="268" cy="61" r="3" />
          </g>
        )}
      </g>
      <rect
        x="12"
        y="96"
        width="296"
        height="10"
        rx="5"
        fill="#A3441A"
        className={animate ? 'animate-draw' : undefined}
        style={{ transformOrigin: '12px 101px', transformBox: 'view-box' }}
      />
    </svg>
  )
}

/** A thin section divider: the bass bar with a faint voice above it. */
export function BassDivider({ className }: { className?: string }) {
  return (
    <div className={cn('relative h-3 w-full', className)} aria-hidden>
      <svg viewBox="0 0 400 12" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path d="M0 4 C60 0 110 0 170 4 C230 8 290 8 400 3" fill="none" stroke="#D9A33B" strokeOpacity="0.55" strokeWidth="1.25" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-primary/70" />
    </div>
  )
}
