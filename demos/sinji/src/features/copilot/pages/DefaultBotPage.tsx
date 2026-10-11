/** /console/default-bot - the global default bot every workspace inherits from. OWNED BY: copilot. */
import { Layers } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage, isApiError } from '@/api/client'
import { Button, Callout, PageHeader, Skeleton, toast } from '@/components/ui'
import { useFormat } from '@/lib/format'
import type { BotConfig } from '@/types'
import { useCopilotSync, useDefaultBot, useSaveDefaultBot } from '../api'
import { BotForm } from '../components/BotForm'

export default function DefaultBotPage() {
  const { t } = useTranslation('copilot')
  const f = useFormat()
  const query = useDefaultBot()
  const save = useSaveDefaultBot()
  const [formKey, setFormKey] = useState(0)
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({})
  useCopilotSync()

  const config = query.data

  const onSave = async (next: BotConfig) => {
    try {
      await save.mutateAsync(next)
      setServerErrors({})
      setFormKey((k) => k + 1)
      toast.success(t('defaultBot.saved'))
    } catch (error) {
      if (isApiError(error)) setServerErrors(error.fieldErrors)
      toast.error(errorMessage(error, t('bot.saveError')))
    }
  }

  return (
    <>
      <PageHeader title={t('defaultBot.title')} description={t('defaultBot.description')} />
      {query.isLoading ? (
        <div className="space-y-5">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : query.isError || !config ? (
        <Callout tone="danger" title={t('loadError')} action={<Button size="sm" onClick={() => void query.refetch()}>{t('retry')}</Button>}>
          {errorMessage(query.error, t('loadError'))}
        </Callout>
      ) : (
        <BotForm
          key={formKey}
          initial={config}
          isDefault
          canEdit
          saving={save.isPending}
          serverErrors={serverErrors}
          onSave={(next) => void onSave(next)}
          top={
            <Callout tone="info" icon={<Layers />} title={t('defaultBot.inheritTitle')}>
              {t('defaultBot.inheritBody')}
              <span className="mt-1 block text-xs text-muted">
                {t('bot.meta', { version: config.version, who: config.updated_by ?? '-', when: f.relative(config.updated_at) })}
              </span>
            </Callout>
          }
        />
      )}
    </>
  )
}
