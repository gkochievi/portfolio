import { RefreshCw } from 'lucide-react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { Button, LiveDot, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { useInvalidateOn } from '@/lib/live'
import { healthKeys } from '../api'
import { BackupPanel, CcActivityPanel, MirrorPanel, SyncRunsPanel } from '../components/ActivityPanels'

const TABS = ['sync', 'cc', 'reconcile', 'backup', 'mirror'] as const
type TabId = (typeof TABS)[number]

export default function ActivityPage() {
  const { t } = useTranslation('health')
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: TabId = (TABS as readonly string[]).includes(raw ?? '') ? (raw as TabId) : 'sync'
  const fetching = useIsFetching({ queryKey: healthKeys.activity }) > 0

  // A job finishing or a staffing change elsewhere refreshes the logs at once; polling is 30 s.
  useInvalidateOn('archive:changed', healthKeys.activity)
  useInvalidateOn('cc:activity', healthKeys.activity)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('activity.title')}
        subtitle={t('activity.subtitle')}
        meta={
          <span className="flex items-center gap-2 text-[13px] text-muted">
            <LiveDot />
            {t('activity.autoRefresh')}
          </span>
        }
        actions={
          <Button icon={RefreshCw} loading={fetching} onClick={() => void qc.invalidateQueries({ queryKey: healthKeys.activity })}>
            {t('activity.refresh')}
          </Button>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(v) =>
          setParams(
            (prev) => {
              const next = new URLSearchParams(prev)
              next.set('tab', v)
              return next
            },
            { replace: true },
          )
        }
      >
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList>
            {TABS.map((id) => (
              <TabsTrigger key={id} value={id}>
                {t(`activity.tab.${id}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="sync" className="mt-4">
          <SyncRunsPanel />
        </TabsContent>
        <TabsContent value="cc" className="mt-4">
          <CcActivityPanel />
        </TabsContent>
        <TabsContent value="reconcile" className="mt-4">
          <SyncRunsPanel reconcile />
        </TabsContent>
        <TabsContent value="backup" className="mt-4">
          <BackupPanel />
        </TabsContent>
        <TabsContent value="mirror" className="mt-4">
          <MirrorPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
