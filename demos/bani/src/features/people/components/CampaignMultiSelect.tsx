import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Checkbox, ErrorState, SearchInput, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useCampaignOptions } from '../api'

/** Multi-select of outbound campaigns: search, select all (visible), clear, "N selected". */
export function CampaignMultiSelect({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useTranslation('people')
  const query = useCampaignOptions(true)
  const [search, setSearch] = useState('')
  const selected = useMemo(() => new Set(value), [value])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (query.data ?? []).filter((c) => !needle || c.name.toLowerCase().includes(needle))
  }, [query.data, search])

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected)
    if (on) next.add(id)
    else next.delete(id)
    onChange([...next])
  }

  return (
    <div className="rounded-[10px] border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
        <div className="min-w-[160px] flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder={t('campaigns.search')} aria-label={t('campaigns.search')} />
        </div>
        <Button size="sm" onClick={() => onChange([...new Set([...value, ...visible.map((c) => c.id)])])} disabled={visible.length === 0}>
          {t('campaigns.selectAll')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onChange([])} disabled={value.length === 0}>
          {t('campaigns.clear')}
        </Button>
        <span className={cn('tabular text-xs', value.length > 0 ? 'text-primary' : 'text-muted')} aria-live="polite">
          {t('campaigns.selected', { count: value.length })}
        </span>
      </div>
      <div className="max-h-48 overflow-auto p-1">
        {query.isLoading ? (
          <div className="space-y-2 p-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : query.isError ? (
          <ErrorState error={t('campaigns.error')} onRetry={() => void query.refetch()} />
        ) : visible.length === 0 ? (
          <p className="p-3 text-sm text-muted">{t('campaigns.empty')}</p>
        ) : (
          visible.map((c) => (
            <div key={c.id} className="rounded-[6px] px-2 py-1.5 hover:bg-hover">
              <Checkbox checked={selected.has(c.id)} onCheckedChange={(on) => toggle(c.id, on)} label={c.name} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
