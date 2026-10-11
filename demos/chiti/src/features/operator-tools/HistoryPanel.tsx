import { useState } from 'react'
import { History, Star, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Avatar } from '@/components/Avatar'
import { EmptyState, ErrorState, IconButton, Pagination, SearchInput, SkeletonRow } from '@/components/ui'
import { TranscriptDialog } from '@/features/admin-insights/TranscriptDialog'
import { cn } from '@/lib/cn'
import { formatSmartDate } from '@/lib/format'

import { useOperatorHistory } from './api'
import { ChannelTag } from './components/shared'

/**
 * The operator's History panel: search ended chats and open a read-only
 * transcript.
 */
export interface HistoryPanelProps {
  onClose?: () => void
}

export function HistoryPanel({ onClose }: HistoryPanelProps) {
  const { t, i18n } = useTranslation('operatorTools')
  const { t: tc } = useTranslation()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const history = useOperatorHistory({ q: query, page })
  const data = history.data
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <aside aria-label={t('history.title')} className="flex h-full min-h-0 w-full flex-col bg-panel">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
          <History size={18} strokeWidth={1.75} aria-hidden />
          {t('history.title')}
          {data ? <span className="tabular text-xs font-normal text-muted">{data.total}</span> : null}
        </h2>
        {onClose ? <IconButton size="sm" variant="muted" label={tc('actions.close')} icon={<X />} onClick={onClose} /> : null}
      </header>

      <div className="border-b border-line px-4 py-3">
        <SearchInput
          value={query}
          onChange={(value) => {
            setQuery(value)
            setPage(1)
          }}
          debounceMs={250}
          placeholder={t('history.search')}
          size="sm"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={history.isFetching}>
        {history.isLoading ? (
          <div className="space-y-1 p-3">
            {Array.from({ length: 6 }, (_, index) => (
              <SkeletonRow key={index} />
            ))}
          </div>
        ) : history.isError ? (
          <ErrorState title={t('history.loadError')} onRetry={() => void history.refetch()} retryLabel={tc('actions.retry')} />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState compact title={query ? t('history.noResults') : t('history.empty')} description={query ? t('history.noResultsBody') : t('history.emptyBody')} />
        ) : (
          <ul className={cn('divide-y divide-line', history.isPlaceholderData && 'opacity-60 transition-opacity')}>
            {data.rows.map((chat) => (
              <li key={chat.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(chat.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                >
                  <Avatar name={chat.externalContact?.displayName ?? chat.customerName} avatarId={chat.externalContact?.avatarId ?? null} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink">{chat.externalContact?.displayName ?? chat.customerName}</span>
                      <span className="tabular shrink-0 text-xs text-muted">{formatSmartDate(chat.endedAt ?? chat.lastActivity, i18n.language)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <ChannelTag channel={chat.channel} />
                      {chat.rating ? (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted" aria-label={t('history.rating', { count: chat.rating })}>
                          <Star size={12} strokeWidth={1.75} aria-hidden />
                          {chat.rating}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-muted">{chat.endSummary ?? chat.lastMessage?.text ?? t('history.noPreview')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data && data.total > data.pageSize ? (
        <footer className="border-t border-line px-3 py-2">
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={data.total} pageSize={data.pageSize} />
        </footer>
      ) : null}

      <TranscriptDialog sessionId={openId} onOpenChange={(open) => !open && setOpenId(null)} />
    </aside>
  )
}
