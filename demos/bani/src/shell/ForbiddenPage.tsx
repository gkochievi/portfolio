/** 403: shown when a persona can open nothing, or a feature is named explicitly. */
import { ShieldOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui'
import type { FeatureKey } from '@/types'

export function ForbiddenPage({ feature }: { feature?: FeatureKey }) {
  const { t } = useTranslation('shell')
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-warning/12 text-warning">
        <ShieldOff size={22} strokeWidth={1.75} aria-hidden />
      </span>
      <p className="font-mono text-[13px] text-muted">403</p>
      <h1 className="mt-1 text-[24px] font-bold">{t('forbidden.title')}</h1>
      <p className="mt-2 text-muted">
        {t('forbidden.body', { feature: feature ? t(`common:features.${feature}`) : t('common:product.name') })}
      </p>
      <Button asChild variant="secondary" className="mt-6">
        <Link to="/login">{t('forbidden.home')}</Link>
      </Button>
    </section>
  )
}

export default ForbiddenPage
