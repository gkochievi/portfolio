/** /admin/campaigns/:id: header with lifecycle controls, progress and counters, then Numbers / Agents / Settings tabs. */
import { ArrowLeft, Cog, Pencil, PhoneForwarded, PhoneIncoming, Phone, Users, ListChecks } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { Alert, Button, EmptyState, ProgressBar, Skeleton, Stat, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { ApiError } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { useLocalized } from '@/lib/localized'

import { useCampaign } from '../api'
import { AgentsTab } from '../components/AgentsTab'
import { CampaignFormDrawer } from '../components/CampaignFormDrawer'
import { NumbersTab } from '../components/NumbersTab'
import { SettingsTab } from '../components/SettingsTab'
import { CampaignStatusPill, LifecycleButtons, useApiErrorText } from '../components/shared'

const TABS = ['numbers', 'agents', 'settings'] as const
type TabId = (typeof TABS)[number]
const i18 = { size: 16, strokeWidth: 1.75 } as const

function BackLink() {
  const { t } = useTranslation('campaigns')
  return (
    <Link to="/admin/campaigns" className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
      <ArrowLeft {...i18} />
      {t('detail.back')}
    </Link>
  )
}

export default function CampaignDetailPage() {
  const { t } = useTranslation('campaigns')
  const l = useLocalized()
  const errText = useApiErrorText()
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const query = useCampaign(id)
  const campaign = query.data

  const requested = params.get('tab')
  const tab: TabId = TABS.includes(requested as TabId) ? (requested as TabId) : 'numbers'
  const setTab = (next: string) => {
    const p = new URLSearchParams(params)
    if (next === 'numbers') p.delete('tab')
    else p.set('tab', next)
    setParams(p, { replace: true })
  }

  if (query.isLoading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (query.isError || !campaign) {
    const missing = query.error instanceof ApiError && query.error.status === 404
    return (
      <div className="space-y-5">
        <BackLink />
        {missing ? (
          <EmptyState
            title={t('detail.notFound')}
            description={t('detail.notFoundHint')}
            action={
              <Button asChild variant="dial">
                <Link to="/admin/campaigns">{t('detail.backToList')}</Link>
              </Button>
            }
          />
        ) : (
          <Alert
            tone="danger"
            title={t('detail.loadFailed')}
            action={
              <Button size="sm" onClick={() => void query.refetch()}>
                {t('detail.retry')}
              </Button>
            }
          >
            {errText(query.error)}
          </Alert>
        )}
      </div>
    )
  }

  const { stats } = campaign
  const description = l(campaign.description)
  const closed = campaign.status === 'completed' || campaign.status === 'archived'

  return (
    <div className="space-y-5">
      <BackLink />

      <header className="space-y-4 rounded-card border border-hairline bg-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{l(campaign.name)}</h1>
              <CampaignStatusPill status={campaign.status} />
            </div>
            <p className="text-sm text-muted">{t('detail.client', { client: l(campaign.clientName) })}</p>
            {description && <p className="max-w-3xl text-sm text-ink/80">{description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LifecycleButtons campaign={campaign} size="md" />
            {!closed && (
              <Button variant="outline" icon={<Pencil {...i18} />} onClick={() => setEditing(true)}>
                {t('detail.edit')}
              </Button>
            )}
          </div>
        </div>

        <ProgressBar
          value={stats.progress}
          size="md"
          tone={campaign.status === 'active' ? 'success' : 'ink'}
          label={t('detail.progress')}
          valueLabel={`${Math.round(stats.progress)}%`}
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat size="sm" icon={<Phone {...i18} />} label={t('detail.total')} value={formatNumber(stats.totalNumbers)} />
          <Stat size="sm" icon={<PhoneForwarded {...i18} />} label={t('detail.dialed')} value={formatNumber(stats.dialed)} />
          <Stat size="sm" icon={<PhoneIncoming {...i18} />} tone="success" label={t('detail.connected')} value={formatNumber(stats.connected)} />
          <Stat size="sm" icon={<ListChecks {...i18} />} tone={stats.pending === 0 && !closed ? 'warning' : undefined} label={t('detail.pending')} value={formatNumber(stats.pending)} />
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="numbers" icon={<Phone {...i18} />} count={stats.totalNumbers}>
            {t('detail.tabs.numbers')}
          </TabsTrigger>
          <TabsTrigger value="agents" icon={<Users {...i18} />} count={campaign.agentCount}>
            {t('detail.tabs.agents')}
          </TabsTrigger>
          <TabsTrigger value="settings" icon={<Cog {...i18} />}>
            {t('detail.tabs.settings')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="numbers" className="mt-4">
          <NumbersTab campaign={campaign} />
        </TabsContent>
        <TabsContent value="agents" className="mt-4">
          <AgentsTab campaign={campaign} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab campaign={campaign} />
        </TabsContent>
      </Tabs>

      <CampaignFormDrawer open={editing} campaign={campaign} onOpenChange={setEditing} />
    </div>
  )
}
