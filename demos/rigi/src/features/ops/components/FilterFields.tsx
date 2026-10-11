import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui'

/**
 * Filters that live in the URL query. `applied` is what the query is built
 * from; the page keeps a draft and calls `apply(draft)` on Apply.
 */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams()
  const applied = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ''])) as Record<K, string>
  const page = Math.max(1, Number(params.get('page')) || 1)

  const apply = useCallback(
    (next: Partial<Record<K, string>>, nextPage = 1) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev)
          for (const k of keys) {
            const v = next[k]
            if (v) out.set(k, v)
            else out.delete(k)
          }
          if (nextPage > 1) out.set('page', String(nextPage))
          else out.delete('page')
          return out
        },
        { replace: true },
      )
    },
    [keys, setParams],
  )

  const setPage = useCallback(
    (p: number) =>
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev)
          if (p > 1) out.set('page', String(p))
          else out.delete('page')
          return out
        },
        { replace: true },
      ),
    [setParams],
  )

  return { applied, page, apply, setPage }
}

/** "Page N · total" with previous/next, 50 per page. */
export function PageNav({ page, pageSize, total, onPage, loading }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; loading?: boolean }) {
  const { t } = useTranslation('ops')
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-3 py-2 text-[13px]">
      <span className="num text-muted" aria-live="polite">
        {t('pager.summary', { page, pages, total })}
      </span>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" icon={<ChevronLeft />} disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>
          {t('common:actions.previous')}
        </Button>
        <Button size="sm" variant="outline" iconRight={<ChevronRight />} disabled={page >= pages || loading} onClick={() => onPage(page + 1)}>
          {t('common:actions.next')}
        </Button>
      </div>
    </div>
  )
}

/** Compact JSON block pair used by expanded rows. */
export function JsonBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow mb-1">{label}</div>
      {children}
    </div>
  )
}
