/** Console > Integrations: analysis instructions, self-test, transcription defaults and chat credentials. */
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/ui'
import { ChatCredentials } from '../components/ChatCredentials'
import { InstructionsCard } from '../components/InstructionsCard'
import { SelfTestPanel } from '../components/SelfTestPanel'
import { TranscriptionCard } from '../components/TranscriptionCard'

export default function IntegrationsPage() {
  const { t } = useTranslation('consoleAi')
  return (
    <div className="space-y-5">
      <PageHeader title={t('integrations.title')} description={t('integrations.description')} />
      <InstructionsCard />
      <SelfTestPanel />
      <TranscriptionCard />
      <ChatCredentials />
    </div>
  )
}
