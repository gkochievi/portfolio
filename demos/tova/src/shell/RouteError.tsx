/** Route-level crash screen. Works even if the error happened before any shell rendered. */
import { useTranslation } from 'react-i18next'
import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'

import { Flakes, Lockup } from '@/components/brand'
import { Button } from '@/components/ui'

export function RouteError() {
  const error = useRouteError()
  const { t } = useTranslation()
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error)
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-surface">
      <Flakes count={6} persimmon={false} className="opacity-60" />
      <header className="relative flex h-16 items-center px-4">
        <Lockup size={30} />
      </header>
      <main role="alert" className="relative mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-4 pb-24">
        <h1 className="font-display text-[28px] leading-tight text-ink sm:text-[36px]">{t('shell:crash.title')}</h1>
        <p className="mt-3 text-muted">{t('shell:crash.body')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" onClick={() => window.location.reload()}>
            {t('shell:crash.reload')}
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/">{t('shell:crash.home')}</Link>
          </Button>
        </div>
        <details className="mt-8 rounded-card border-[1.5px] border-line bg-panel p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-muted">{t('shell:crash.details')}</summary>
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs text-muted">{detail}</pre>
        </details>
      </main>
    </div>
  )
}
