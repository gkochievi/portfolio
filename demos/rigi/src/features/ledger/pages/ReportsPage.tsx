import { Banknote, Gauge } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Card, CardBody, PageHeader } from '@/components/ui'

export default function ReportsPage() {
  const { t } = useTranslation('ledger')
  const cards = [
    { to: '/accountant/reports/payments', icon: Banknote, title: t('reports.payments.title'), body: t('reports.payments.blurb') },
    { to: '/accountant/reports/unused-allowance', icon: Gauge, title: t('reports.unused.title'), body: t('reports.unused.blurb') },
  ]
  return (
    <>
      <PageHeader eyebrow={t('reports.eyebrow')} title={t('reports.title')} description={t('reports.description')} />
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="group block focus-visible:outline-none">
            <Card className="h-full transition-colors group-hover:bg-row-hover group-focus-visible:border-signal">
              <CardBody className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-sunken text-ink">
                  <c.icon className="size-5 stroke-[1.75]" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold">{c.title}</h2>
                  <p className="mt-1 text-sm text-muted">{c.body}</p>
                  <span className="link mt-3 inline-block text-sm">{t('reports.open')}</span>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
