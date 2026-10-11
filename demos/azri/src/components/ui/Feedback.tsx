/**
 * Loading and feedback: BarsLoader (the brand's five rising bars), SignalBars
 * (n of 5 filled - progress), CenteredLoader, LiveDot, Toaster (sonner).
 * Owner: design-system agent.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Toaster as SonnerToaster } from 'sonner'

import { cn } from '@/lib/utils'
import { useTheme } from './theme'

export { toast } from 'sonner'

const BAR_HEIGHTS = [8, 13, 18, 23, 28]
const SCALE = { xs: 0.4, sm: 0.55, md: 0.85, lg: 1.3 } as const

export interface BarsLoaderProps {
  size?: keyof typeof SCALE
  /** Accessible label; defaults to "Loading...". Pass '' inside a button that already has text. */
  label?: string
  className?: string
}

/** Five rounded bars pulsing in sequence (spinner). Colour = currentColor (default text-primary). */
export function BarsLoader({ size = 'md', label, className }: BarsLoaderProps) {
  const { t } = useTranslation('common')
  const k = SCALE[size]
  const text = label ?? t('loading')
  return (
    <span
      role={text ? 'status' : undefined}
      aria-label={text || undefined}
      aria-hidden={text ? undefined : true}
      className={cn('inline-flex items-end text-primary', className)}
      style={{ gap: Math.max(2, 4 * k), height: 28 * k }}
    >
      {BAR_HEIGHTS.map((height, index) => (
        <span
          key={height}
          className="block origin-bottom animate-bars rounded-full bg-current"
          style={{ width: Math.max(2.5, 4.5 * k), height: height * k, animationDelay: `${index * 90}ms` }}
        />
      ))}
    </span>
  )
}

export interface SignalBarsProps {
  /** How many of the bars are filled (0..max). */
  value: number
  max?: number
  /** Bars rise one by one (40ms stagger) on mount. */
  animateIn?: boolean
  size?: keyof typeof SCALE
  /** Filled colour class; default bg-brand (tenant colour inside the respondent frame). */
  fillClassName?: string
  className?: string
  /** Accessible label, e.g. "2 of 4 answered". */
  label?: string
}

/** The brand motif as a progress meter: five ascending bars, the first `value` filled. */
export function SignalBars({ value, max = 5, animateIn = false, size = 'md', fillClassName = 'bg-brand', className, label }: SignalBarsProps) {
  const k = SCALE[size]
  const heights = Array.from({ length: max }, (_, i) => 8 + ((28 - 8) * i) / Math.max(1, max - 1))
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('inline-flex items-end', className)}
      style={{ gap: Math.max(2, 4 * k), height: 28 * k }}
    >
      {heights.map((height, index) => (
        <span
          key={index}
          className={cn(
            'block origin-bottom rounded-full transition-colors duration-200 ease-azri',
            index < value ? fillClassName : 'bg-ink/12',
            animateIn && 'animate-rise',
          )}
          style={{ width: Math.max(3, 5 * k), height: height * k, animationDelay: animateIn ? `${index * 40}ms` : undefined } as CSSProperties}
        />
      ))}
    </span>
  )
}

/** Full-area centred BarsLoader for page/section loading. */
export function CenteredLoader({ className, label, size = 'lg' }: { className?: string; label?: string; size?: BarsLoaderProps['size'] }) {
  return (
    <div className={cn('grid min-h-[40vh] w-full place-items-center', className)}>
      <BarsLoader size={size} label={label} />
    </div>
  )
}

/** Small pulsing dot for "live" / "new" markers. */
export function LiveDot({ className, tone = 'accent' }: { className?: string; tone?: 'accent' | 'primary' | 'success' | 'danger' }) {
  const color = { accent: 'bg-mint', primary: 'bg-primary', success: 'bg-success', danger: 'bg-danger' }[tone]
  return <span aria-hidden="true" className={cn('inline-block size-2 shrink-0 animate-live rounded-full', color, className)} />
}

/** Mount once (src/main.tsx). Bubble-shaped toasts, top-centre. Use `toast()` anywhere. */
export function Toaster() {
  const { theme } = useTheme()
  return (
    <SonnerToaster
      position="top-center"
      theme={theme}
      gap={10}
      offset={16}
      toastOptions={{
        unstyled: true,
        duration: 4500,
        classNames: {
          toast:
            'group pointer-events-auto flex w-[min(92vw,380px)] items-start gap-3 rounded-bubble border border-border bg-panel px-4 py-3.5 text-sm text-ink shadow-float',
          title: 'font-semibold leading-snug',
          description: 'mt-0.5 text-[13px] leading-snug text-muted',
          icon: 'mt-0.5 shrink-0 [&_svg]:size-[18px]',
          success: '[&_[data-icon]]:text-success',
          error: '[&_[data-icon]]:text-danger',
          info: '[&_[data-icon]]:text-info',
          warning: '[&_[data-icon]]:text-warning',
          actionButton:
            'ml-auto shrink-0 self-center rounded-full bg-primary px-3 py-1.5 text-[13px] font-semibold text-on-primary hover:bg-primary-hover',
          cancelButton: 'ml-auto shrink-0 self-center rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted hover:bg-ink/6',
          closeButton: 'text-muted',
        },
      }}
    />
  )
}
