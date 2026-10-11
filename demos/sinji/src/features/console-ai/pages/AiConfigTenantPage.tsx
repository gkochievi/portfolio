/** AI setup for one workspace: a connection per capability, plus the legacy text-AI override. */
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, KeyRound, Library } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/lib/api'
import { errorMessage, fieldError } from '@/api/client'
import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Panel,
  Select,
  Switch,
  Textarea,
  toast,
} from '@/components/ui'
import { formatDateTime } from '@/lib/format'
import type { AiCapability } from '@/types'
import { useCatalog, useRemoveLegacyKey, useSaveTenantAi, useTenantAi } from '../api'
import { CapabilityLabel, QueryState } from '../components/bits'
import { workspaceName } from '../components/IntegrationDialog'
import { CAPABILITIES, type TenantAiPayload } from '../types'

const DEFAULT = '__default'

interface Form {
  assignments: Record<AiCapability, string>
  enabled: boolean
  provider: string
  model: string
  baseUrl: string
  notes: string
}

const formOf = (d: TenantAiPayload): Form => ({
  assignments: { llm: d.assignments.llm ?? DEFAULT, stt: d.assignments.stt ?? DEFAULT, tts: d.assignments.tts ?? DEFAULT },
  enabled: d.legacy.enabled,
  provider: d.legacy.provider,
  model: d.legacy.model,
  baseUrl: d.legacy.base_url ?? '',
  notes: d.legacy.notes,
})

