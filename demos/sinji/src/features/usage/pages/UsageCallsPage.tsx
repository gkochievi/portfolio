import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import { Button, Callout, EmptyState, Toolbar, type SortState } from '@/components/ui'
import { formatNumber } from '@/lib/format'
import { useCalls } from '../api'
import { ListSearch } from '../components/ListSearch'
import { CallsTable } from '../components/parts'
import { useUsageParams } from '../params'

/** Every AI call, newest first: search, sort, 50 per page. */
export default function UsageCallsPage() {
  const { t, i18n } = useTranslation('usage')
  const lang = i18n.language
  const { search } = useLocation()
  const { filters, tab, setTab, clearFilters, activeCount } = useUsageParams()
  const query = useCalls(filters, tab, 50)
  const sort: SortState = { key: tab.sort ?? 'created_at', dir: tab.dir ?? 'desc' }

  if (query.isError && !query.data) {
    return (
      <Callout tone="danger" title={t('error.title')} action={<Button size="sm" onClick={() => void query.refetch()}>{t('error.retry')}</Button>}>
        {t('error.body')}
      </Callout>
    )
  }

  return (
    <div>
      <Toolbar end={<span className="text-[12.5px] text-muted">{query.data ? t('calls.count', { count: query.data.total, n: formatNumber(query.data.total, lang) }) : null}</span>}>
        <ListSearch placeholder={t('calls.search')} />
      </Toolbar>
      <CallsTable
        rows={query.data?.items}
        loading={query.isLoading}
        search={search}
        sort={sort}
        onSortChange={(s) => setTab({ sort: s?.key, dir: s?.dir })}
        serverPagination={{
          page: query.data?.page ?? tab.page,
          pageSize: query.data?.page_size ?? 50,
          total: query.data?.total ?? 0,
          onPageChange: (page) => setTab({ page }),
        }}
        caption={t('calls.caption')}
        empty={
          <EmptyState
            compact
            title={t('calls.empty.title')}
            body={t('calls.empty.body')}
            action={tab.q || activeCount > 0 ? <Button size="sm" onClick={() => { setTab({ q: undefined }); clearFilters() }}>{t('filters.clear')}</Button> : undefined}
          />
        }
      />
    </div>
  )
}
