/** `/widget`: the same card full page (`?tenant=<slug>`; gza = disabled, unknown = not found). */
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Wordmark } from '@/components/brand'

import { ChitiWidget } from '../components/ChitiWidget'

const SAMPLES = ['vazi', 'gza', 'nowhere'] as const

export default function WidgetPage() {
  const { t } = useTranslation('widget')
  const [params] = useSearchParams()
  const slug = (params.get('tenant') ?? 'vazi').trim().toLowerCase() || 'vazi'

  return (
    <main className="flex min-h-dvh flex-col items-center gap-4 bg-bg px-4 py-6 text-ink">
      <header className="flex w-full max-w-[380px] flex-col items-center gap-1 text-center">
        <Wordmark size={24} />
        <h1 className="m-0 mt-1 font-display text-[18px] font-semibold">{t('widgetPage.title')}</h1>
        <p className="m-0 text-[13px] text-muted">{t('widgetPage.subtitle')}</p>
      </header>

      <ChitiWidget slug={slug} mode="page" />

      <nav aria-label={t('widgetPage.tenants')} className="flex flex-wrap items-center justify-center gap-2 text-[12.5px] text-muted">
        <span>{t('widgetPage.tenants')}</span>
        {SAMPLES.map((sample) => (
          <Link
            key={sample}
            to={`/widget?tenant=${sample}`}
            aria-current={sample === slug ? 'page' : undefined}
            className={sample === slug ? 'rounded-full bg-primary px-2.5 py-0.5 font-medium text-on-primary no-underline' : 'rounded-full border border-line px-2.5 py-0.5 text-ink no-underline hover:bg-hover'}
          >
            {t(`widgetPage.sample.${sample}`)}
          </Link>
        ))}
      </nav>
      <Link to="/" className="link inline-flex items-center gap-1.5 text-[13px]">
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        {t('widgetPage.back')}
      </Link>
    </main>
  )
}
