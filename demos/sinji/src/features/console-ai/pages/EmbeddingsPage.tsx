/** Console > Embeddings: the vector model behind knowledge-base search. */
import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Database, XCircle, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { errorMessage, fieldError } from '@/api/client'
import { Button, Callout, Card, Checkbox, ConfirmDialog, Field, Input, KeyValue, PageHeader, Panel, Select, toast } from '@/components/ui'
import { formatDateTime, formatNumber } from '@/lib/format'
import { useEmbeddings, useSaveEmbeddings, useTestEmbeddings } from '../api'
import { QueryState, translateDetail } from '../components/bits'
import type { EmbeddingsPayload, EmbeddingsTestResult } from '../types'

const CUSTOM = '__custom'

export default function EmbeddingsPage() {
  const { t, i18n } = useTranslation('consoleAi')
  const lang = i18n.language
  const query = useEmbeddings()
  const save = useSaveEmbeddings()
  const test = useTestEmbeddings()

  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [customModel, setCustomModel] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [dim, setDim] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [clearKey, setClearKey] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState<EmbeddingsTestResult | null>(null)

  const data = query.data
  const load = (d: EmbeddingsPayload) => {
    const known = d.providers.find((p) => p.id === d.provider)?.models.some((m) => m.id === d.model)
    setProvider(d.provider)
    setModel(d.model)
    setCustomModel(!known)
    setBaseUrl(d.base_url ?? '')
    setDim(String(d.dim))
    setApiKey('')
    setClearKey(false)
    setErrors({})
  }
  useEffect(() => {
    if (data) load(data)
  }, [data])

  const entry = data?.providers.find((p) => p.id === provider)
  const dimNum = Number(dim)
  const dimChanged = !!data && dim !== '' && dimNum !== data.dim
  const dirty =
    !!data &&
    (provider !== data.provider || model !== data.model || (baseUrl.trim() || null) !== data.base_url || dimNum !== data.dim || apiKey !== '' || clearKey)

  const changeProvider = (id: string) => {
    const next = data?.providers.find((p) => p.id === id)
    setProvider(id)
    setCustomModel(false)
    setResult(null)
    const first = next?.models[0]
    setModel(first?.id ?? '')
    if (first) setDim(String(first.dim))
    setBaseUrl(next?.default_base_url ?? '')
  }
  const changeModel = (id: string) => {
    setResult(null)
    if (id === CUSTOM) {
      setCustomModel(true)
      setModel('')
      return
    }
    setModel(id)
    const m = entry?.models.find((x) => x.id === id)
    if (m) setDim(String(m.dim))
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!provider) e.provider = t('embeddings.errProvider')
    if (!model.trim()) e.model = t('embeddings.errModel')
    if (!Number.isInteger(dimNum) || dimNum < 8 || dimNum > 8192) e.dim = t('embeddings.errDim')
    const url = baseUrl.trim()
    if (url) {
      try {
        const u = new URL(url)
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol')
      } catch {
        e.base_url = t('embeddings.errUrl')
      }
    } else if (provider === 'local') e.base_url = t('embeddings.errUrlRequired')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const doSave = async (acknowledge: boolean) => {
    try {
      await save.mutateAsync({
        provider,
        model: model.trim(),
        base_url: baseUrl.trim() || null,
        dim: dimNum,
        ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
        ...(clearKey && !apiKey.trim() ? { clear_key: true } : {}),
        ...(acknowledge ? { acknowledge_reimport: true } : {}),
      })
      setResult(null)
      toast.success(acknowledge ? t('embeddings.savedReimport') : t('embeddings.saved'))
    } catch (e) {
      const next: Record<string, string> = {}
      for (const f of ['provider', 'model', 'dim', 'base_url']) {
        const m = fieldError(e, f)
        if (m) next[f] = m
      }
      setErrors(next)
      if (!Object.keys(next).length) toast.error(errorMessage(e))
    }
  }

  const onSave = () => {
    if (!validate()) return
    if (dimChanged) setConfirm(true)
    else void doSave(false)
  }

  const runTest = async () => {
    if (!validate()) return
    setResult(null)
    try {
      setResult(
        await test.mutateAsync({
          provider,
          model: model.trim(),
          base_url: baseUrl.trim() || null,
          dim: dimNum,
          ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
          ...(clearKey && !apiKey.trim() ? { clear_key: true } : {}),
        }),
      )
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t('embeddings.title')} description={t('embeddings.description')} />
      <QueryState loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} rows={4}>
        {data ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Panel title={t('embeddings.formTitle')} icon={<Database />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('embeddings.provider')} error={errors.provider}>
                  <Select
                    value={provider || undefined}
                    onValueChange={changeProvider}
                    placeholder={t('embeddings.providerPh')}
                    options={data.providers.map((p) => ({ value: p.id, label: p.name }))}
                  />
                </Field>
                <Field label={t('embeddings.model')} error={errors.model}>
                  {entry && entry.models.length && !customModel ? (
                    <Select
                      value={model || undefined}
                      onValueChange={changeModel}
                      options={[
                        ...entry.models.map((m) => ({ value: m.id, label: m.id, hint: `${formatNumber(m.dim, lang)} ${t('embeddings.dimShort')}` })),
                        { value: CUSTOM, label: t('embeddings.customModel') },
                      ]}
                    />
                  ) : (
                    <Input mono value={model} onChange={(e) => { setModel(e.target.value); setResult(null) }} placeholder="model-name" />
                  )}
                </Field>
                <Field label={t('embeddings.baseUrl')} error={errors.base_url} hint={t('embeddings.baseUrlHint')} className="sm:col-span-2">
                  <Input mono value={baseUrl} onChange={(e) => { setBaseUrl(e.target.value); setResult(null) }} placeholder="https://" inputMode="url" />
                </Field>
                <Field label={t('embeddings.dim')} error={errors.dim} hint={t('embeddings.dimHint')}>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={8}
                    max={8192}
                    value={dim}
                    onChange={(e) => { setDim(e.target.value); setResult(null) }}
                    className="tabular"
                  />
                </Field>
                <div>
                  <Field
                    label={t('embeddings.apiKey')}
                    hint={data.api_key_set ? t('embeddings.apiKeyStored', { hint: data.api_key_hint ?? '••••' }) : t('embeddings.apiKeyHint')}
                  >
                    <Input
                      type="password"
                      mono
                      autoComplete="new-password"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value)
                        if (e.target.value) setClearKey(false)
                        setResult(null)
                      }}
                      placeholder={data.api_key_set ? '••••••••••••' : t('embeddings.apiKeyPh')}
                    />
                  </Field>
                  {data.api_key_set ? (
                    <div className="mt-2">
                      <Checkbox checked={clearKey} onCheckedChange={(v) => { setClearKey(v); if (v) setApiKey('') }} label={t('embeddings.clearKey')} />
                    </div>
                  ) : null}
                </div>
              </div>

              {dimChanged ? (
                <Callout tone="warning" className="mt-4" icon={<AlertTriangle />} title={t('embeddings.warnTitle')}>
                  {t('embeddings.warnBody', { from: formatNumber(data.dim, lang), to: formatNumber(dimNum, lang), count: data.indexed_chunks })}
                </Callout>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <div className="min-w-0 flex-1" aria-live="polite">
                  {test.isPending ? (
                    <span className="text-[13px] text-muted">{t('embeddings.testing')}</span>
                  ) : result ? (
                    <span className={result.ok ? 'inline-flex items-center gap-1.5 text-[13px] text-success' : 'inline-flex items-center gap-1.5 text-[13px] text-danger'}>
                      {result.ok ? <CheckCircle2 className="size-4" aria-hidden /> : <XCircle className="size-4" aria-hidden />}
                      {result.ok ? t('embeddings.testOk') : t('embeddings.testFailed')} · {translateDetail(t, result.detail)}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" icon={<Zap />} loading={test.isPending} onClick={runTest} className="min-w-24">
                    {t('embeddings.test')}
                  </Button>
                  <Button variant="ghost" disabled={!dirty || save.isPending} onClick={() => { load(data); setResult(null) }}>
                    {t('discard')}
                  </Button>
                  <Button variant="primary" disabled={!dirty} loading={save.isPending} onClick={onSave} className="min-w-24">
                    {t('save')}
                  </Button>
                </div>
              </div>
            </Panel>

            <Card className="h-fit">
              <h3 className="font-display text-lg font-semibold">{t('embeddings.inUse')}</h3>
              <KeyValue
                columns={1}
                items={[
                  { label: t('embeddings.provider'), value: data.providers.find((p) => p.id === data.provider)?.name ?? data.provider },
                  { label: t('embeddings.model'), value: data.model, mono: true },
                  { label: t('embeddings.dim'), value: formatNumber(data.dim, lang) },
                  { label: t('embeddings.apiKey'), value: data.api_key_set ? data.api_key_hint : t('embeddings.noKey'), mono: data.api_key_set },
                  { label: t('embeddings.indexed'), value: formatNumber(data.indexed_chunks, lang) },
                ]}
              />
              <p className="mt-4 text-[13px] text-muted">{t('embeddings.sideNote')}</p>
              <Button asChild variant="link" size="sm" className="mt-2">
                <Link to="/workspace/kb/maintenance">{t('embeddings.openMaintenance')}</Link>
              </Button>
              <span className="sr-only">{formatDateTime(new Date(), lang)}</span>
            </Card>
          </div>
        ) : null}
      </QueryState>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('embeddings.confirmTitle')}
        body={t('embeddings.confirmBody', { from: data ? formatNumber(data.dim, lang) : '', to: formatNumber(dimNum, lang), count: data?.indexed_chunks ?? 0 })}
        confirmLabel={t('embeddings.confirmAction')}
        danger
        onConfirm={async () => {
          await doSave(true)
          setConfirm(false)
        }}
      />
    </div>
  )
}
