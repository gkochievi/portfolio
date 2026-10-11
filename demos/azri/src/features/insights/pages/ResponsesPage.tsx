/**
 * Responses (/console/responses): filterable, searchable, paginated feed of every
 * response; row click opens the detail drawer synced to ?open=<id>. New rows
 * arrive live (bus → query invalidation) and flash. Owner: feature group insights.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { DataTable, ErrorState, LiveDot, PageHeader, Stars, type Column } from '@/components/ui'
import { clock } from '@/demo/core'
import { useLang } from '@/hooks/useLang'
import { formatDateTime, formatNumber, formatRating, formatRelative } from '@/lib/format'
import { lt } from '@/lib/utils'
import type { ResponseRow } from '@/types'
import { useInsightsFilters, useResponses } from '../api'
import { InsightsFilterBar } from '../components/InsightsFilterBar'
import { ResponseDrawer } from '../components/ResponseDrawer'
import { isJustNow, JustNowBadge, LangTag, TenantMarkFor } from '../components/shared'

const HIGHLIGHT_MS = 4500

export default function ResponsesPage() {
  const { t } = useTranslation('insights')
  const lang = useLang()
  const [searchParams, setSearchParams] = useSearchParams()
  const { filters, update } = useInsightsFilters()
  const responses = useResponses(filters)
  const data = responses.data

  const openId = searchParams.get('open')
  const setOpen = (id: string | null) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id) next.set('open', id)
        else next.delete('open')
        return next
      },
      { replace: !id },
    )

  /* Live highlight: ids that appear in the same view after the first load. */
  const viewKey = JSON.stringify({ ...filters })
  const seen = useRef<{ key: string; ids: Set<string> } | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!data || responses.isPlaceholderData) return
    const ids = data.items.map((row) => row.id)
    const previous = seen.current
    if (previous && previous.key === viewKey) {
      const added = ids.filter((id) => !previous.ids.has(id))
      if (added.length) {
        setFresh(new Set(added))
        for (const id of ids) previous.ids.add(id)
        const timer = window.setTimeout(() => setFresh(new Set()), HIGHLIGHT_MS)
        return () => window.clearTimeout(timer)
      }
    } else {
      seen.current = { key: viewKey, ids: new Set(ids) }
      setFresh(new Set())
    }
    return undefined
  }, [data, responses.isPlaceholderData, viewKey])

  const columns = useMemo<Column<ResponseRow>[]>(
    () => [
      {
        id: 'time',
        header: t('table.time'),
        cell: (row) => (
          <span className="flex flex-col gap-1">
            <time dateTime={row.submittedAt} title={formatDateTime(row.submittedAt, lang)} className="whitespace-nowrap text-ink">
              {formatRelative(row.submittedAt, lang, clock.now())}
            </time>
            {isJustNow(row) && (
              <span>
                <JustNowBadge />
              </span>
            )}
          </span>
        ),
        width: '9.5rem',
      },
      {
        id: 'tenant',
        header: t('common:filters.tenant'),
        cell: (row) => (
          <span className="flex min-w-0 items-center gap-2">
            <TenantMarkFor tenantId={row.tenantId} size="xs" />
            <span className="truncate">{lt(row.tenantName, lang)}</span>
          </span>
        ),
        hideBelow: 'md',
      },
      {
        id: 'branch',
        header: t('table.branchStaff'),
        cell: (row) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-ink">{lt(row.branchName, lang)}</span>
            <span className="truncate text-xs text-muted">{lt(row.staffName, lang)}</span>
          </span>
        ),
      },
      {
        id: 'rating',
        header: t('table.rating'),
        cell: (row) =>
          row.avgRating == null ? (
            <span className="text-subtle">—</span>
          ) : (
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <Stars value={row.avgRating} size={13} className="text-primary" />
              <span className="tabular text-xs font-medium text-muted">{formatRating(row.avgRating, lang)}</span>
            </span>
          ),
      },
      {
        id: 'comment',
        header: t('table.comment'),
        cell: (row) =>
          row.comment.trim() ? (
            <span className="flex min-w-0 items-center gap-2">
              <LangTag lang={row.commentLang} />
              <span lang={row.commentLang} className="line-clamp-1 text-ink">
                {row.comment}
              </span>
            </span>
          ) : (
            <span className="text-subtle">{t('table.noComment')}</span>
          ),
        hideBelow: 'sm',
        className: 'max-w-[22rem]',
      },
    ],
    [t, lang],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('overview.eyebrow')}
        title={t('responses.title')}
        description={t('responses.description')}
        actions={
          <span className="inline-flex items-center gap-2 rounded-full bg-panel px-3 py-1.5 text-xs font-medium text-muted ring-1 ring-border">
            <LiveDot tone="accent" />
            {data
              ? t('responses.count', { count: data.total, formatted: formatNumber(data.total, lang) })
              : t('overview.live')}
          </span>
        }
      />

      <InsightsFilterBar extended />

      {responses.isError && !data ? (
        <ErrorState description={t('common:errors.loadFailed')} onRetry={() => void responses.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={data?.items}
          getRowId={(row) => row.id}
          loading={responses.isLoading}
          skeletonRows={8}
          onRowClick={(row) => setOpen(row.id)}
          isRowActive={(row) => row.id === openId}
          highlightIds={fresh}
          caption={t('responses.title')}
          empty={{ title: t('common:table.noResults'), description: t('common:table.noResultsHint') }}
          pagination={
            data && data.total > data.pageSize
              ? { page: data.page, pageSize: data.pageSize, total: data.total, onPageChange: (page) => update({ page }) }
              : undefined
          }
        />
      )}

      <ResponseDrawer responseId={openId} onClose={() => setOpen(null)} />
    </div>
  )
}
