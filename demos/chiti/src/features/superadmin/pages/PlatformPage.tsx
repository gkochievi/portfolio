import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, FlaskConical, Link2, Save, Webhook } from 'lucide-react'

import { Badge, Button, ErrorState, Field, Input, LoadingBlock, PageHeader, Switch, toast } from '@/components/ui'
import { formatDateTime, pickText } from '@/lib/format'
import type { ChannelFeatures } from '@/types'

import { usePlatform, useRegisterWebhook, useSaveMeta, useSaveTikTok, useSuperErrors, useTestIntegrations, useUpdateFeatures } from '../api'
import { FEATURE_CHANNELS } from '../components/FeaturesTab'
import { ChecksList, Panel, StateBadge } from '../components/shared'
import type { ChecksResponse, PlatformResponse } from '../types'

interface MetaForm {
  appId: string
  appSecret: string
  oauthRedirectBase: string
  loginConfigId: string
  whatsappConfigId: string
}
interface TikTokForm {
  appId: string
  appSecret: string
}

const metaFrom = (data: PlatformResponse): MetaForm => ({
  appId: data.settings.metaAppId,
  appSecret: '',
  oauthRedirectBase: data.settings.metaOAuthRedirectBase,
  loginConfigId: data.settings.metaLoginConfigId ?? '',
  whatsappConfigId: data.settings.metaWhatsappConfigId ?? '',
})
const tiktokFrom = (data: PlatformResponse): TikTokForm => ({ appId: data.settings.tiktokAppId ?? '', appSecret: '' })

