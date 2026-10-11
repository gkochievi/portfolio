import { Settings, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Card, CardBody, CardHeader, ConfirmDialog, PageHeader, Section, toast } from '@/components/ui'

import { errorMessage, usePurgeStorage } from '../api'
import { BackfillCard } from '../components/BackfillCard'
import { BillingDetailsForm } from '../components/BillingDetailsForm'
import { MailSettingsForm } from '../components/MailSettingsForm'
import { SchedulerPanel } from '../components/SchedulerPanel'

export default function SettingsPage() {
  const { t } = useTranslation('ops')
  const purge = usePurgeStorage()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const onPurge = async () => {
    try {
      const result = await purge.mutateAsync()
      setConfirmOpen(false)
      toast.success(t('purge.done'), { description: t('purge.doneDetail', { mails: result.purgedMails, files: result.purgedAttachments }) })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      <PageHeader eyebrow={t('settings.eyebrow')} title={t('settings.title')} description={t('settings.description')} icon={<Settings />} />

      <Section title={t('settings.sections.mail')} description={t('settings.sections.mailHint')}>
        <MailSettingsForm />
      </Section>

      <Section title={t('settings.sections.billing')} description={t('settings.sections.billingHint')}>
        <BillingDetailsForm embedded />
      </Section>

      <Section title={t('settings.sections.maintenance')}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <BackfillCard />
          <Card className="self-start">
            <CardHeader title={t('purge.title')} description={t('purge.description')} />
            <CardBody>
              <Button variant="destructive" size="sm" icon={<Trash2 />} onClick={() => setConfirmOpen(true)}>
                {t('purge.button')}
              </Button>
            </CardBody>
          </Card>
        </div>
      </Section>

      <Section title={t('settings.sections.scheduler')}>
        <SchedulerPanel />
      </Section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('purge.confirmTitle')}
        description={t('purge.confirmBody')}
        confirmLabel={t('purge.confirm')}
        tone="danger"
        pending={purge.isPending}
        onConfirm={onPurge}
      />
    </>
  )
}
