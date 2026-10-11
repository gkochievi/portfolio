/** Small pieces shared by the three insight pages and the transcript dialog. */
import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge, type BadgeTone } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { EndCategory, Lang } from '@/types'

export function useLang(): Lang {
  const { i18n } = useTranslation()
  return i18n.language?.startsWith('ka') ? 'ka' : 'en'
}

/** 1-5 stars (filled up to the rating) with an accessible label. */
export function Stars({ rating, size = 14, className }: { rating: number | null | undefined; size?: number; className?: string }) {
  const { t } = useTranslation('adminInsights')
  if (!rating) return <span className="text-muted">-</span>
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} role="img" aria-label={t('rating', { count: rating })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} width={size} height={size} strokeWidth={1.75} className={n <= rating ? 'fill-primary text-ink' : 'text-line-strong'} aria-hidden />
      ))}
    </span>
  )
}

const CATEGORY_TONE: Record<EndCategory, BadgeTone> = { operator: 'accent', customer: 'info', system: 'muted', missed: 'warning' }

export function EndCategoryBadge({ category }: { category: EndCategory | null }) {
  const { t } = useTranslation()
  if (!category) return <span className="text-muted">-</span>
  return <Badge tone={CATEGORY_TONE[category]}>{t(`endCategory.${category}`)}</Badge>
}
