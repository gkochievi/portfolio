/** Route /403. Owner: shell. */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { SystemScreen } from '@/components/layout/SystemScreen'
import { Button } from '@/components/ui'
import { signOutTo, useMe } from '@/lib/session'

export default function ForbiddenPage() {
  const { t } = useTranslation('shell')
  const me = useMe()
  return (
    <SystemScreen
      code="403"
      title={t('system.forbidden.title')}
      body={me ? t('system.forbidden.body', { role: t(`common:role.${me.role}`) }) : t('system.forbidden.bodySignedOut')}
      actions={
        <>
          <Button asChild><Link to={me?.home ?? '/login'}>{me ? t('system.goHome') : t('common:actions.signIn')}</Link></Button>
          {me ? <Button variant="secondary" onClick={() => void signOutTo()}>{t('system.forbidden.switch')}</Button> : null}
        </>
      }
    />
  )
}
