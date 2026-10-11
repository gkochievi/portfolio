import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { PolyphonyMotif } from '@/components/brand'
import { Button } from '@/components/ui'

export default function NotFoundPage() {
  const { t } = useTranslation('shell')
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <PolyphonyMotif className="mb-6 w-48" animate dots />
      <p className="font-mono text-[13px] text-muted">404</p>
      <h1 className="mt-1 text-[24px] font-bold">{t('notFound.title')}</h1>
      <p className="mt-2 text-muted">{t('notFound.body')}</p>
      <Button asChild variant="primary" className="mt-6">
        <Link to="/">
          <ArrowLeft size={16} aria-hidden />
          {t('notFound.home')}
        </Link>
      </Button>
    </section>
  )
}
