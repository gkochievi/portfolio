import { Check } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Avatar, Badge, Button, EmptyState, ErrorState, SearchInput, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { DirectoryEntry } from '@/types'
import { useDirectory } from '../api'

/** Searchable directory picker. Already-registered people are listed but cannot be chosen. */
export function DirectoryPicker({
  selected,
  onSelect,
  error,
}: {
  selected: DirectoryEntry | null
  onSelect: (entry: DirectoryEntry | null) => void
  error?: string
}) {
  const { t } = useTranslation('people')
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const query = useDirectory(search, selected === null)

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-[10px] border border-line-strong bg-sunken p-3">
        <Avatar name={selected.displayName} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{selected.displayName}</p>
          <p className="truncate text-xs text-muted">
            <span className="font-mono">{selected.username}</span> · {selected.email}
          </p>
        </div>
        <Button size="sm" onClick={() => onSelect(null)}>
          {t('directory.change')}
        </Button>
      </div>
    )
  }

  const rows = query.data ?? []
  const registered = rows.filter((r) => r.alreadyRegistered).length

  return (
    <div className={cn('rounded-[10px] border bg-panel', error ? 'border-danger' : 'border-line')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
        <div className="min-w-[180px] flex-1">
          <SearchInput
            value={input}
            onChange={setInput}
            onDebouncedChange={setSearch}
            placeholder={t('directory.searchPlaceholder')}
            aria-label={t('directory.search')}
            autoFocus
          />
        </div>
        {query.data && (
          <span className="tabular text-xs text-muted" aria-live="polite">
            {t('directory.counts', { found: rows.length, registered })}
          </span>
        )}
      </div>
      <div className="max-h-60 overflow-auto" role="listbox" aria-label={t('directory.pick')}>
        {query.isLoading ? (
          <div className="space-y-3 p-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState compact title={t('directory.emptyTitle')} body={t('directory.emptyBody')} />
        ) : (
          rows.map((entry) => (
            <button
              key={entry.username}
              type="button"
              role="option"
              aria-selected={false}
              disabled={entry.alreadyRegistered}
              onClick={() => onSelect(entry)}
              className={cn(
                'flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left last:border-b-0',
                entry.alreadyRegistered ? 'cursor-not-allowed opacity-60' : 'hover:bg-hover focus-visible:bg-hover',
              )}
            >
              <Avatar name={entry.displayName} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{entry.displayName}</span>
                <span className="block truncate text-xs text-muted">
                  <span className="font-mono">{entry.username}</span> · {entry.email}
                </span>
              </span>
              {entry.alreadyRegistered ? (
                <Badge tone="neutral">
                  <Check size={12} strokeWidth={2} aria-hidden /> {t('directory.registered')}
                </Badge>
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
