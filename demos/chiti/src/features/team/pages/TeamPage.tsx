import { useTranslation } from 'react-i18next'

import { SystemMessage } from '@/app/pages/NotFoundPage'
import { PageHeader } from '@/components/ui'
import { useAccount } from '@/lib/account'

import { TeamChatPanel } from '../TeamChatPanel'

/** /admin/team: the staff chat as a full page (admins only). */
export default function TeamPage() {
  const { t } = useTranslation('team')
  const account = useAccount()
  if (account && account.role !== 'admin') return <SystemMessage code={403} />
  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[460px] flex-col gap-4">
      <PageHeader title={t('title')} description={t('page.description')} />
      <div className="min-h-0 flex-1">
        <TeamChatPanel variant="page" />
      </div>
    </div>
  )
}
