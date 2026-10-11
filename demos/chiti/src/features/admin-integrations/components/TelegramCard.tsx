/**
 * Telegram Business card: BotFather steps, token + eviction acknowledgement,
 * the awaiting-business-connection attach guide (polled every 5 s), test and
 * disconnect. The AI assistant is not allowed on Telegram.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, Trash2, Zap } from 'lucide-react'

import { errorMessage } from '@/api/client'
import { Badge, Button, Card, Checkbox, ConfirmDialog, Field, Input, Spinner, toast, type BadgeTone } from '@/components/ui'
import { formatDateTime } from '@/lib/format'
import type { TelegramIntegration } from '@/types'

import { useConnectTelegram, useDisconnectTelegram, useTelegramPoll, useTestTelegram } from '../api'
import { CardTitle } from './MetaCard'
import { Notice, SummaryRow, useFieldMessage, useLang } from './shared'

const TONE: Record<TelegramIntegration['state'], BadgeTone> = { not_configured: 'muted', awaiting_business_connection: 'warning', connected: 'success' }

function Steps({ keys, prefix }: { keys: readonly number[]; prefix: string }) {
  const { t } = useTranslation('adminIntegrations')
  return (
    <ol className="flex flex-col gap-2.5">
      {keys.map((n) => (
        <li key={n} className="flex items-start gap-3 text-sm">
          <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-sunken text-xs font-semibold text-ink">{n}</span>
          <span className="pt-0.5">{t(`${prefix}.${n}`)}</span>
        </li>
      ))}
    </ol>
  )
}

export function TelegramCard({ integration, allowed }: { integration: TelegramIntegration; allowed: boolean }) {
  const { t } = useTranslation(['adminIntegrations', 'common'])
  const lang = useLang()
  const awaiting = integration.state === 'awaiting_business_connection'
  const connect = useConnectTelegram()
  const disconnect = useDisconnectTelegram()
  const test = useTestTelegram()
  const message = useFieldMessage()
  const poll = useTelegramPoll(allowed && awaiting)
  const [token, setToken] = useState('')
  const [ack, setAck] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [banner, setBanner] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  if (!allowed) {
    return (
      <Card muted className="flex flex-col gap-3">
        <CardTitle channel="telegram" name={t('channels.telegram.title')} badge={<Badge tone="muted">{t('channels.disabledByPlatform')}</Badge>} />
        <Notice tone="info">{t('channels.disabledByPlatformHint')}</Notice>
      </Card>
    )
  }

  const submit = async () => {
    setBanner(null)
    try {
      await connect.mutateAsync({ token: token.trim(), acknowledgeEviction: ack })
      setToken('')
      setAck(false)
    } catch (error) {
      if (!message(error, 'token') && !message(error, 'acknowledgeEviction')) toast.error(errorMessage(error))
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle channel="telegram" name={t('channels.telegram.title')} badge={<Badge tone={TONE[integration.state]} dot>{t(`channels.telegram.state.${integration.state}`)}</Badge>} />
      <Notice tone="info">{t('channels.aiNotAllowed', { channel: t('channels.telegram.short') })}</Notice>

      {integration.state === 'not_configured' ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div>
            <h3 className="mb-2 text-sm font-semibold">{t('channels.telegram.botfatherTitle')}</h3>
            <Steps keys={[1, 2, 3]} prefix="channels.telegram.botfather" />
          </div>
          <Field label={t('channels.telegram.token')} required hint={t('channels.telegram.tokenHint')} error={message(connect.error, 'token')}>
            <Input mono type="password" autoComplete="off" value={token} placeholder="123456789:AA…" invalid={!!message(connect.error, 'token')} onChange={(event) => setToken(event.target.value)} />
          </Field>
          <div>
            <Checkbox checked={ack} onCheckedChange={(checked) => setAck(checked === true)} label={t('channels.telegram.acknowledge')} description={t('channels.telegram.acknowledgeHint')} />
            {message(connect.error, 'acknowledgeEviction') ? <p className="mt-1 text-[13px] text-danger" role="alert">{message(connect.error, 'acknowledgeEviction')}</p> : null}
          </div>
          <div>
            <Button type="submit" variant="accent" size="sm" loading={connect.isPending} leftIcon={<Bot size={16} strokeWidth={1.75} />}>
              {t('channels.telegram.connect')}
            </Button>
          </div>
        </form>
      ) : null}

      {awaiting ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            {t('channels.telegram.awaitingIntro', { bot: integration.botUsername ?? '' })}
          </p>
          <Steps keys={[1, 2, 3, 4, 5]} prefix="channels.telegram.attach" />
          <div className="flex items-center gap-2 rounded-ui bg-sunken px-3 py-2 text-[13px] text-muted" role="status">
            <Spinner size={16} />
            <span>{poll.isFetching ? t('channels.telegram.checking') : t('channels.telegram.polling')}</span>
          </div>
          <div>
            <Button variant="danger-outline" size="sm" onClick={() => setConfirm(true)}>
              {t('channels.telegram.cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {integration.state === 'connected' ? (
        <div className="flex flex-col gap-4">
          <dl>
            <SummaryRow label={t('channels.telegram.bot')} mono>{integration.botUsername ?? '—'}</SummaryRow>
            <SummaryRow label={t('channels.telegram.business')}>{integration.businessAccount ?? '—'}</SummaryRow>
            <SummaryRow label={t('channels.telegram.connectedAt')}>{integration.connectedAt ? formatDateTime(integration.connectedAt, lang) : '—'}</SummaryRow>
            <SummaryRow label={t('channels.telegram.window')}>{t('channels.telegram.windowValue')}</SummaryRow>
          </dl>
          {banner ? <Notice tone={banner.tone}>{banner.text}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              loading={test.isPending}
              leftIcon={<Zap size={16} strokeWidth={1.75} />}
              onClick={async () => {
                setBanner(null)
                try {
                  const result = await test.mutateAsync()
                  setBanner({ tone: result.ok ? 'success' : 'danger', text: result.ok ? t('channels.telegram.testOk') : t('channels.telegram.testFail') })
                } catch (error) {
                  setBanner({ tone: 'danger', text: errorMessage(error) })
                }
              }}
            >
              {t('channels.meta.test')}
            </Button>
            <Button variant="danger-outline" size="sm" leftIcon={<Trash2 size={16} strokeWidth={1.75} />} onClick={() => setConfirm(true)}>
              {t('channels.telegram.disconnect')}
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        tone="danger"
        title={t('channels.telegram.disconnectTitle')}
        description={t('channels.telegram.disconnectDescription')}
        confirmLabel={t('channels.telegram.disconnect')}
        onConfirm={async () => {
          await disconnect.mutateAsync()
          setBanner(null)
          toast.success(t('channels.telegram.disconnected'))
        }}
      />
    </Card>
  )
}
