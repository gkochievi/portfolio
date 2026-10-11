/**
 * Campaigns (/console/campaigns): campaign cards grouped by tenant, with a
 * tenant filter and a look-back window. Admin only (route guard + handler).
 * Owner: feature group campaigns.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, EmptyState, ErrorState, FilterBar, PageHeader, Select, Skeleton, TenantMark, ToolbarSpacer } from '@/components/ui'
import { useLang } from '@/hooks/useLang'
import { useMeta } from '@/hooks/useMeta'
import { lt } from '@/lib/utils'
import type { Tenant } from '@/types'
import { useCampaigns } from '../api'
import { CampaignCard } from '../components/CampaignCard'
import { readWindow, useParamState, WindowControl } from '../components/shared'
import type { CampaignSummary } from '../types'

export default function CampaignsPage() {
  const { t } = useTranslation('campaigns')
  const lang = useLang()
  const [params, setParams] = useParamState()
  const tenantId = params.get('tenantId') ?? ''
  const days = readWindow(params)
  const meta = useMeta()
  const query = useCampaigns(tenantId, Number(days))

  const tenantOptions = useMemo(
    () => [
      { value: '', label: t('common:filters.allTenants') },
      ...(meta.data?.tenants ?? []).map((tenant) => ({
        value: tenant.id,
        label: lt(tenant.name, lang),
        icon: <TenantMark monogram={tenant.monogram} primary={tenant.primary} onPrimary={tenant.onPrimary} size="xs" />,
      })),
    ],
    [meta.data, lang, t],
  )

  const groups = useMemo(() => {
    const byTenant = new Map<string, { tenant: Tenant; items: CampaignSummary[] }>()
    for (const summary of query.data ?? []) {
      const group = byTenant.get(summary.tenant.id)
      if (group) group.items.push(summary)
      else byTenant.set(summary.tenant.id, { tenant: summary.tenant, items: [summary] })
    }
    return [...byTenant.values()]
  }, [query.data])

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('list.eyebrow')} title={t('list.title')} description={t('list.description')} />

      <FilterBar label={t('common:filters.tenant')}>
        <Select
          variant="pill"
          size="sm"
          aria-label={t('common:filters.tenant')}
          value={tenantId}
          onValueChange={(value) => setParams({ tenantId: value })}
          options={tenantOptions}
        />
        <ToolbarSpacer />
        <WindowControl value={days} onChange={(value) => setParams({ days: value === '30' ? null : value })} />
      </FilterBar>

      {query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[330px] rounded-2xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState description={t('common:errors.loadFailed')} onRetry={() => void query.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState
          framed
          title={t('list.emptyTitle')}
          description={t('list.emptyDescription')}
          action={
            tenantId ? (
              <Button variant="secondary" onClick={() => setParams({ tenantId: null })}>
                {t('common:actions.clearFilters')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={query.isPlaceholderData ? 'space-y-8 opacity-70 transition-opacity' : 'space-y-8 transition-opacity'}>
          {groups.map(({ tenant, items }) => (
            <section key={tenant.id} aria-labelledby={`tenant-${tenant.id}`} className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <TenantMark monogram={tenant.monogram} primary={tenant.primary} onPrimary={tenant.onPrimary} size="sm" />
                <h2 id={`tenant-${tenant.id}`} className="font-display text-xl text-ink">
                  {lt(tenant.name, lang)}
                </h2>
                <span className="text-sm text-muted">{t('list.campaignCount', { count: items.length })}</span>
                <Badge mono tone="neutral" variant="outline" title={t('list.sender')}>
                  {tenant.smsSender}
                </Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((summary) => (
                  <CampaignCard key={summary.campaign.id} summary={summary} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
