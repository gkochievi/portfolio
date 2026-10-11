/** One AI capability (llm / stt / tts): effective connection + own-key override. OWNED BY: workspace-settings. */
import { AudioLines, Brain, KeyRound, Mic, Trash2, Zap } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, Callout, Field, Input, KeyValue, Panel, Select, Switch, Textarea, toast } from '@/components/ui'
import type { AiCapability, AiEffective, AiProviderEntry } from '@/types'
import {
  errorMessage,
  useRemoveAiOverride,
  useSaveAiOverride,
  useTestAiOverride,
  type AiCapabilityView,
  type AiTestResult,
} from '../api'

const ICONS: Record<AiCapability, React.ReactNode> = {
  llm: <Brain className="size-4" />,
  stt: <Mic className="size-4" />,
  tts: <AudioLines className="size-4" />,
}
const SOURCE_TONE: Record<AiEffective['source'], 'accent' | 'primary' | 'neutral' | 'warning'> = {
  byo: 'accent',
  assigned: 'primary',
  default: 'neutral',
  legacy: 'warning',
}
const NOTES_MAX = 500

export default function AiCapabilityCard({
  view,
  providers,
  canEdit,
}: {
  view: AiCapabilityView
  providers: AiProviderEntry[]
  canEdit: boolean
}) {
  const { t } = useTranslation('settings')
  const cap = view.capability
  const { override, effective, fallback } = view
  const available = providers.filter((p) => p.capabilities.includes(cap))
  const providerName = (id: string) => providers.find((p) => p.id === id)?.name ?? id

  const save = useSaveAiOverride(cap)
  const remove = useRemoveAiOverride(cap)
  const test = useTestAiOverride(cap)

  const [provider, setProvider] = useState(override?.provider ?? available[0]?.id ?? '')
  const [model, setModel] = useState(override?.model ?? available[0]?.models[cap]?.[0] ?? '')
  const [apiKey, setApiKey] = useState('')
  const [notes, setNotes] = useState(override?.notes ?? '')
  const [enabled, setEnabled] = useState(override?.enabled ?? false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiTestResult | null>(null)

  const models = (() => {
    const list = providers.find((p) => p.id === provider)?.models[cap] ?? []
    return model && !list.includes(model) ? [model, ...list] : list
  })()

  const dirty =
    !override ||
    provider !== override.provider ||
    model !== override.model ||
    notes !== override.notes ||
    enabled !== override.enabled ||
    apiKey.trim() !== ''

  const changeProvider = (id: string) => {
    setProvider(id)
    setModel(providers.find((p) => p.id === id)?.models[cap]?.[0] ?? '')
  }

  const clearFeedback = () => {
    setError(null)
    setFieldErrors({})
    setResult(null)
  }

  const submit = async () => {
    clearFeedback()
    try {
      await save.mutateAsync({ provider, model, notes, enabled, ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}) })
      setApiKey('')
      toast.success(t('ai.saved', { capability: t(`ai.capabilities.${cap}.name`) }))
    } catch (e) {
      const fields = (e as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {}
      setFieldErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.join(' ')])))
      setError(Object.keys(fields).length ? null : errorMessage(e, t('ai.failed')))
    }
  }

  const doRemove = async (keyOnly: boolean) => {
    clearFeedback()
    try {
      await remove.mutateAsync(keyOnly)
      toast.success(t(keyOnly ? 'ai.keyRemoved' : 'ai.overrideRemoved'))
    } catch (e) {
      setError(errorMessage(e, t('ai.failed')))
    }
  }

  const doTest = async () => {
    clearFeedback()
    try {
      setResult(await test.mutateAsync())
    } catch (e) {
      setError(errorMessage(e, t('ai.failed')))
    }
  }

  const effectiveLabel = effective.source === 'byo' ? t('ai.ownKeyLabel') : effective.name || '-'

  return (
    <Panel
      title={t(`ai.capabilities.${cap}.name`)}
      description={t(`ai.capabilities.${cap}.description`)}
      icon={ICONS[cap]}
      actions={<Badge tone={SOURCE_TONE[effective.source]}>{t(`ai.source.${effective.source}`)}</Badge>}
    >
      <div className="space-y-5">
        <div>
          <p className="caps mb-2 text-xs text-muted">{t('ai.effective')}</p>
          <KeyValue
            columns={3}
            items={[
              { label: t('ai.connection'), value: effectiveLabel },
              { label: t('ai.provider'), value: effective.provider ? providerName(effective.provider) : '-' },
              { label: t('ai.model'), value: effective.model || '-', mono: true },
            ]}
          />
          {override && effective.source !== 'byo' ? (
            <p className="mt-2 text-xs text-muted">
              {override.enabled ? t('ai.needsKey') : t('ai.overrideOff', { name: fallback.name || t(`ai.source.${fallback.source}`) })}
            </p>
          ) : null}
          {effective.source === 'byo' ? <p className="mt-2 text-xs text-muted">{t('ai.byoNote', { name: fallback.name || t(`ai.source.${fallback.source}`) })}</p> : null}
        </div>

        <div className="border-t border-line pt-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium">
            <KeyRound className="size-4 text-muted" aria-hidden />
            {t('ai.override.title')}
          </p>
          {canEdit ? null : <p className="mb-3 text-xs text-muted">{override ? t('ai.override.readOnlySet') : t('ai.override.readOnlyNone')}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('ai.provider')} error={fieldErrors.provider}>
              <Select
                value={provider}
                disabled={!canEdit}
                onValueChange={changeProvider}
                options={available.map((p) => ({ value: p.id, label: p.name }))}
              />
            </Field>
            <Field label={t('ai.model')} error={fieldErrors.model}>
              <Select value={model} disabled={!canEdit} onValueChange={setModel} options={models.map((m) => ({ value: m, label: m }))} />
            </Field>
            <Field
              className="sm:col-span-2"
              label={t('ai.key.label')}
              hint={override?.has_key ? t('ai.key.stored', { hint: override.key_hint ?? '' }) : t('ai.key.hint')}
              error={fieldErrors.api_key}
            >
              <Input
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                mono
                value={apiKey}
                disabled={!canEdit}
                placeholder={override?.has_key ? `${override.key_hint ?? '••••'}` : t('ai.key.placeholder')}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </Field>
            <Field
              className="sm:col-span-2"
              label={t('ai.notes')}
              optional
              hint={t('ai.notesHint', { n: notes.length, max: NOTES_MAX })}
              error={fieldErrors.notes ?? (notes.length > NOTES_MAX ? t('ai.notesTooLong', { max: NOTES_MAX }) : undefined)}
            >
              <Textarea rows={2} value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          <div className="mt-4">
            <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!canEdit} label={t('ai.enable')} description={t('ai.enableHint')} />
          </div>

          {error ? <Callout tone="danger" className="mt-4">{error}</Callout> : null}
          {result ? (
            <Callout tone={result.ok ? 'success' : 'danger'} className="mt-4" title={result.ok ? t('ai.test.ok') : t('ai.test.fail')}>
              {result.ok ? t('ai.test.okDetail', { detail: result.detail }) : t('ai.test.failDetail', { detail: result.detail })}
            </Callout>
          ) : null}

          {canEdit ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="primary" loading={save.isPending} disabled={!dirty || notes.length > NOTES_MAX || !provider || !model} onClick={() => void submit()} className="min-w-24">
                {t('ai.save')}
              </Button>
              <Button variant="secondary" icon={<Zap />} loading={test.isPending} onClick={() => void doTest()}>
                {t('ai.test.button')}
              </Button>
              {override?.has_key ? (
                <Button variant="ghost" loading={remove.isPending && remove.variables === true} onClick={() => void doRemove(true)}>
                  {t('ai.removeKey')}
                </Button>
              ) : null}
              {override ? (
                <Button variant="danger-ghost" icon={<Trash2 />} loading={remove.isPending && remove.variables === false} onClick={() => void doRemove(false)}>
                  {t('ai.removeOverride')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  )
}
