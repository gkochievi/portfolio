import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { ChitiMark } from './ChitiMark'

/** A dotless i with a canary dot, slightly larger than a normal tittle. */
function ChirpI() {
  return (
    <span className="relative inline-block">
      ı
      <span aria-hidden className="absolute left-1/2 top-[0.06em] size-[0.24em] -translate-x-1/2 rounded-full bg-[#F2C12E]" />
    </span>
  )
}

export interface WordmarkProps {
  /** Force a script; defaults to the UI language. 'both' = bilingual lockup with a hairline. */
  lang?: 'en' | 'ka' | 'both'
  /** Font size in px (default 22). */
  size?: number
  className?: string
}

/** "chiti" lowercase in Bricolage 700 with yellow i-dots; "ჩიტი" in Noto Sans Georgian 700 at 0.85x. */
export function Wordmark({ lang, size = 22, className }: WordmarkProps) {
  const { i18n } = useTranslation()
  const which = lang ?? (i18n.language?.startsWith('ka') ? 'ka' : 'en')
  const latin = (
    <span lang="en" aria-label="chiti" className="font-display font-bold leading-none tracking-[-0.02em] text-ink" style={{ fontSize: size }}>
      <span aria-hidden>
        ch
        <ChirpI />
        t
        <ChirpI />
      </span>
    </span>
  )
  const georgian = (
    <span lang="ka" className="font-georgian font-bold leading-none text-ink" style={{ fontSize: size * 0.85 }}>
      ჩიტი
    </span>
  )
  if (which === 'both') {
    return (
      <span className={cn('inline-flex items-center gap-2', className)}>
        {latin}
        <span aria-hidden className="h-[0.9em] w-px bg-line-strong" style={{ fontSize: size }} />
        {georgian}
      </span>
    )
  }
  return <span className={cn('inline-flex items-center', className)}>{which === 'ka' ? georgian : latin}</span>
}

/** Mark + wordmark lockup, gap 0.35x the mark height. */
export function Logo({ size = 32, lang, showWordmark = true, className }: { size?: number; lang?: WordmarkProps['lang']; showWordmark?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center', className)} style={{ gap: size * 0.35 }}>
      <ChitiMark size={size} />
      {showWordmark ? <Wordmark lang={lang} size={Math.round(size * 0.72)} /> : null}
    </span>
  )
}
