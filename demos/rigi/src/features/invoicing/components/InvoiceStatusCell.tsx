import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge, Tooltip } from '@/components/ui'
import { InvoiceStatusChip } from '@/components/status'
import { formatDate } from '@/lib/format'
import type { Invoice } from '@/types'

/** Status chip plus the disputed marker (a dispute never changes the status). */
export function InvoiceStatusCell({ invoice }: { invoice: Pick<Invoice, 'status' | 'disputedAt' | 'disputeReason'> }) {
  const { t } = useTranslation('invoicing')
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <InvoiceStatusChip status={invoice.status} />
      {invoice.disputedAt ? (
        <Tooltip content={`${t('dispute.marker')} · ${formatDate(invoice.disputedAt)}${invoice.disputeReason ? ` — ${invoice.disputeReason}` : ''}`}>
          <span>
            <Badge tone="accent" icon={<AlertTriangle className="size-3 stroke-[1.75]" />} dot={false}>
              {t('dispute.marker')}
            </Badge>
          </span>
        </Tooltip>
      ) : null}
    </span>
  )
}
