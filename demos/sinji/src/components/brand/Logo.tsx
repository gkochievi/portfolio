import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

/**
 * The assay mark: a bell curve on a ruled baseline, five ticks (middle one bronze)
 * and the bronze bead of a fire assay. Colours follow the theme tokens.
 */
export function LogoMark({ size = 32, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn('shrink-0', className)}
    >
      <path d="M6 34 C15 34 15.5 9 24 9 C32.5 9 33 34 42 34 Z" fill="var(--color-primary)" fillOpacity="0.1" />
      <path d="M6 34 C15 34 15.5 9 24 9 C32.5 9 33 34 42 34" stroke="var(--color-primary)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="4" y1="34" x2="44" y2="34" stroke="var(--color-primary)" strokeWidth="3.5" strokeLinecap="round" />
      <g strokeWidth="1.75" strokeLinecap="round">
        {[10, 17, 31, 38].map((x) => (
          <line key={x} x1={x} y1="37" x2={x} y2="40" stroke="var(--color-ink)" strokeOpacity="0.6" />
        ))}
        <line x1="24" y1="37" x2="24" y2="40" stroke="var(--color-accent)" />
      </g>
      <circle cx="24" cy="44" r="3" fill="var(--color-accent)" />
    </svg>
  )
}

/** Wordmark "sinji." / "სინჯი." with the bronze full stop (the verdict). Follows the UI language unless `lang` is set. */
export function Wordmark({ className, lang }: { className?: string; lang?: 'en' | 'ka' }) {
  const { i18n } = useTranslation()
  const ka = (lang ?? i18n.language) === 'ka'
  return (
    <span
      lang={ka ? 'ka' : 'en'}
      className={cn('font-display font-semibold leading-none text-ink', ka ? 'tracking-normal' : 'tracking-[-0.02em]', className)}
      style={{ fontFamily: ka ? 'var(--font-georgian-display)' : undefined }}
    >
      {ka ? 'სინჯი' : 'sinji'}
      <span className="text-accent">.</span>
    </span>
  )
}

/** Lockup: mark + wordmark. `size` is the mark size in px; the wordmark scales with it. */
export function Logo({ size = 28, className, withWordmark = true }: { size?: number; className?: string; withWordmark?: boolean }) {
  const { t } = useTranslation('common')
  return (
    <span className={cn('inline-flex items-center', className)} style={{ gap: size * 0.22 }} aria-label={t('brand.name')} role="img">
      <LogoMark size={size} />
      {withWordmark ? <Wordmark className="translate-y-[-1px]" /> : null}
    </span>
  )
}
