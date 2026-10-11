/**
 * SMS log (/console/links): every survey link the CRM texted, with live status,
 * status tabs, tenant / campaign / branch filters, token-or-phone search and
 * pagination. Admin only (route guard + handler). Owner: feature group campaigns.
 */
import { ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import {
  Avatar,
  Badge,
  Button,
  CopyButton,
  DataTable,
  ErrorState,
  FilterBar,
  LiveDot,
  PageHeader,
  SearchInput,
  Select,
  StatusBadge,
  Tabs,
  TabsList,
  TabsTrigger,
  TenantMark,
  Tooltip,
  type Column,
} from '@/components/ui'
import { clock } from '@/demo/core'
import { useLang } from '@/hooks/useLang'
import { useMeta } from '@/hooks/useMeta'
import { formatDateTime, formatRelative } from '@/lib/format'
import { lt } from '@/lib/utils'
import type { LinkRow, LinkStatus } from '@/types'
import { useLinks } from '../api'
import { TenantLabel, useParamState } from '../components/shared'
import type { LinkStatusFilter } from '../types'

const PAGE_SIZE = 20
const TABS: LinkStatusFilter[] = ['all', 'pending', 'completed', 'expired']
const FLASH_MS = 2600

export default function LinksPage() {
  const { t } = useTranslation('campaigns')
  const lang = useLang()
  const navigate = useNavigate()
  const meta = useMeta()
  const [params, setParams] = useParamState()

  const rawStatus = params.get('status') ?? 'all'
  const status: LinkStatusFilter = (TABS as string[]).includes(rawStatus) ? (rawStatus as LinkStatusFilter) : 'all'
  const tenantId = params.get('tenantId') ?? ''
  const campaignId = params.get('campaignId') ?? ''
  const branchId = params.get('branchId') ?? ''
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  const query = useLinks({ status, tenantId, campaignId, branchId, q, page, pageSize: PAGE_SIZE })
  const data = query.data

  /* Flash rows whose status changed since the previous fetch (tokens spent or expired). */
  const seen = useRef(new Map<string, LinkStatus>())
  const [flash, setFlash] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    if (!data) return
    const changed = new Set<string>()
    for (const row of data.items) {
      const before = seen.current.get(row.id)
      if (before && before !== row.status) changed.add(row.id)
      seen.current.set(row.id, row.status)
    }
    if (!changed.size) return
    setFlash(changed)
    const timer = window.setTimeout(() => setFlash(new Set()), FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [data])

  /* Filter options (campaign and branch follow the chosen tenant). */
  const tenants = meta.data?.tenants ?? []
  const tenantOptions = useMemo(
    () => [
      { value: '', label: t('common:filters.allTenants') },
      ...tenants.map((tenant) => ({
        value: tenant.id,
        label: lt(tenant.name, lang),
        icon: <TenantMark monogram={tenant.monogram} primary={tenant.primary} onPrimary={tenant.onPrimary} size="xs" />,
      })),
    ],
    [tenants, lang, t],
  )
  const campaignOptions = useMemo(
    () => [
      { value: '', label: t('common:filters.allCampaigns') },
      ...(meta.data?.campaigns ?? [])
        .filter((c) => !tenantId || c.tenantId === tenantId)
        .map((c) => ({ value: c.id, label: lt(c.title, lang) })),
    ],
    [meta.data, tenantId, lang, t],
  )
  const branchOptions = useMemo(
    () => [
      { value: '', label: t('common:filters.allBranches') },
      ...(meta.data?.branches ?? [])
        .filter((b) => !tenantId || b.tenantId === tenantId)
        .map((b) => ({ value: b.id, label: lt(b.name, lang) })),
    ],
    [meta.data, tenantId, lang, t],
  )
  const tenantById = useMemo(() => new Map(tenants.map((tenant) => [tenant.id, tenant])), [tenants])

  const onTenant = (value: string) => {
    const campaign = meta.data?.campaigns.find((c) => c.id === campaignId)
    const branch = meta.data?.branches.find((b) => b.id === branchId)
    setParams({
      tenantId: value,
      campaignId: value && campaign && campaign.tenantId !== value ? null : campaignId,
      branchId: value && branch && branch.tenantId !== value ? null : branchId,
    })
  }

  const now = clock.now()
  const columns: Column<LinkRow>[] = [
    {
      id: 'token',
      header: t('links.colToken'),
      cell: (row) => (
        <span className="inline-flex items-center gap-1">
          <span className="font-mono text-[13px] font-semibold tracking-wide text-ink">{row.id}</span>
          <CopyButton value={row.id} size="sm" variant="ghost" />
        </span>
      ),
    },
    {
      id: 'recipient',
      header: t('links.colRecipient'),
      cell: (row) =>
        row.recipientName ? (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={lt(row.recipientName, lang)} size="xs" />
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{lt(row.recipientName, lang)}</span>
              <span className="block font-mono text-xs text-muted">{row.phoneMasked}</span>
            </span>
          </span>
        ) : (
          <span className="min-w-0">
            <span className="block font-mono text-[13px] text-ink">{row.phoneMasked}</span>
            <span className="block text-xs text-muted">{t('links.customer')}</span>
          </span>
        ),
    },
    {
      id: 'tenant',
      header: t('links.colTenant'),
      hideBelow: 'md',
      cell: (row) => {
        const tenant = tenantById.get(row.tenantId)
        return tenant ? <TenantLabel tenant={tenant} /> : lt(row.tenantName, lang)
      },
    },
    {
      id: 'campaign',
      header: t('links.colCampaign'),
      hideBelow: 'lg',
      cell: (row) => <span className="line-clamp-2 max-w-[220px]">{lt(row.campaignTitle, lang)}</span>,
    },
    {
      id: 'where',
      header: t('links.colWhere'),
      hideBelow: 'lg',
      cell: (row) => (
        <span className="block max-w-[200px]">
          <span className="block truncate text-ink">{lt(row.branchName, lang)}</span>
          <span className="block truncate text-xs text-muted">{lt(row.staffName, lang)}</span>
        </span>
      ),
    },
    {
      id: 'sent',
      header: t('links.colSent'),
      hideBelow: 'sm',
      cell: (row) => (
        <span className="block whitespace-nowrap">
          <span className="block text-ink">{formatDateTime(row.sentAt, lang)}</span>
          <span className="block text-xs text-muted">
            {row.sentBy === 'system'
              ? t('links.sentByCrm')
              : t('links.sentByStaff', { name: lt(row.staffName, lang) })}
          </span>
        </span>
      ),
    },
    {
      id: 'expires',
      header: t('links.colExpires'),
      hideBelow: 'md',
      cell: (row) => <span className="whitespace-nowrap text-muted">{formatDateTime(row.expiresAt, lang)}</span>,
    },
    {
      id: 'status',
      header: t('links.colStatus'),
      cell: (row) => (
        <StatusBadge
          status={row.status}
          detail={
            row.status === 'pending'
              ? t('common:time.expiresIn', { relative: formatRelative(row.expiresAt, lang, now) })
              : undefined
          }
        />
      ),
    },
    {
      id: 'completed',
      header: t('links.colCompleted'),
      hideBelow: 'md',
      cell: (row) =>
        row.completedAt ? (
          <span className="whitespace-nowrap text-ink">{formatDateTime(row.completedAt, lang)}</span>
        ) : (
          <span className="text-subtle">{t('links.notAnswered')}</span>
        ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('links.colActions')}</span>,
      align: 'right',
      cell: (row) =>
        row.status === 'pending' ? (
          <Tooltip content={t('links.openLinkHint')}>
            <Button
              variant="soft"
              size="sm"
              leftIcon={<ExternalLink size={16} strokeWidth={1.75} />}
              onClick={() => navigate(`/?id=${encodeURIComponent(row.id)}`)}
            >
              <span className="hidden sm:inline">{t('links.openLink')}</span>
              <span className="sr-only sm:hidden">{t('links.openLink')}</span>
            </Button>
          </Tooltip>
        ) : null,
    },
  ]

  const counts = data?.counts
  const filtersActive = Boolean(tenantId || campaignId || branchId || q)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('links.eyebrow')}
        title={t('links.title')}
        description={t('links.description')}
        actions={
          <Badge tone="accent" icon={<LiveDot />}>
            {t('links.live')}
          </Badge>
        }
      />

      <Tabs value={status} onValueChange={(value) => setParams({ status: value === 'all' ? null : value })}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList aria-label={t('links.tabsLabel')}>
            {TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} count={counts ? counts[tab] : undefined}>
                {tab === 'all' ? t('links.all') : t(`common:status.${tab}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <FilterBar label={t('common:filters.search')}>
        <SearchInput
          value={q}
          onChange={(value) => setParams({ q: value.trim() })}
          placeholder={t('links.searchPlaceholder')}
          aria-label={t('links.searchLabel')}
          size="sm"
          className="w-full sm:w-64"
        />
        <Select variant="pill" size="sm" aria-label={t('common:filters.tenant')} value={tenantId} onValueChange={onTenant} options={tenantOptions} />
        <Select
          variant="pill"
          size="sm"
          aria-label={t('common:filters.campaign')}
          value={campaignId}
          onValueChange={(value) => setParams({ campaignId: value })}
          options={campaignOptions}
        />
        <Select
          variant="pill"
          size="sm"
          aria-label={t('common:filters.branch')}
          value={branchId}
          onValueChange={(value) => setParams({ branchId: value })}
          options={branchOptions}
        />
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={() => setParams({ tenantId: null, campaignId: null, branchId: null, q: null })}>
            {t('common:actions.clearFilters')}
          </Button>
        )}
      </FilterBar>

      {query.isError && !data ? (
        <ErrorState description={t('common:errors.loadFailed')} onRetry={() => void query.refetch()} />
      ) : (
        <div className={query.isPlaceholderData ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
          <DataTable
            columns={columns}
            rows={data?.items ?? []}
            getRowId={(row) => row.id}
            loading={query.isPending}
            skeletonRows={8}
            highlightIds={flash}
            caption={t('links.title')}
            empty={{
              title: t('links.emptyTitle'),
              description: t('links.emptyDescription'),
              action: filtersActive ? (
                <Button variant="secondary" size="sm" onClick={() => setParams({ tenantId: null, campaignId: null, branchId: null, q: null, status: null })}>
                  {t('common:actions.clearFilters')}
                </Button>
              ) : undefined,
            }}
            pagination={
              data
                ? {
                    page: data.page,
                    pageSize: data.pageSize,
                    total: data.total,
                    onPageChange: (next) => setParams({ page: next > 1 ? String(next) : null }),
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  )
}
