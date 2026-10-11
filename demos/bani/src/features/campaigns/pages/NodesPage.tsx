import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, EmptyState, ErrorState, PageHeader, Skeleton, StatusChip } from '@/components/ui'
import { fmtTime } from '@/lib/format'
import { useLang } from '@/shell/state'
import { NODES_REFRESH_MS, useNodes } from '../api'
import { NodeCard } from '../components/NodeCard'

export default function NodesPage() {
  const { t } = useTranslation('campaigns')
  const lang = useLang()
  const query = useNodes()
  const nodes = query.data ?? []
  const upCount = nodes.filter((n) => n.status === 'up').length
  const downCount = nodes.length - upCount

  return (
    <div>
      <PageHeader
        title={t('nodes.title')}
        subtitle={t('nodes.subtitle')}
        meta={
          <>
            {query.dataUpdatedAt > 0 && (
              <span>{t('nodes.lastUpdated', { time: fmtTime(new Date(query.dataUpdatedAt).toISOString(), lang, { seconds: true }) })}</span>
            )}
            <span aria-hidden>·</span>
            <span>{t('nodes.autoRefresh', { s: NODES_REFRESH_MS / 1000 })}</span>
            {nodes.length > 0 && (
              <>
                <StatusChip tone="success" size="sm">{t('nodes.upCount', { n: upCount })}</StatusChip>
                {downCount > 0 && <StatusChip tone="danger" size="sm">{t('nodes.downCount', { n: downCount })}</StatusChip>}
              </>
            )}
          </>
        }
        actions={
          <Button icon={RefreshCw} loading={query.isFetching} onClick={() => void query.refetch()}>
            {t('nodes.refresh')}
          </Button>
        }
      />

      {query.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[230px] w-full rounded-[10px]" />
          ))}
        </div>
      ) : query.isError && !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : nodes.length === 0 ? (
        <EmptyState title={t('nodes.empty')} body={t('nodes.emptyBody')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {nodes.map((node) => (
            <NodeCard key={node.id} node={node} />
          ))}
        </div>
      )}
    </div>
  )
}
