import { RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'

import { AzriLogo } from '@/components/brand/Logo'
import { Button, Illustration } from '@/components/ui'

/** Router errorElement: crash screen with a reload button. Owner: shell agent. */
export function RouteError() {
  const error = useRouteError()
  const { t } = useTranslation('shell')
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : null

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-surface px-5 py-12 text-center text-ink">
      <AzriLogo size={26} />
      <Illustration kind="error" size={200} />
      <div className="max-w-md">
        <h1 className="font-display text-2xl font-semibold">{t('error.title')}</h1>
        <p className="mt-2 text-sm text-muted">{t('error.body')}</p>
        {message && <p className="mt-3 rounded-xl bg-sunken px-3 py-2 font-mono text-xs text-muted">{message}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button leftIcon={<RotateCcw strokeWidth={1.75} />} onClick={() => window.location.reload()}>
          {t('error.reload')}
        </Button>
        <Button asChild variant="secondary">
          <Link to="/">{t('error.home')}</Link>
        </Button>
      </div>
    </main>
  )
}
