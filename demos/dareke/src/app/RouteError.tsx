/** Router errorElement. */
import { RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

import { Mark } from '@/components/brand'
import { Button } from '@/components/ui'

export function RouteError() {
  const error = useRouteError()
  const { t } = useTranslation('shell')
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : String(error)
  return (
    <div className="grid min-h-screen place-items-center bg-paper p-6 text-center text-ink">
      <div className="flex max-w-md flex-col items-center">
        <Mark size={44} />
        <h1 className="mt-5 font-display text-2xl font-bold tracking-[-0.02em]">{t('error.title')}</h1>
        <p className="mt-2 text-sm text-muted">{t('error.hint')}</p>
        <pre className="mt-4 max-w-full overflow-x-auto rounded-control border border-hairline bg-panel px-3 py-2 text-left font-mono text-xs whitespace-pre-wrap text-muted">
          {message}
        </pre>
        <Button variant="dial" className="mt-6" icon={<RotateCcw size={16} strokeWidth={1.75} />} onClick={() => window.location.reload()}>
          {t('error.reload')}
        </Button>
      </div>
    </div>
  )
}
