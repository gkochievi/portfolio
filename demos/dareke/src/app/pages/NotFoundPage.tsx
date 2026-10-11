/** 404 inside the signed-in shell. */
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { DialMotif } from '@/components/brand'
import { Button } from '@/components/ui'

export default function NotFoundPage() {
  const { t } = useTranslation('shell')
  return (
    <section className="grid min-h-[60vh] place-items-center text-center">
      <div className="flex flex-col items-center">
        <DialMotif size={160} litLeads={0} />
        <p className="mt-6 font-mono text-sm text-muted">404</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-[-0.02em]">{t('notFound')}</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">{t('notFoundHint')}</p>
        <Button asChild variant="dial" className="mt-6">
          <Link to="/">
            <ArrowLeft size={18} strokeWidth={1.75} />
            {t('backHome')}
          </Link>
        </Button>
      </div>
    </section>
  )
}
