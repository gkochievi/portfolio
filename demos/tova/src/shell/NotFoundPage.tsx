import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Flakes, Lockup } from '@/components/brand'
import { Button } from '@/components/ui'
import { LanguageToggle, ThemeToggle } from './controls'

export default function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-surface">
      <Flakes count={12} className="opacity-70" />
      <header className="relative flex h-16 items-center gap-2 px-4">
        <Link to="/" aria-label={t('shell:nav.home')}>
          <Lockup size={30} />
        </Link>
        <div className="flex-1" />
        <LanguageToggle />
        <ThemeToggle />
      </header>
      <main className="relative mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center justify-center px-4 pb-24 text-center">
        <p className="font-display text-[96px] leading-none text-primary sm:text-[128px]">{t('shell:notFound.code')}</p>
        <h1 className="mt-4 font-display text-[28px] leading-tight text-ink sm:text-[36px]">{t('shell:notFound.title')}</h1>
        <p className="mt-3 text-muted">{t('shell:notFound.body')}</p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/">{t('shell:notFound.home')}</Link>
        </Button>
      </main>
    </div>
  )
}
