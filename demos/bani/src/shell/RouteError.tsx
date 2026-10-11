/** Route-level error element: a calm message and a reload. */
import { RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

import { PolyphonyMotif } from '@/components/brand'
import { Button } from '@/components/ui'
import NotFoundPage from './NotFoundPage'

export function RouteError() {
  const error = useRouteError()
  const { t } = useTranslation('shell')
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />
  const message = error instanceof Error ? error.message : undefined
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <PolyphonyMotif className="mb-6 w-40" />
      <h1 className="text-[22px] font-bold">{t('errors.title')}</h1>
      <p className="mt-2 text-muted">{t('errors.body')}</p>
      {message && <p className="mt-3 max-w-full break-words font-mono text-[12px] text-faint">{message}</p>}
      <Button variant="primary" icon={RotateCw} className="mt-6" onClick={() => window.location.reload()}>
        {t('errors.reload')}
      </Button>
    </section>
  )
}