export default function PlatformPage() {
  const { t, i18n } = useTranslation('superadmin')
  const lang = i18n.language
  const errors = useSuperErrors()
  const platform = usePlatform()
  const features = useUpdateFeatures()
  const saveMeta = useSaveMeta()
  const saveTikTok = useSaveTikTok()
  const test = useTestIntegrations()
  const register = useRegisterWebhook()

  const [meta, setMeta] = useState<MetaForm | null>(null)
  const [tiktok, setTikTok] = useState<TikTokForm | null>(null)
  const [metaErrors, setMetaErrors] = useState<Record<string, string>>({})
  const [tiktokErrors, setTikTokErrors] = useState<Record<string, string>>({})
  const [results, setResults] = useState<{ meta?: ChecksResponse; tiktok?: ChecksResponse }>({})

  if (platform.isLoading) return <LoadingBlock label={t('common:states.loading')} />
  if (platform.isError || !platform.data) return <ErrorState title={t('platform.error')} onRetry={() => void platform.refetch()} retryLabel={t('common:actions.retry')} />

  const data = platform.data
  const metaForm = meta ?? metaFrom(data)
  const tiktokForm = tiktok ?? tiktokFrom(data)
  const { settings, webhook } = data

  const toggle = async (id: string, key: keyof ChannelFeatures, value: boolean) => {
    try {
      await features.mutateAsync({ id, [key]: value })
    } catch (failure) {
      toast.error(errors.text(failure))
    }
  }

  const submitMeta = async () => {
    const found: Record<string, string> = {}
    if (!metaForm.appId.trim()) found.appId = t('errors.field.required')
    if (!/^https?:\/\//i.test(metaForm.oauthRedirectBase.trim())) found.oauthRedirectBase = t('errors.field.url_invalid')
    if (metaForm.appSecret && metaForm.appSecret.length < 8) found.appSecret = t('errors.field.secret_short')
    setMetaErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      await saveMeta.mutateAsync(metaForm)
      setMeta(null)
      setResults((current) => ({ ...current, meta: undefined }))
      toast.success(t('platform.saved'))
    } catch (failure) {
      const server = errors.fields(failure)
      if (Object.keys(server).length > 0) setMetaErrors(server)
      else toast.error(errors.text(failure))
    }
  }

  const submitTikTok = async () => {
    const found: Record<string, string> = {}
    if (!tiktokForm.appId.trim()) found.appId = t('errors.field.required')
    if (tiktokForm.appSecret && tiktokForm.appSecret.length < 8) found.appSecret = t('errors.field.secret_short')
    setTikTokErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      await saveTikTok.mutateAsync(tiktokForm)
      setTikTok(null)
      setResults((current) => ({ ...current, tiktok: undefined }))
      toast.success(t('platform.saved'))
    } catch (failure) {
      const server = errors.fields(failure)
      if (Object.keys(server).length > 0) setTikTokErrors(server)
      else toast.error(errors.text(failure))
    }
  }

  const runTest = async (target: 'meta' | 'tiktok') => {
    try {
      const result = await test.mutateAsync(target)
      setResults((current) => ({ ...current, [target]: result }))
      if (result.ok) toast.success(t('platform.testOk'))
      else toast.warning(t('platform.testFailed'))
    } catch (failure) {
      toast.error(errors.text(failure))
    }
  }

  const doRegister = async () => {
    try {
      await register.mutateAsync()
      setResults((current) => ({ ...current, tiktok: undefined }))
      toast.success(t('platform.webhook.registered'))
    } catch (failure) {
      toast.error(errors.text(failure))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('platform.title')} description={t('platform.description')} />

      <Panel title={t('platform.grid.title')} description={t('platform.grid.description')}>
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <caption className="sr-only">{t('platform.grid.title')}</caption>
            <thead>
              <tr className="bg-sunken text-left text-muted">
                <th scope="col" className="px-4 py-2 font-medium sm:px-5">{t('table.tenant')}</th>
                {FEATURE_CHANNELS.map((channel) => (
                  <th key={channel.key} scope="col" className="px-3 py-2 text-center font-medium">
                    <span className="inline-flex items-center gap-1.5 [&_svg]:size-3.5">{channel.icon}{t(`common:channel.${channel.key}`)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <th scope="row" className="px-4 py-2.5 text-left font-normal sm:px-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{pickText(tenant.name, lang)}</span>
                      {tenant.state !== 'active' && <StateBadge state={tenant.state} />}
                    </div>
                    <code className="font-mono text-[11px] text-muted">{tenant.slug}</code>
                  </th>
                  {FEATURE_CHANNELS.map((channel) => (
                    <td key={channel.key} className="px-3 py-2.5 text-center">
                      <Switch
                        size="sm"
                        checked={tenant.features[channel.key]}
                        disabled={tenant.state === 'deleted'}
                        onCheckedChange={(value) => void toggle(tenant.id, channel.key, value)}
                        aria-label={t('platform.grid.cell', { tenant: pickText(tenant.name, lang), channel: t(`common:channel.${channel.key}`) })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel
          title={t('platform.meta.title')}
          description={t('platform.meta.description')}
          actions={settings.hasMetaAppSecret ? <Badge tone="success" dot>{t('platform.meta.secretSet')}</Badge> : <Badge tone="warning" dot>{t('platform.meta.secretMissing')}</Badge>}
        >
          <form
            className="grid gap-4 sm:grid-cols-2"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void submitMeta()
            }}
          >
            <Field label={t('platform.meta.appId')} error={metaErrors.appId} required>
              <Input mono value={metaForm.appId} onChange={(event) => setMeta({ ...metaForm, appId: event.target.value })} invalid={!!metaErrors.appId} autoComplete="off" />
            </Field>
            <Field label={t('platform.meta.appSecret')} hint={t('platform.meta.secretHint', { preview: settings.metaAppSecretPreview ?? '–' })} error={metaErrors.appSecret}>
              <Input
                mono
                type="password"
                value={metaForm.appSecret}
                onChange={(event) => setMeta({ ...metaForm, appSecret: event.target.value })}
                placeholder={settings.metaAppSecretPreview ?? ''}
                invalid={!!metaErrors.appSecret}
                autoComplete="new-password"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t('platform.meta.redirect')} hint={t('platform.meta.redirectHint')} error={metaErrors.oauthRedirectBase} required>
                <Input mono value={metaForm.oauthRedirectBase} onChange={(event) => setMeta({ ...metaForm, oauthRedirectBase: event.target.value })} invalid={!!metaErrors.oauthRedirectBase} leftIcon={<Link2 size={14} strokeWidth={1.75} />} />
              </Field>
            </div>
            <Field label={t('platform.meta.loginConfig')}>
              <Input mono value={metaForm.loginConfigId} onChange={(event) => setMeta({ ...metaForm, loginConfigId: event.target.value })} autoComplete="off" />
            </Field>
            <Field label={t('platform.meta.whatsappConfig')}>
              <Input mono value={metaForm.whatsappConfigId} onChange={(event) => setMeta({ ...metaForm, whatsappConfigId: event.target.value })} autoComplete="off" />
            </Field>
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" leftIcon={<FlaskConical />} loading={test.isPending && test.variables === 'meta'} onClick={() => void runTest('meta')}>
                {t('platform.test')}
              </Button>
              <Button type="submit" leftIcon={<Save />} loading={saveMeta.isPending}>
                {t('common:actions.save')}
              </Button>
            </div>
          </form>
          {results.meta && (
            <div className="mt-4 space-y-2">
              <p className="text-[13px] font-medium text-ink">{results.meta.ok ? t('platform.testOk') : t('platform.testFailed')}</p>
              <ChecksList checks={results.meta.checks} scope="platform" />
            </div>
          )}
        </Panel>

        <Panel title={t('platform.tiktok.title')} description={t('platform.tiktok.description')}>
          <form
            className="grid gap-4 sm:grid-cols-2"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void submitTikTok()
            }}
          >
            <Field label={t('platform.tiktok.appId')} error={tiktokErrors.appId} required>
              <Input mono value={tiktokForm.appId} onChange={(event) => setTikTok({ ...tiktokForm, appId: event.target.value })} invalid={!!tiktokErrors.appId} autoComplete="off" />
            </Field>
            <Field label={t('platform.tiktok.appSecret')} hint={t('platform.meta.secretHint', { preview: settings.tiktokAppSecretPreview ?? '–' })} error={tiktokErrors.appSecret}>
              <Input
                mono
                type="password"
                value={tiktokForm.appSecret}
                onChange={(event) => setTikTok({ ...tiktokForm, appSecret: event.target.value })}
                placeholder={settings.tiktokAppSecretPreview ?? ''}
                invalid={!!tiktokErrors.appSecret}
                autoComplete="new-password"
              />
            </Field>
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
              <Button type="submit" variant="secondary" leftIcon={<Save />} loading={saveTikTok.isPending}>
                {t('common:actions.save')}
              </Button>
            </div>
          </form>

          <div className="mt-5 rounded-ui border border-line bg-sunken p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-[14px] font-medium text-ink">
                <Webhook size={16} strokeWidth={1.75} aria-hidden />
                {t('platform.webhook.title')}
              </h3>
              {webhook.inSync ? (
                <Badge tone="success" icon={<CheckCircle2 size={12} />}>{t('platform.webhook.inSync')}</Badge>
              ) : (
                <Badge tone="warning" dot>{webhook.registeredUrl ? t('platform.webhook.mismatch') : t('platform.webhook.notRegistered')}</Badge>
              )}
            </div>
            <dl className="mt-3 space-y-2 text-[13px]">
              <div>
                <dt className="text-muted">{t('platform.webhook.expected')}</dt>
                <dd className="break-all font-mono text-[12px] text-ink">{webhook.expectedUrl}</dd>
              </div>
              <div>
                <dt className="text-muted">{t('platform.webhook.registeredUrl')}</dt>
                <dd className="break-all font-mono text-[12px] text-ink">{webhook.registeredUrl ?? t('platform.webhook.none')}</dd>
              </div>
              {webhook.registeredAt && (
                <div>
                  <dt className="text-muted">{t('platform.webhook.registeredAt')}</dt>
                  <dd className="text-ink">{formatDateTime(webhook.registeredAt, lang)}</dd>
                </div>
              )}
            </dl>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="outline" leftIcon={<FlaskConical />} loading={test.isPending && test.variables === 'tiktok'} onClick={() => void runTest('tiktok')}>
                {t('platform.test')}
              </Button>
              <Button size="sm" variant="secondary" loading={register.isPending} onClick={() => void doRegister()}>
                {t('platform.webhook.register')}
              </Button>
            </div>
          </div>
          {results.tiktok && (
            <div className="mt-4 space-y-2">
              <p className="text-[13px] font-medium text-ink">{results.tiktok.ok ? t('platform.testOk') : t('platform.testFailed')}</p>
              <ChecksList checks={results.tiktok.checks} scope="platform" />
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
