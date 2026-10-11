import { useTranslation } from 'react-i18next'

import type { WorkingHoursStatus } from '@/types'
import { formatSmartDate } from '@/lib/format'
import { Badge, Tooltip } from '@/components/ui'

/** Open / Closed pill from the tenant's working hours. */
export function HoursPill({ status }: { status: WorkingHoursStatus | null | undefined }) {
  const { t, i18n } = useTranslation('shell')
  if (!status) return null
  const tip = status.isOpen
    ? status.todayEnd
      ? t('header.openUntil', { time: status.todayEnd })
      : undefined
    : status.nextOpen
      ? t('header.closedUntil', { time: formatSmartDate(status.nextOpen, i18n.language) })
      : undefined
  return (
    <Tooltip content={tip}>
      <span tabIndex={tip ? 0 : undefined} className="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-accent">
        <Badge tone={status.isOpen ? 'success' : 'danger'} dot>
          {status.isOpen ? t('header.open') : t('header.closed')}
        </Badge>
      </span>
    </Tooltip>
  )
}
