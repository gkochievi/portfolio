import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, FlaskConical, KeyRound, Save, Trash2 } from 'lucide-react'

import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Input, LoadingBlock, PageHeader, toast } from '@/components/ui'
import { pickText } from '@/lib/format'

import { useAiKey, useRemoveAiKey, useSaveAiKey, useSuperErrors, useTestAiKey } from '../api'
import { ChecksList, Panel } from '../components/shared'
import type { AiTenantRef, ChecksResponse } from '../types'

export default function AiKeyPage() {
  const { t, i18n } = useTranslation('superadmin')
  const lang = i18n.language
  const errors = useSuperErrors()
  const ai = useAiKey()
  const save = useSaveAiKey()
  const test = useTestAiKey()
  const remove = useRemoveAiKey()

  const [key, setKey] = useState('')
  const [baseUrl, setBaseUrl] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ChecksResponse | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  if (ai.isLoading) return <LoadingBlock label={t('common:states.loading')} />
  if (ai.isError || !ai.data) return <ErrorState title={t('ai.error')} onRetry={() => void ai.refetch()} retryLabel={t('common:actions.retry')} />

  const data = ai.data
  const url = baseUrl ?? data.baseUrl
  const sourceTone = data.source === 'none' ? 'warning' : 'success'

  const submit = async () => {
    const found: Record<string, string> = {}
    if (!key.trim() && data.source === 'none') found.key = t('errors.field.key_required')
    else if (key.trim() && (key.trim().length < 12 || /\s/.test(key.trim()))) found.key = t('errors.field.key_invalid')
    if (!/^https?:\/\//i.test(url.trim())) found.baseUrl = t('errors.field.url_invalid')
    setFieldErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      await save.mutateAsync({ key: key.trim(), baseUrl: url.trim() })
      setKey('')
      setBaseUrl(null)
      setResult(null)
      toast.success(t('ai.saved'))
    } catch (failure) {
      const server = errors.fields(failure)
      if (Object.keys(server).length > 0) setFieldErrors(server)
      else toast.error(errors.text(failure))
    }
  }

  const runTest = async () => {
    try {
      const response = await test.mutateAsync()
      setResult(response)
      if (response.ok) toast.success(t('ai.testOk'))
      else toast.warning(t('ai.testFailed'))
    } catch (failure) {
      toast.error(errors.text(failure))
    }
  }

  const tenantList = (rows: AiTenantRef[], empty: string) =>
    rows.length === 0 ? (
      <p className="text-[13px] text-muted">{empty}</p>
    ) : (
      <ul className="divide-y divide-line overflow-hidden rounded-ui border border-line">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]">
            <span className="font-medium text-ink">{pickText(row.name, lang)}</span>
            <code className="max-w-full truncate font-mono text-[11px] text-muted">{row.aiClientId ?? row.slug}</code>
          </li>
        ))}
      </ul>
    )

  return (
    <div className="space-y-6">
      <PageHeader title={t('ai.title')} description={t('ai.description')} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title={t('ai.key.title')}
          actions={
            <Badge tone={sourceTone} dot>
              {t(`ai.source.${data.source}`)}
            </Badge>
          }
        >
          <dl className="mb-5 grid gap-3 rounded-ui bg-sunken p-3 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-muted">{t('ai.key.id')}</dt>
              <dd className="font-mono text-ink">{data.keyId ?? '–'}</dd>
            </div>
            <div>
              <dt className="text-muted">{t('ai.key.preview')}</dt>
              <dd className="font-mono text-ink">{data.keyPreview ?? '–'}</dd>
            </div>
          </dl>

          <form
            className="space-y-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <Field label={t('ai.key.new')} hint={data.source === 'none' ? t('ai.key.newHintNone') : t('ai.key.newHint')} error={fieldErrors.key}>
              <Input
                mono
                type="password"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                leftIcon={<KeyRound size={14} strokeWidth={1.75} />}
                invalid={!!fieldErrors.key}
                autoComplete="new-password"
                placeholder={data.keyPreview ?? 'chk_…'}
              />
            </Field>
            <Field
              label={t('ai.baseUrl.label')}
              error={fieldErrors.baseUrl}
              aside={
                url !== data.suggestedBaseUrl ? (
                  <Button type="button" size="xs" variant="link" onClick={() => setBaseUrl(data.suggestedBaseUrl)}>
                    {t('ai.baseUrl.useSuggested')}
                  </Button>
                ) : undefined
              }
              hint={t('ai.baseUrl.hint', { url: data.suggestedBaseUrl })}
            >
              <Input mono value={url} onChange={(event) => setBaseUrl(event.target.value)} invalid={!!fieldErrors.baseUrl} spellCheck={false} />
            </Field>
            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="danger-outline" leftIcon={<Trash2 />} disabled={data.source === 'none'} onClick={() => setConfirmRemove(true)}>
                {t('ai.remove.action')}
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" leftIcon={<FlaskConical />} loading={test.isPending} onClick={() => void runTest()}>
                  {t('ai.test')}
                </Button>
                <Button type="submit" leftIcon={<Save />} loading={save.isPending}>
                  {t('common:actions.save')}
                </Button>
              </div>
            </div>
          </form>

          {result && (
            <div className="mt-5 space-y-2">
              <p className="text-[13px] font-medium text-ink">{result.ok ? t('ai.testOk') : t('ai.testFailed')}</p>
              <ChecksList checks={result.checks} scope="ai" />
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title={t('ai.mapped.title')} description={t('ai.mapped.description')}>
            {tenantList(data.mappedTenants, t('ai.mapped.empty'))}
          </Panel>
          <Panel title={t('ai.bot.title')} description={t('ai.bot.description')} actions={<Bot size={18} strokeWidth={1.75} className="text-accent" aria-hidden />}>
            {data.botEnabledTenants.length === 0 ? (
              <EmptyState compact title={t('ai.bot.empty')} />
            ) : (
              <ul className="flex flex-wrap gap-2">
                {data.botEnabledTenants.map((row) => (
                  <li key={row.id}>
                    <Badge tone="accent">{pickText(row.name, lang)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t('ai.remove.title')}
        description={t('ai.remove.description')}
        confirmLabel={t('ai.remove.action')}
        tone="danger"
        onConfirm={async () => {
          try {
            await remove.mutateAsync()
            setResult(null)
            toast.success(t('ai.remove.done'))
          } catch (failure) {
            toast.error(errors.text(failure))
            throw failure
          }
        }}
      />
    </div>
  )
}
