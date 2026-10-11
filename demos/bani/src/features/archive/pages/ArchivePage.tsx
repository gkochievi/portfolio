import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'

import { BassDivider } from '@/components/brand'
import { Button, PageHeader } from '@/components/ui'
import { useArchiveBus, archiveKeys } from '../api'
import { BackupSection } from '../components/BackupSection'
import { CoreImportSection } from '../components/CoreImportSection'
import { HangupSection } from '../components/HangupSection'
import { LiveEventsSection } from '../components/LiveEventsSection'
import { MirrorSection } from '../components/MirrorSection'
import { VerifySection } from '../components/VerifySection'

export default function ArchivePage() {
  const { t } = useTranslation('archive')
  const qc = useQueryClient()
  useArchiveBus()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button size="sm" icon={RefreshCw} onClick={() => void qc.invalidateQueries({ queryKey: archiveKeys.all })}>
            {t('refreshAll')}
          </Button>
        }
      />
      <CoreImportSection />
      <BassDivider />
      <MirrorSection />
      <BassDivider />
      <HangupSection />
      <BassDivider />
      <BackupSection />
      <BassDivider />
      <LiveEventsSection />
      <BassDivider />
      <VerifySection />
      <p className="text-center text-[12.5px] text-faint">{t('demoNote')}</p>
    </div>
  )
}
