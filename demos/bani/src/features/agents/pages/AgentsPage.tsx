import { Lock } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { EmptyState, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { useInvalidateOn } from '@/lib/live'
import { useMe } from '@/shell/useMe'
import { agentKeys } from '../api'
import { ByAgentTab } from '../components/ByAgentTab'
import { SkillRosterTab } from '../components/SkillRosterTab'
import { useRosterDraft } from '../useRosterDraft'

type TabId = 'agent' | 'skill'

export default function AgentsPage() {
  const { t } = useTranslation('agents')
  const { me, can } = useMe()
  const [params, setParams] = useSearchParams()
  const draft = useRosterDraft()
  useInvalidateOn('demo:reset', agentKeys.all)

  const tab: TabId = params.get('tab') === 'skill' ? 'skill' : 'agent'
  const skillId = params.get('skill') ?? ''

  const update = (mutate: (next: URLSearchParams) => void) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        mutate(next)
        return next
      },
      { replace: true },
    )

  const setTab = (value: string) =>
    update((next) => {
      if (value === 'skill') next.set('tab', 'skill')
      else next.delete('tab')
    })

  const setSkill = (id: string) =>
    update((next) => {
      next.set('tab', 'skill')
      if (id) next.set('skill', id)
      else next.delete('skill')
    })

  if (me && !can('cc_agents')) {
    return (
      <>
        <PageHeader title={t('title')} />
        <EmptyState icon={Lock} title={t('forbiddenTitle')} body={t('forbiddenBody')} />
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="agent">{t('tabs.agent')}</TabsTrigger>
          <TabsTrigger value="skill">{t('tabs.skill')}</TabsTrigger>
        </TabsList>
        <TabsContent value="agent" className="pt-4">
          <ByAgentTab />
        </TabsContent>
        <TabsContent value="skill" className="pt-4">
          <SkillRosterTab skillId={skillId} onSkillChange={setSkill} draft={draft} />
        </TabsContent>
      </Tabs>
    </>
  )
}
