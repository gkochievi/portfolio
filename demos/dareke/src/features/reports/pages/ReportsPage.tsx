/** /reports: agent performance, campaign report and call detail (supervisor, admin, super_admin). */
import { ListOrdered, PieChart, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'

import { useReportsLive } from '../api'
import { AgentPerformanceTab, CallDetailTab, CampaignReportTab } from '../components/ReportTabs'

const ICON = { size: 18, strokeWidth: 1.75 } as const
type TabId = 'agents' | 'campaign' | 'detail'

export default function ReportsPage() {
  const { t } = useTranslation('reports')
  const [tab, setTab] = useState<TabId>('agents')
  useReportsLive()

  return (
    <div className="space-y-5">
      <PageHeader title={t('pages.ReportsPage')} description={t('reportsIntro')} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="agents" icon={<Users {...ICON} />}>
              {t('tabs.agents')}
            </TabsTrigger>
            <TabsTrigger value="campaign" icon={<PieChart {...ICON} />}>
              {t('tabs.campaign')}
            </TabsTrigger>
            <TabsTrigger value="detail" icon={<ListOrdered {...ICON} />}>
              {t('tabs.detail')}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="agents" className="pt-4">
          <AgentPerformanceTab />
        </TabsContent>
        <TabsContent value="campaign" className="pt-4">
          <CampaignReportTab />
        </TabsContent>
        <TabsContent value="detail" className="pt-4">
          <CallDetailTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
