import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ErrorState, EmptyState, Modal, Pill, Skeleton } from '@/components/ui'
import { formatDateTime, personName } from '@/lib/format'
import type { Operator, OperatorAuditLog } from '@/types'

import { useOperatorAudit } from '../api'

type Value = OperatorAuditLog['changes'][string]['from']

const TONE = { created: 'success', updated: 'info', deleted: 'danger' } as const

interface Props {
  operator: Operator | null
  onOpenChange: (open: boolean) => void
}

/** Field-by-field history of one operator (who changed what, from -> to). */
export function AuditLogDialog({ operator, onOpenChange }: Props) {
  const { t, i18n } = useTranslation('adminStaff')
  const tc = useTranslation().t
  const audit = useOperatorAudit(operator?.id ?? null)

  const show = (field: string, value: Value): string => {
    if (value === null || value === '') return t('audit.none')
    if (typeof value === 'boolean') return value ? t('audit.yes') : t('audit.no')
    if (field === 'language') return tc(`lang.${value}`, { defaultValue: String(value) })
    if (field === 'password') return t('audit.passwordChanged')
    if (field === 'operatorNumber') return `#${value}`
    return String(value)
  }

  return (
    <Modal
      open={!!operator}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('audit.title')}
      description={operator ? t('audit.description', { name: personName(operator.name, i18n.language) }) : undefined}
    >
      {audit.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : audit.isError ? (
        <ErrorState title={t('audit.loadError')} onRetry={() => void audit.refetch()} retryLabel={tc('actions.retry')} />
      ) : audit.data.length === 0 ? (
        <EmptyState compact icon={null} title={t('audit.empty')} />
      ) : (
        <ol className="space-y-3">
          {audit.data.map((row) => (
            <li key={row.id} className="rounded-ui border border-line bg-panel p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={TONE[row.action]} size="sm">
                  {t(`audit.actions.${row.action}`)}
                </Pill>
                <span className="text-[13px] text-muted">{t('audit.by', { name: row.performedBy })}</span>
                <time className="tabular ml-auto text-[12px] text-muted" dateTime={row.createdAt}>
                  {formatDateTime(row.createdAt, i18n.language)}
                </time>
              </div>
              {Object.keys(row.changes).length > 0 ? (
                <dl className="mt-2 space-y-1.5">
                  {Object.entries(row.changes).map(([field, change]) => (
                    <div key={field} className="grid gap-x-3 gap-y-0.5 text-[13px] sm:grid-cols-[9rem_1fr]">
                      <dt className="text-muted">{t(`audit.fields.${field}`, { defaultValue: field })}</dt>
                      <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-sunken px-1.5 py-0.5 text-muted line-through decoration-line-strong/60">{show(field, change.from)}</span>
                        <ArrowRight size={14} strokeWidth={1.75} className="shrink-0 text-muted" aria-label={t('audit.to')} />
                        <span className="rounded-md bg-accent-soft px-1.5 py-0.5 font-medium text-ink">{show(field, change.to)}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  )
}
