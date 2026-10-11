import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Lockup } from '@/components/brand'
import { cn } from '@/lib/cn'
import { LanguageToggle, ThemeToggle } from '@/shell/controls'

/** Back-to-start + logo on the left, KA/EN and theme on the right. */
export function AuthTopBar({ showLogo = true, className }: { showLogo?: boolean; className?: string }) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex h-16 items-center gap-2', className)}>
      {showLogo ? (
        <Link to="/" aria-label={t('shell:nav.home')} className="rounded-card">
          <Lockup size={30} />
        </Link>
      ) : (
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          {t('shell:nav.home')}
        </Link>
      )}
      <div className="flex-1" />
      <LanguageToggle />
      <ThemeToggle />
    </div>
  )
}

/** Only same-app relative paths are allowed as `?next=`. */
export function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null
  if (next.startsWith('/login') || next.startsWith('/register')) return null
  return next
}
