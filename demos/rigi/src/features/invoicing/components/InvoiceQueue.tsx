import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Card, CardHeader, DateText, EmptyState, Mono, Money, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'

import type { InvoiceRow } from '../api'
import { InvoiceStatusCell } from './InvoiceStatusCell'

interface InvoiceQueueProps {
  title: string
  description?: string
  rows: InvoiceRow[] | undefined
  /** Which date to show on the right. */
  dateOf: (row: InvoiceRow) => string | null
  dateLabel: string
  viewAll?: { to: string; label: string; count?: number }
  emptyIcon?: ReactNode
}

/** A "queue" list of invoices: the first row gets the 3px now-serving rule. */
export function InvoiceQueue({ title, description, rows, dateOf, dateLabel, viewAll }: InvoiceQueueProps) {
  const { t } = useTranslation(['invoicing', 'common'])
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={title}
        description={description}
        actions={
          viewAll ? (
            <Link to={viewAll.to} className="link inline-flex items-center gap-1 text-sm">
              {viewAll.label}
              {viewAll.count !== undefined ? <span className="num text-muted">({viewAll.count})</span> : null}
              <ArrowRight className="size-3.5 stroke-[1.75]" />
            </Link>
          ) : null
        }
      />
      {rows === undefined ? (
        <div className="flex flex-col gap-2 p-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState compact title={t('common:states.allCaughtUp')} />
        </div>
      ) : (
        <ul className="divide-y divide-hairline">
          {rows.map((row, i) => (
            <li key={row.id} className={cn('animate-rise', i === 0 && 'serving')}>
              <Link
                to={`/accountant/invoices/${row.id}`}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-row-hover"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Mono>{row.invoiceNumber}</Mono>
                    <InvoiceStatusCell invoice={row} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-ink">{row.partnerName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium num">
                    <Money amount={row.total} currency={row.currency} />
                  </p>
                  <p className="text-xs text-muted">
                    {dateLabel} {dateOf(row) ? <DateText value={dateOf(row) as string} /> : '—'}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
