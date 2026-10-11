import { MessageSquareText, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, Chip, FilterBar, SearchInput, SegmentedControl, Select, ToolbarSpacer } from '@/components/ui'
import { useLang } from '@/hooks/useLang'
import { useMeta } from '@/hooks/useMeta'
import { lt } from '@/lib/utils'
import { WINDOWS, useInsightsFilters } from '../api'

interface Props {
  /** Show rating, "has comment" and search (responses page). */
  extended?: boolean
}

/** Cascading business → branch → staff, campaign and window; all in the URL. */
export function InsightsFilterBar({ extended }: Props) {
  const { t } = useTranslation('insights')
  const lang = useLang()
  const meta = useMeta()
  const { filters, update, clear, active } = useInsightsFilters()

  const tenants = meta.data?.tenants ?? []
  const branches = (meta.data?.branches ?? []).filter((b) => !filters.tenantId || b.tenantId === filters.tenantId)
  const staff = (meta.data?.staff ?? []).filter(
    (s) => (!filters.tenantId || s.tenantId === filters.tenantId) && (!filters.branchId || s.branchId === filters.branchId),
  )
  const campaigns = (meta.data?.campaigns ?? []).filter((c) => !filters.tenantId || c.tenantId === filters.tenantId)

  return (
    <div className="flex flex-col gap-3">
      <FilterBar label={t('filters.label')}>
        <Select
          variant="pill"
          size="sm"
          aria-label={t('common:filters.tenant')}
          value={filters.tenantId}
          onValueChange={(v) => update({ tenantId: v })}
          disabled={meta.isLoading}
          options={[
            { value: '', label: t('common:filters.allTenants') },
            ...tenants.map((x) => ({ value: x.id, label: lt(x.name, lang) })),
          ]}
        />
        <Select
          variant="pill"
          size="sm"
          aria-label={t('common:filters.branch')}
          value={filters.branchId}
          onValueChange={(v) => {
            // Picking a branch first also pins its business.
            const branch = meta.data?.branches.find((b) => b.id === v)
            update(branch ? { branchId: v, tenantId: branch.tenantId } : { branchId: v })
          }}
          disabled={meta.isLoading}
          options={[
            { value: '', label: t('common:filters.allBranches') },
            ...branches.map((x) => ({ value: x.id, label: lt(x.name, lang) })),
          ]}
        />
        <Select
          variant="pill"
          size="sm"
          aria-label={t('common:filters.staff')}
          value={filters.staffId}
          onValueChange={(v) => {
            // Picking a person pins their branch and business.
            const person = meta.data?.staff.find((s) => s.id === v)
            update(person ? { staffId: v, branchId: person.branchId, tenantId: person.tenantId } : { staffId: v })
          }}
          disabled={meta.isLoading}
          options={[
            { value: '', label: t('common:filters.allStaff') },
            ...staff.map((x) => ({ value: x.id, label: lt(x.name, lang) })),
          ]}
        />
        <Select
          variant="pill"
          size="sm"
          aria-label={t('common:filters.campaign')}
          value={filters.campaignId}
          onValueChange={(v) => {
            const campaign = meta.data?.campaigns.find((c) => c.id === v)
            update(campaign ? { campaignId: v, tenantId: campaign.tenantId } : { campaignId: v })
          }}
          disabled={meta.isLoading}
          options={[
            { value: '', label: t('common:filters.allCampaigns') },
            ...campaigns.map((x) => ({ value: x.id, label: lt(x.title, lang) })),
          ]}
        />
        <ToolbarSpacer />
        <SegmentedControl
          size="sm"
          label={t('common:window.label')}
          value={String(filters.days)}
          onChange={(v) => update({ days: Number(v) })}
          options={WINDOWS.map((d) => ({ value: String(d), label: t('common:window.short', { count: d }) }))}
        />
      </FilterBar>

      {extended && (
        <FilterBar label={t('filters.refine')}>
          <div className="w-full sm:w-72">
            <SearchInput
              size="sm"
              value={filters.q}
              onChange={(v) => update({ q: v })}
              placeholder={t('filters.searchPlaceholder')}
              debounce={250}
            />
          </div>
          <Select
            variant="pill"
            size="sm"
            aria-label={t('common:filters.rating')}
            value={filters.rating}
            onValueChange={(v) => update({ rating: v })}
            options={[
              { value: '', label: t('common:filters.anyRating') },
              ...[5, 4, 3, 2, 1].map((n) => ({
                value: String(n),
                label: t('filters.ratingOption', { value: n, label: t(`common:rating.${n}`) }),
              })),
            ]}
          />
          <Chip
            size="sm"
            selected={filters.hasComment}
            icon={<MessageSquareText size={16} strokeWidth={1.75} />}
            onClick={() => update({ hasComment: !filters.hasComment })}
          >
            {t('common:filters.hasComment')}
          </Chip>
          {active && (
            <Button size="sm" variant="ghost" leftIcon={<X size={16} strokeWidth={1.75} />} onClick={clear}>
              {t('common:actions.clearFilters')}
            </Button>
          )}
        </FilterBar>
      )}
      {!extended && active && (
        <div>
          <Button size="sm" variant="ghost" leftIcon={<X size={16} strokeWidth={1.75} />} onClick={clear}>
            {t('common:actions.clearFilters')}
          </Button>
        </div>
      )}
    </div>
  )
}
