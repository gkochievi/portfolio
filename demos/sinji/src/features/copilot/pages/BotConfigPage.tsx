/** /workspace/bot - the workspace's bot configuration. OWNED BY: copilot. */
import { Bot, Power } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { errorMessage, isApiError } from '@/api/client'
import { Badge, Button, Callout, EmptyState, PageHeader, Panel, Skeleton, Switch, toast } from '@/components/ui'
import { useFormat } from '@/lib/format'
import type { BotConfig } from '@/types'
import { useBotConfig, useCopilotSync, useSaveBotConfig } from '../api'
import { BotForm } from '../components/BotForm'

export default function BotConfigPage() {
  const { t } = useTranslation('copilot')
  const f = useFormat()
  const query = useBotConfig()
  const save = useSaveBotConfig()
  const [formKey, setFormKey] = useState(0)
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({})
  useCopilotSync()

  const view = query.data

  const header = <PageHeader title={t('bot.title')} description={t('bot.description')} />
  if (query.isLoading) {
    return (
      <>
        {header}
        <div className="space-y-5">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    )
  }
  if (query.isError || !view) {
    return (
      <>
        {header}
        <Callout tone="danger" title={t('loadError')} action={<Button size="sm" onClick={() => void query.refetch()}>{t('retry')}</Button>}>
          {errorMessage(query.error, t('loadError'))}
        </Callout>
      </>
    )
  }

  const { config } = view
  const killed = view.kill.global_disabled || view.kill.tenant_disabled
  const noDocs = view.public_docs === 0
  const toggleBlocked = !view.can_edit || (!config.autopilot_enabled && noDocs)

  const toggleAutopilot = async (on: boolean) => {
    try {
      await save.mutateAsync({ autopilot_enabled: on })
      toast.success(on ? t('bot.autopilot.enabledToast') : t('bot.autopilot.disabledToast'))
    } catch (error) {
      toast.error(errorMessage(error, t('bot.saveError')))
    }
  }

  const onSave = async (next: BotConfig) => {
    try {
      // The autopilot switch saves on its own; keep whatever is live now.
      await save.mutateAsync({ ...next, autopilot_enabled: config.autopilot_enabled })
      setServerErrors({})
      setFormKey((k) => k + 1)
      toast.success(t('bot.saved'))
    } catch (error) {
      if (isApiError(error)) setServerErrors(error.fieldErrors)
      toast.error(errorMessage(error, t('bot.saveError')))
    }
  }

  const top = (
    <div className="space-y-4">
      {view.kill.global_disabled ? (
        <Callout tone="danger" icon={<Power />} title={t('bot.kill.globalTitle')}>
          {t('bot.kill.globalBody')}
        </Callout>
      ) : view.kill.tenant_disabled ? (
        <Callout tone="danger" icon={<Power />} title={t('bot.kill.tenantTitle')}>
          {t('bot.kill.tenantBody')}
        </Callout>
      ) : null}

      <Panel
        title={t('bot.autopilot.title')}
        icon={<Bot />}
        description={t('bot.autopilot.description')}
        actions={
          <Badge tone={killed ? 'danger' : view.blocked ? 'warning' : 'success'} size="md">
            {killed ? t('bot.autopilot.stateKilled') : view.blocked ? t('bot.autopilot.stateBlocked') : t('bot.autopilot.stateLive')}
          </Badge>
        }
      >
        <div className="space-y-3">
          <Switch
            checked={config.autopilot_enabled}
            onCheckedChange={(on) => void toggleAutopilot(on)}
            disabled={toggleBlocked || save.isPending}
            label={t('bot.autopilot.switch')}
            description={t('bot.autopilot.switchHint', { count: view.public_docs })}
          />
          {!config.autopilot_enabled && noDocs ? (
            <Callout tone="warning" title={t('bot.autopilot.noDocsTitle')} action={<Button asChild size="sm" variant="secondary"><Link to="/workspace/kb/documents">{t('bot.autopilot.noDocsAction')}</Link></Button>}>
              {t('bot.autopilot.noDocsBody')}
            </Callout>
          ) : null}
          {config.autopilot_enabled && view.blocked && view.blocked !== 'killed' ? (
            <Callout tone="warning" title={t('blocked.title')}>{t(`blocked.${view.blocked}`)}</Callout>
          ) : null}
          <p className="text-xs text-subtle">
            {t('bot.meta', { version: config.version, who: config.updated_by ?? '-', when: f.relative(config.updated_at) })}
          </p>
        </div>
      </Panel>
    </div>
  )

  return (
    <>
      <PageHeader
        title={t('bot.title')}
        description={t('bot.description')}
        actions={
          <Button asChild variant="secondary">
            <Link to="/copilot">{t('bot.tryInCopilot')}</Link>
          </Button>
        }
      />
      {config ? (
        <BotForm
          key={formKey}
          initial={config}
          defaults={view.defaults}
          inherited={view.inherited}
          isDefault={false}
          canEdit={view.can_edit}
          saving={save.isPending}
          serverErrors={serverErrors}
          onSave={(next) => void onSave(next)}
          top={top}
        />
      ) : (
        <EmptyState title={t('loadError')} />
      )}
    </>
  )
}
