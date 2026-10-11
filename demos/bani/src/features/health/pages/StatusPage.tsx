import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorState, LiveDot, PageHeader } from '@/components/ui'
import { useSelfTest, useRunSelfTest } from '../api'
import { LiveTiles } from '../components/LiveTiles'
import { SelfTestCards, SelfTestHistory } from '../components/SelfTest'
import { Snapshot } from '../components/Snapshot'
import { StatusBanner } from '../components/StatusBanner'
import { VoiceLanes } from '../components/VoiceLanes'

export default function StatusPage() {
  const { t } = useTranslation('health')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const overview = useSelfTest(page, pageSize)
  const run = useRunSelfTest((r) => {
    setPage(1)
    toast[r.failed ? 'warning' : 'success'](t('run.done', { status: t(`history.state.${r.status}`) }))
  })

  const data = overview.data
  const collector = data?.collectorRunning ?? false

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('page.title')}
        subtitle={t('page.subtitle')}
        meta={
          <span className="flex items-center gap-2 text-[13px] text-muted">
            <LiveDot tone={collector ? 'success' : 'neutral'} still={!collector} />
            {collector ? t('collector.running') : t('collector.stopped')}
          </span>
        }
      />
      {overview.isError && !data ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : (
        <StatusBanner overview={data} loading={overview.isLoading} running={run.isPending} onRun={() => run.mutate()} />
      )}
      <VoiceLanes />
      <LiveTiles />
      <SelfTestCards run={data?.latest} running={run.isPending} />
      <SelfTestHistory
        history={data?.history}
        loading={overview.isLoading}
        page={page}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={(s) => {
          setPageSize(s)
          setPage(1)
        }}
      />
      <Snapshot />
    </div>
  )
}
