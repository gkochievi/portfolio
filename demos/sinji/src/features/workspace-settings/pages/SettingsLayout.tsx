import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'

import { PageHeader, TabNav } from '@/components/ui'

/** Workspace settings: page header + sub-tabs. OWNED BY: workspace-settings. */
export default function SettingsLayout() {
  const { t } = useTranslation('settings')
  return (
    <section>
      <PageHeader title={t('layout.title')} description={t('layout.subtitle')} />
      <TabNav
        aria-label={t('layout.title')}
        items={[
          { to: '/workspace/settings/sentiment', label: t('layout.tabs.sentiment') },
          { to: '/workspace/settings/transcription', label: t('layout.tabs.transcription') },
          { to: '/workspace/settings/ai', label: t('layout.tabs.ai') },
        ]}
      />
      <div className="max-w-5xl">
        <Outlet />
      </div>
    </section>
  )
}
