import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge, ScorePill, TenantMark } from '@/components/ui'
import { clock } from '@/demo/core'
import { useLang } from '@/hooks/useLang'
import { useMeta } from '@/hooks/useMeta'
import { formatRelative } from '@/lib/format'
import { cn, lt } from '@/lib/utils'
import type { Lang, ResponseRow } from '@/types'

const JUST_NOW_MS = 10 * 60_000

/** A response this visitor submitted in this session less than 10 minutes ago (demo clock). */
export function isJustNow(row: Pick<ResponseRow, 'source' | 'submittedAt'>): boolean {
  if (row.source !== 'session') return false
  const age = clock.now().getTime() - new Date(row.submittedAt).getTime()
  return age >= -60_000 && age < JUST_NOW_MS
}

export function JustNowBadge() {
  const { t } = useTranslation('insights')
  return (
    <Badge tone="accent" size="sm" icon={<Sparkles size={12} strokeWidth={1.75} />}>
      {t('common:status.justNow')}
    </Badge>
  )
}

/** "KA" / "EN" tag: the comment's own language (comments are never translated). */
export function LangTag({ lang }: { lang: Lang }) {
  const { t } = useTranslation('insights')
  return (
    <Badge tone="neutral" variant="outline" size="sm" mono>
      <span aria-hidden>{t(`common:lang.${lang}`)}</span>
      <span className="sr-only">{t(`commentLang.${lang}`)}</span>
    </Badge>
  )
}

/** Tenant monogram tile for a tenant id (from /meta). */
export function TenantMarkFor({ tenantId, size = 'sm' }: { tenantId: string; size?: 'xs' | 'sm' | 'md' }) {
  const meta = useMeta()
  const lang = useLang()
  const tenant = meta.data?.tenants.find((x) => x.id === tenantId)
  if (!tenant) return <span className="inline-block size-8 shrink-0 rounded-bubble-sm bg-sunken" aria-hidden />
  return (
    <TenantMark
      monogram={tenant.monogram}
      primary={tenant.primary}
      onPrimary={tenant.onPrimary}
      size={size}
      title={lt(tenant.name, lang)}
    />
  )
}

/** One entry of the latest-comments feed. */
export function CommentItem({ row, className }: { row: ResponseRow; className?: string }) {
  const { t } = useTranslation('insights')
  const lang = useLang()
  return (
    <Link
      to={`/console/responses?open=${encodeURIComponent(row.id)}`}
      className={cn(
        'group flex gap-3 rounded-2xl p-3 transition-colors hover:bg-panel-2 focus-visible:bg-panel-2 focus-visible:outline-none',
        className,
      )}
      aria-label={t('comments.openResponse', { tenant: lt(row.tenantName, lang) })}
    >
      <TenantMarkFor tenantId={row.tenantId} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ScorePill value={row.avgRating} size="sm" />
          <span className="truncate text-sm font-medium text-ink">{lt(row.branchName, lang)}</span>
          <span className="text-xs text-muted">· {lt(row.staffName, lang)}</span>
          {isJustNow(row) && <JustNowBadge />}
        </div>
        <p
          lang={row.commentLang}
          className="mt-1.5 line-clamp-3 rounded-bubble-sm bg-panel-2 px-3 py-2 text-sm leading-relaxed text-ink group-hover:bg-panel"
        >
          {row.comment}
        </p>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          <LangTag lang={row.commentLang} />
          <time dateTime={row.submittedAt}>{formatRelative(row.submittedAt, lang, clock.now())}</time>
        </div>
      </div>
    </Link>
  )
}
