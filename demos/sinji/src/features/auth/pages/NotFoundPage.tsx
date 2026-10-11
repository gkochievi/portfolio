import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { SystemMessage } from '@/components/shell/SystemMessage'
import { Button } from '@/components/ui'
import { useAccount } from '@/lib/session'

/** 404 for any unknown path. */
export default function NotFoundPage() {
  const { t } = useTranslation('shell')
  const account = useAccount()
  return (
    <div className="min-h-dvh">
      <SystemMessage
        code={t('notFound.code')}
        title={t('notFound.title')}
        body={t('notFound.body')}
        actions={
          <Button asChild variant="primary">
            <Link to={account?.home ?? '/'}>{t('notFound.home')}</Link>
          </Button>
        }
      />
    </div>
  )
}