export default function AiConfigTenantPage() {
  const { tenantId = '' } = useParams()
  const { t, i18n } = useTranslation('consoleAi')
  const lang = i18n.language
  const query = useTenantAi(tenantId)
  const catalog = useCatalog()
  const save = useSaveTenantAi(tenantId)
  const removeKey = useRemoveLegacyKey(tenantId)
  const [form, setForm] = useState<Form | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmRemove, setConfirmRemove] = useState(false)

  const data = query.data
  useEffect(() => {
    if (data) {
      setForm(formOf(data))
      setApiKey('')
      setErrors({})
    }
  }, [data])

  const saved = useMemo(() => (data ? formOf(data) : null), [data])
  const dirty = !!form && !!saved && (apiKey.trim() !== '' || JSON.stringify(form) !== JSON.stringify(saved))
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f))

  const defaultFor = (cap: AiCapability) => data?.connections.find((c) => c.capability === cap && c.is_default && c.is_active)

  /** What a capability would resolve to once the current selection is saved. */
  const preview = (cap: AiCapability) => {
    if (!data || !form) return null
    const sel = form.assignments[cap]
    if (sel === (data.assignments[cap] ?? DEFAULT)) return null
    const conn = sel === DEFAULT ? defaultFor(cap) : data.connections.find((c) => c.id === sel)
    return conn ?? null
  }

  const submit = async () => {
    if (!form || !data) return
    const e: Record<string, string> = {}
    if (form.enabled) {
      if (!form.provider) e['legacy.provider'] = t('tenant.legacy.errProvider')
      if (!form.model.trim()) e['legacy.model'] = t('tenant.legacy.errModel')
      if (!apiKey.trim() && !data.legacy.has_key) e['legacy.api_key'] = t('tenant.legacy.errKey')
    }
    if (form.baseUrl.trim()) {
      try {
        const u = new URL(form.baseUrl.trim())
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol')
      } catch {
        e['legacy.base_url'] = t('tenant.legacy.errUrl')
      }
    }
    if (form.notes.length > 500) e['legacy.notes'] = t('tenant.legacy.errNotes')
    setErrors(e)
    if (Object.keys(e).length) return
    try {
      await save.mutateAsync({
        assignments: {
          llm: form.assignments.llm === DEFAULT ? null : form.assignments.llm,
          stt: form.assignments.stt === DEFAULT ? null : form.assignments.stt,
          tts: form.assignments.tts === DEFAULT ? null : form.assignments.tts,
        },
        legacy: {
          enabled: form.enabled,
          provider: form.provider,
          model: form.model.trim(),
          base_url: form.baseUrl.trim() || null,
          ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
          notes: form.notes.trim(),
        },
      })
      toast.success(t('tenant.saved'))
    } catch (err) {
      const next: Record<string, string> = {}
      for (const f of ['assignments.llm', 'assignments.stt', 'assignments.tts', 'legacy.provider', 'legacy.model', 'legacy.base_url', 'legacy.api_key', 'legacy.notes']) {
        const m = fieldError(err, f)
        if (m) next[f] = m
      }
      setErrors(next)
      if (!Object.keys(next).length) toast.error(errorMessage(err))
    }
  }

  const notFound = query.error instanceof ApiError && query.error.status === 404
  const name = data ? workspaceName(data.tenant, lang) : ''
  const llmProviders = (catalog.data ?? []).filter((p) => p.capabilities.includes('llm'))

  return (
    <div className="space-y-5">
      <Link to="/ai-config" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {t('tenant.back')}
      </Link>

      {notFound ? (
        <EmptyState
          title={t('tenant.notFound')}
          body={t('tenant.notFoundBody')}
          action={
            <Button asChild variant="secondary">
              <Link to="/ai-config">{t('tenant.back')}</Link>
            </Button>
          }
        />
      ) : (
        <QueryState loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} rows={4}>
          {data && form ? (
            <>
              <PageHeader
                title={name}
                description={t('tenant.description')}
                meta={!data.tenant.is_active ? <Badge>{t('setup.inactive')}</Badge> : undefined}
                actions={
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="secondary" icon={<BarChart3 />}>
                      <Link to={`/usage/overview?client_id=${encodeURIComponent(data.tenant.id)}`}>{t('tenant.openUsage')}</Link>
                    </Button>
                    <Button asChild variant="secondary" icon={<Library />}>
                      <Link to="/console/ai-providers">{t('tenant.openRegistry')}</Link>
                    </Button>
                  </div>
                }
              />

              <Panel title={t('tenant.assignments')} description={t('tenant.assignmentsHint')}>
                <ul className="divide-y divide-line">
                  {CAPABILITIES.map((cap) => {
                    const eff = data.effective[cap]
                    const next = preview(cap)
                    const conns = data.connections.filter((c) => c.capability === cap)
                    const dflt = defaultFor(cap)
                    return (
                      <li key={cap} className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6">
                        <div className="text-[13px] font-medium">
                          <CapabilityLabel capability={cap} />
                        </div>
                        <div className="min-w-0 space-y-2">
                          <Field error={errors[`assignments.${cap}`]}>
                            <Select
                              value={form.assignments[cap]}
                              onValueChange={(v) => set({ assignments: { ...form.assignments, [cap]: v } })}
                              aria-label={t(`capabilityLong.${cap}`)}
                              options={[
                                { value: DEFAULT, label: t('tenant.useDefault'), hint: dflt ? dflt.name : t('setup.noDefault') },
                                ...conns.map((c) => ({
                                  value: c.id,
                                  label: c.name,
                                  hint: c.is_active ? c.model : t('providers.card.inactive'),
                                  disabled: !c.is_active && c.id !== data.assignments[cap],
                                })),
                              ]}
                            />
                          </Field>
                          <p className="text-[13px] text-muted" aria-live="polite">
                            <span className="font-medium text-ink">{t('tenant.inEffect')}</span>{' '}
                            {eff.connection_id || eff.source === 'byo' || eff.source === 'legacy' ? (
                              <>
                                {eff.source === 'byo' ? t('setup.ownKey') : eff.name}
                                {eff.model ? <span className="font-mono text-xs"> · {eff.model}</span> : null}{' '}
                                <Badge size="sm" tone={eff.source === 'assigned' ? 'primary' : eff.source === 'byo' ? 'accent' : 'neutral'}>
                                  {t(`tenant.source.${eff.source}`)}
                                </Badge>
                              </>
                            ) : (
                              <span className="text-warning">{t('tenant.nothing')}</span>
                            )}
                          </p>
                          {eff.own_key && next ? <p className="text-xs text-muted">{t('tenant.byoWins')}</p> : null}
                          {next && !eff.own_key ? (
                            <p className="text-xs text-primary">
                              {t('tenant.afterSave', { name: next.name })} <span className="font-mono">· {next.model}</span>
                            </p>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </Panel>

              <Panel title={t('tenant.legacy.title')} description={t('tenant.legacy.description')} icon={<KeyRound />}>
                <div className="space-y-4">
                  <Switch checked={form.enabled} onCheckedChange={(v) => set({ enabled: v })} label={t('tenant.legacy.enabled')} description={t('tenant.legacy.enabledHint')} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={t('tenant.legacy.provider')} error={errors['legacy.provider']}>
                      <Select
                        value={form.provider || undefined}
                        onValueChange={(v) => set({ provider: v })}
                        placeholder={t('providers.form.providerPh')}
                        options={llmProviders.map((p) => ({ value: p.id, label: p.name }))}
                      />
                    </Field>
                    <Field label={t('tenant.legacy.model')} error={errors['legacy.model']}>
                      <Input mono value={form.model} onChange={(e) => set({ model: e.target.value })} placeholder="model-name" />
                    </Field>
                    <Field label={t('tenant.legacy.baseUrl')} error={errors['legacy.base_url']} hint={t('providers.form.baseUrlHint')}>
                      <Input mono value={form.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} placeholder="https://" inputMode="url" />
                    </Field>
                    <div>
                      <Field
                        label={t('tenant.legacy.apiKey')}
                        error={errors['legacy.api_key']}
                        hint={data.legacy.has_key ? t('tenant.legacy.keyStored', { hint: data.legacy.key_hint ?? '••••' }) : t('tenant.legacy.keyNone')}
                      >
                        <Input
                          type="password"
                          mono
                          autoComplete="new-password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder={data.legacy.has_key ? '••••••••••••' : t('providers.form.apiKeyPh')}
                        />
                      </Field>
                      {data.legacy.has_key ? (
                        <Button size="xs" variant="danger-ghost" className="mt-2" onClick={() => setConfirmRemove(true)}>
                          {t('tenant.legacy.removeKey')}
                        </Button>
                      ) : null}
                    </div>
                    <Field label={t('tenant.legacy.notes')} error={errors['legacy.notes']} className="md:col-span-2" optional>
                      <Textarea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
                    </Field>
                  </div>
                  <p className="text-xs text-muted">
                    {data.legacy.updated_at
                      ? t('tenant.legacy.changed', { when: formatDateTime(data.legacy.updated_at, lang), by: data.legacy.updated_by ?? '-' })
                      : t('tenant.legacy.neverChanged')}
                  </p>
                </div>
              </Panel>

              <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-bg/90 px-1 py-3 backdrop-blur">
                <span className="mr-auto text-[13px] text-muted" aria-live="polite">
                  {dirty ? t('tenant.unsaved') : t('tenant.upToDate')}
                </span>
                <Button variant="ghost" disabled={!dirty || save.isPending} onClick={() => { setForm(formOf(data)); setApiKey(''); setErrors({}) }}>
                  {t('discard')}
                </Button>
                <Button variant="primary" disabled={!dirty} loading={save.isPending} onClick={submit} className="min-w-28">
                  {t('save')}
                </Button>
              </div>

              {!data.tenant.is_active ? <Callout tone="warning">{t('tenant.inactiveNote')}</Callout> : null}

              <ConfirmDialog
                open={confirmRemove}
                onOpenChange={setConfirmRemove}
                title={t('tenant.legacy.removeTitle')}
                body={t('tenant.legacy.removeBody')}
                confirmLabel={t('tenant.legacy.removeConfirm')}
                danger
                onConfirm={async () => {
                  try {
                    await removeKey.mutateAsync()
                    toast.success(t('tenant.legacy.removed'))
                  } catch (err) {
                    toast.error(errorMessage(err))
                  }
                  setConfirmRemove(false)
                }}
              />
            </>
          ) : null}
        </QueryState>
      )}
    </div>
  )
}
