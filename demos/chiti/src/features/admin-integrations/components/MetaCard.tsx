/**
 * Messenger / Instagram / WhatsApp card: status, credential summary, the fake
 * Authorize flow (1.5 s), the manual credentials form, Test and Delete.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, KeyRound, Plug, Trash2, Zap } from 'lucide-react'

import { errorMessage } from '@/api/client'
import { Badge, Button, Card, ConfirmDialog, Field, IconButton, Input, Modal, Switch, toast, type BadgeTone } from '@/components/ui'
import { formatDateTime } from '@/lib/format'
import type { MetaAuthStatus, MetaIntegration } from '@/types'

import { useConnectMeta, useDeleteMeta, useSaveMeta, useTestMeta, type MetaFormInput } from '../api'
import type { MetaChannel } from '../types'
import { ChannelIcon, Notice, SummaryRow, copyText, useFieldMessage, useLang } from './shared'

const STATUS_TONE: Record<MetaAuthStatus, BadgeTone> = {
  not_configured: 'muted',
  disabled: 'neutral',
  connected: 'success',
  invalid_credentials: 'danger',
  network_error: 'warning',
  saved_untested: 'info',
}

export function StatusBadge({ status }: { status: MetaAuthStatus }) {
  const { t } = useTranslation('adminIntegrations')
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {t(`channels.status.${status}`)}
    </Badge>
  )
}

type Banner = { tone: 'success' | 'danger'; text: string } | null

export function MetaCard({ integration, allowed }: { integration: MetaIntegration; allowed: boolean }) {
  const { t } = useTranslation(['adminIntegrations', 'common'])
  const lang = useLang()
  const channel = integration.channel as MetaChannel
  const connect = useConnectMeta()
  const test = useTestMeta()
  const remove = useDeleteMeta()
  const [authorizing, setAuthorizing] = useState(false)
  const [manual, setManual] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [banner, setBanner] = useState<Banner>(null)
  const configured = integration.authStatus !== 'not_configured'
  const channelName = t(`common:channel.${channel}`)

  const runTest = async () => {
    setBanner(null)
    try {
      const result = await test.mutateAsync(channel)
      setBanner(result.ok ? { tone: 'success', text: t('channels.meta.testOk') } : { tone: 'danger', text: result.message })
    } catch (error) {
      setBanner({ tone: 'danger', text: errorMessage(error) })
    }
  }

  const derivedBanner: Banner =
    banner ??
    ((integration.authStatus === 'invalid_credentials' || integration.authStatus === 'network_error') && integration.lastTestError
      ? { tone: 'danger', text: integration.lastTestError }
      : null)

  if (!allowed) {
    return (
      <Card muted className="flex flex-col gap-3">
        <CardTitle channel={channel} name={channelName} badge={<Badge tone="muted">{t('channels.disabledByPlatform')}</Badge>} />
        <Notice tone="info">{t('channels.disabledByPlatformHint')}</Notice>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle channel={channel} name={channelName} badge={<StatusBadge status={integration.authStatus} />} />

      {configured ? (
        <dl>
          <SummaryRow label={t('channels.meta.displayName')}>{integration.displayName ?? '—'}</SummaryRow>
          <SummaryRow label={t(`channels.meta.routing.${channel}`)} mono>{integration.routingId ?? '—'}</SummaryRow>
          <SummaryRow label={t('channels.meta.token')} mono>{integration.accessTokenPreview ?? '—'}</SummaryRow>
          <SummaryRow label={t('channels.meta.lastTested')}>{integration.lastTestedAt ? formatDateTime(integration.lastTestedAt, lang) : t('channels.meta.never')}</SummaryRow>
        </dl>
      ) : (
        <p className="text-sm text-muted">{t(`channels.meta.intro.${channel}`)}</p>
      )}

      <WebhookRow url={integration.webhookUrl} />

      {derivedBanner ? <Notice tone={derivedBanner.tone}>{derivedBanner.text}</Notice> : null}

      <div className="mt-auto flex flex-wrap gap-2">
        <Button variant="accent" size="sm" leftIcon={<Plug size={16} strokeWidth={1.75} />} onClick={() => setAuthorizing(true)}>
          {configured ? t('channels.meta.reconnect') : t('channels.meta.connect')}
        </Button>
        <Button variant="outline" size="sm" leftIcon={<KeyRound size={16} strokeWidth={1.75} />} onClick={() => setManual(true)}>
          {t('channels.meta.manual')}
        </Button>
        {configured ? (
          <>
            <Button variant="outline" size="sm" loading={test.isPending} leftIcon={<Zap size={16} strokeWidth={1.75} />} onClick={() => void runTest()}>
              {t('channels.meta.test')}
            </Button>
            <Button variant="danger-outline" size="sm" leftIcon={<Trash2 size={16} strokeWidth={1.75} />} onClick={() => setConfirmRemove(true)}>
              {t('common:actions.delete')}
            </Button>
          </>
        ) : null}
      </div>

      <Modal
        open={authorizing}
        onOpenChange={(open) => !connect.isPending && setAuthorizing(open)}
        dismissible={!connect.isPending}
        title={t('channels.authorize.title', { channel: channelName })}
        description={t('channels.authorize.description', { channel: channelName })}
        footer={
          <>
            <Button variant="secondary" disabled={connect.isPending} onClick={() => setAuthorizing(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="accent"
              loading={connect.isPending}
              onClick={async () => {
                try {
                  const view = await connect.mutateAsync(channel)
                  setAuthorizing(false)
                  const row = view.meta.find((item) => item.channel === channel)
                  setBanner({ tone: 'success', text: t('channels.authorize.done', { name: row?.displayName ?? channelName }) })
                  toast.success(t('channels.authorize.toast', { channel: channelName }))
                } catch (error) {
                  toast.error(errorMessage(error))
                }
              }}
            >
              {connect.isPending ? t('channels.authorize.working') : t('channels.authorize.allow')}
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-2 text-sm">
          {(['read', 'send', 'webhooks'] as const).map((scope) => (
            <li key={scope} className="flex items-start gap-2">
              <Check size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <span>{t(`channels.authorize.scope.${scope}`)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">{t('channels.authorize.demoNote')}</p>
      </Modal>

      {manual ? <ManualForm integration={integration} channel={channel} onClose={() => setManual(false)} onSaved={(text) => setBanner({ tone: 'success', text })} /> : null}

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        tone="danger"
        title={t('channels.meta.deleteTitle', { channel: channelName })}
        description={t('channels.meta.deleteDescription')}
        confirmLabel={t('common:actions.delete')}
        onConfirm={async () => {
          await remove.mutateAsync(channel)
          setBanner(null)
          toast.success(t('channels.meta.deleted', { channel: channelName }))
        }}
      />
    </Card>
  )
}

export function CardTitle({ channel, name, badge }: { channel: MetaChannel | 'telegram' | 'tiktok'; name: string; badge: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-ui bg-sunken text-ink">
          <ChannelIcon channel={channel} size={20} />
        </span>
        <h2 className="font-display text-base font-semibold">{name}</h2>
      </div>
      {badge}
    </div>
  )
}

function WebhookRow({ url }: { url: string }) {
  const { t } = useTranslation(['adminIntegrations', 'common'])
  return (
    <Field label={t('channels.meta.webhook')}>
      <div className="flex items-center gap-2">
        <Input readOnly mono size="sm" value={url} onFocus={(event) => event.currentTarget.select()} aria-label={t('channels.meta.webhook')} />
        <IconButton
          label={t('common:actions.copy')}
          icon={<Copy size={16} strokeWidth={1.75} />}
          variant="outline"
          size="sm"
          onClick={async () => {
            const ok = await copyText(url)
            if (ok) toast.success(t('common:actions.copied'))
            else toast.error(t('channels.meta.copyFailed'))
          }}
        />
      </div>
    </Field>
  )
}

function ManualForm({ integration, channel, onClose, onSaved }: { integration: MetaIntegration; channel: MetaChannel; onClose: () => void; onSaved: (text: string) => void }) {
  const { t } = useTranslation(['adminIntegrations', 'common'])
  const save = useSaveMeta()
  const message = useFieldMessage()
  const [form, setForm] = useState<MetaFormInput>({
    enabled: integration.authStatus === 'not_configured' ? true : integration.enabled,
    displayName: integration.displayName ?? '',
    routingId: integration.routingId ?? '',
    accessToken: '',
    appSecret: '',
    verifyToken: integration.verifyToken ?? '',
  })
  const set = <K extends keyof MetaFormInput>(key: K, value: MetaFormInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const error = save.error

  const submit = async () => {
    try {
      await save.mutateAsync({ channel, ...form })
      onSaved(t('channels.meta.saved'))
      toast.success(t('channels.meta.saved'))
      onClose()
    } catch (err) {
      if (!message(err, 'routingId') && !message(err, 'displayName') && !message(err, 'accessToken') && !message(err, 'appSecret') && !message(err, 'verifyToken')) toast.error(errorMessage(err))
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      size="md"
      title={t('channels.form.title', { channel: t(`common:channel.${channel}`) })}
      description={t('channels.form.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => void submit()}>{t('common:actions.save')}</Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <Switch labelFirst label={t('channels.form.enabled')} checked={form.enabled} onCheckedChange={(checked) => set('enabled', checked)} />
        <Field label={t('channels.meta.displayName')} required error={message(error, 'displayName')}>
          <Input value={form.displayName} invalid={!!message(error, 'displayName')} onChange={(event) => set('displayName', event.target.value)} />
        </Field>
        <Field label={t(`channels.meta.routing.${channel}`)} required hint={t('channels.form.routingHint')} error={message(error, 'routingId')}>
          <Input mono inputMode="numeric" value={form.routingId} invalid={!!message(error, 'routingId')} onChange={(event) => set('routingId', event.target.value)} />
        </Field>
        <Field
          label={t('channels.meta.token')}
          required={!integration.accessTokenPreview}
          hint={integration.accessTokenPreview ? t('channels.form.keepSecret', { preview: integration.accessTokenPreview }) : t('channels.form.tokenHint')}
          error={message(error, 'accessToken')}
        >
          <Input mono type="password" autoComplete="off" value={form.accessToken} invalid={!!message(error, 'accessToken')} onChange={(event) => set('accessToken', event.target.value)} />
        </Field>
        <Field
          label={t('channels.form.appSecret')}
          required={!integration.hasAppSecret}
          hint={integration.hasAppSecret ? t('channels.form.appSecretSaved') : undefined}
          error={message(error, 'appSecret')}
        >
          <Input mono type="password" autoComplete="off" value={form.appSecret} invalid={!!message(error, 'appSecret')} onChange={(event) => set('appSecret', event.target.value)} />
        </Field>
        <Field label={t('channels.form.verifyToken')} required error={message(error, 'verifyToken')}>
          <div className="flex items-center gap-2">
            <Input mono value={form.verifyToken} invalid={!!message(error, 'verifyToken')} onChange={(event) => set('verifyToken', event.target.value)} />
            <Button type="button" variant="outline" size="sm" onClick={() => set('verifyToken', `chiti-${Math.random().toString(36).slice(2, 10)}`)}>
              {t('channels.form.generate')}
            </Button>
          </div>
        </Field>
        <p className="text-xs text-muted">{t('channels.form.testHint')}</p>
      </form>
    </Modal>
  )
}
