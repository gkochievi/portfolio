import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'

import { Button } from '@/components/ui'
import { SystemMessage } from './SystemMessage'

/** Router errorElement: friendly crash screen (404 responses show the not-found copy). */
export function RouteError() {
  const { t } = useTranslation('shell')
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  const detail = error instanceof Error ? error.message : isRouteErrorResponse(error) ? error.statusText : null
  return (
    <div className="min-h-dvh bg-bg">
      <SystemMessage
        code={notFound ? '404' : undefined}
        title={notFound ? t('notFound.title') : t('error.title')}
        body={
          <>
            {notFound ? t('notFound.body') : t('error.body')}
            {detail && !notFound ? <code className="mt-3 block break-words font-mono text-xs text-subtle">{detail}</code> : null}
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              {t('error.reload')}
            </Button>
            <Button asChild variant="primary">
              <Link to="/">{t('error.home')}</Link>
            </Button>
          </>
        }
      />
    </div>
  )
}
