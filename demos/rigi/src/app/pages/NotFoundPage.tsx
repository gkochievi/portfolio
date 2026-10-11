/** Route *. Owner: shell. */
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { SystemScreen } from '@/components/layout/SystemScreen'
import { Button, Mono } from '@/components/ui'
import { useMe } from '@/lib/session'

export default function NotFoundPage() {
  const { t } = useTranslation('shell')
  const me = useMe()
  const { pathname } = useLocation()
  return (
    <SystemScreen
      code="404"
      title={t('system.notFound.title')}
      body={<>{t('system.notFound.body')} <Mono>{pathname}</Mono></>}
      actions={<Button asChild><Link to={me?.home ?? '/login'}>{t('system.goHome')}</Link></Button>}
    />
  )
}
