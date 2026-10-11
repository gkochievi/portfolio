import { useTranslation } from 'react-i18next'

import { formatPoints } from '@/lib/format'

/** "12.5 pts", or "Pricing pending" / "Pending" while staff have not priced a custom request. */
export function PointsText({ points, pricingPending, short }: { points: number | null; pricingPending: boolean; short?: boolean }) {
  const { t } = useTranslation('portal')
  if (pricingPending || points === null) {
    return <span className="text-muted">{short ? t('list.pointsPending') : t('task.pricingPending')}</span>
  }
  return <span className="num">{formatPoints(points)}</span>
}

/** Local `YYYY-MM-DD` of an ISO timestamp (deadlines are stored at 23:59:59 local). */
export function localDay(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayDay(): string {
  return localDay(new Date().toISOString())
}
