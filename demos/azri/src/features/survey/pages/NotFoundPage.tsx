/**
 * Page not found (*, inside SiteLayout). Owner: feature group survey.
 */
import { Braces, Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui'
import { EndScreen } from '../components/EndScreen'

export default function NotFoundPage() {
  const { t } = useTranslation('survey')
  return (
    <div className="mx-auto w-full max-w-md">
      <EndScreen illustration="not-found" eyebrow="404" title={t('notFound.title')} description={t('notFound.description')}>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button asChild variant="primary" size="lg" fullWidth leftIcon={<Inbox strokeWidth={1.75} />}>
            <Link to="/">{t('demo.backToInbox')}</Link>
          </Button>
          <Button asChild variant="secondary" size="lg" fullWidth leftIcon={<Braces strokeWidth={1.75} />}>
            <Link to="/playground">{t('notFound.playground')}</Link>
          </Button>
        </div>
      </EndScreen>
    </div>
  )
}
