/**
 * Link not valid (/invalid): the token is not one the CRM ever issued.
 * Owner: feature group survey.
 */
import { Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui'
import { EndScreen } from '../components/EndScreen'

export default function InvalidLinkPage() {
  const { t } = useTranslation('survey')
  return (
    <EndScreen illustration="invalid" title={t('invalid.title')} description={t('invalid.description')}>
      <Button asChild variant="brand" size="lg" fullWidth leftIcon={<Inbox strokeWidth={1.75} />}>
        <Link to="/">{t('demo.backToInbox')}</Link>
      </Button>
      <p className="text-xs text-muted">{t('invalid.hint')}</p>
    </EndScreen>
  )
}
