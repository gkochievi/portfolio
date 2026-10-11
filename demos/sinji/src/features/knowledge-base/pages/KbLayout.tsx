import { HeartPulse } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'

import { Badge, Button, PageHeader, TabNav } from '@/components/ui'
import { useCurationSummary, useKbLive } from '../api'

/** Knowledge base shell: page header, sub-tabs and the link to KB health. OWNED BY: knowledge-base. */
export default function KbLayout() {
  const { t } = useTranslation('kb')
  const summary = useCurationSummary()
  useKbLive()
  const pending = summary.data?.pending ?? 0

  return (
    <section>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Button asChild variant="secondary" icon={<HeartPulse />}>
            <Link to="/workspace/curation">
              {t('health.link')}
              {pending > 0 ? (
                <Badge tone="accent" size="sm" aria-label={t('health.pending', { count: pending })}>
                  {pending}
                </Badge>
              ) : null}
            </Link>
          </Button>
        }
      />
      <TabNav
        aria-label={t('title')}
        items={[
          { to: '/workspace/kb/overview', label: t('tabs.overview') },
          { to: '/workspace/kb/documents', label: t('tabs.documents') },
          { to: '/workspace/kb/import', label: t('tabs.import') },
          { to: '/workspace/kb/chunks', label: t('tabs.chunks') },
          { to: '/workspace/kb/retrieval', label: t('tabs.retrieval') },
          { to: '/workspace/kb/duplicates', label: t('tabs.duplicates') },
          { to: '/workspace/kb/activity', label: t('tabs.activity') },
          { to: '/workspace/kb/maintenance', label: t('tabs.maintenance') },
        ]}
      />
      <Outlet />
    </section>
  )
}
