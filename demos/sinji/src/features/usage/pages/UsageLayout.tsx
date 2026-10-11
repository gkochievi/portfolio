import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router-dom'

import { PageHeader, StatusChip, TabNav } from '@/components/ui'
import { formatNumber } from '@/lib/format'
import { useUsageLive } from '../api'
import { UsageFilterBar } from '../components/UsageFilterBar'
import { useUsageParams } from '../params'
import { startAmbientUsage } from '../sim/ambient'

/** AI usage: shared header, tabs and filter bar; every tab reads the filters from the URL. */
export default function UsageLayout() {
  const { t, i18n } = useTranslation('usage')
  const { pathname } = useLocation()
  const { filterSearch } = useUsageParams()
  const arrived = useUsageLive()
  useEffect(() => startAmbientUsage(), [])

  // Detail pages bring their own header and ignore the filters.
  const detail = /^\/usage\/(recordings|conversations)\/[^/]+/.test(pathname)
  if (detail) return <Outlet />

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <StatusChip tone="success" pulse>
            {t('live')}
            {arrived > 0 ? ` +${formatNumber(arrived, i18n.language)}` : ''}
          </StatusChip>
        }
      />
      <TabNav
        aria-label={t('tabs.label')}
        items={[
          { to: `/usage/overview${filterSearch}`, label: t('tabs.overview') },
          { to: `/usage/recordings${filterSearch}`, label: t('tabs.recordings') },
          { to: `/usage/conversations${filterSearch}`, label: t('tabs.conversations') },
          { to: `/usage/calls${filterSearch}`, label: t('tabs.calls') },
        ]}
      />
      <UsageFilterBar />
      <Outlet />
    </div>
  )
}
