/** Create / edit an AI connection: provider from the catalog, known or custom model, write-only key, settings. */
import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { errorMessage, fieldError } from '@/api/client'
import { Button, Checkbox, Dialog, Field, IconButton, Input, Select, toast } from '@/components/ui'
import type { AiCapability, AiConnection, AiProviderEntry } from '@/types'
import { useCreateConnection, useUpdateConnection } from '../api'
import { CAPABILITIES, type ConnectionSettingValue } from '../types'

const CUSTOM = '__custom'

interface SettingRow {
  key: string
  value: string
}

const toRows = (settings: AiConnection['settings']): SettingRow[] =>
  Object.entries(settings).map(([key, value]) => ({ key, value: String(value) }))

function parseValue(raw: string): ConnectionSettingValue {
  const v = raw.trim()
  if (v === 'true') return true
  if (v === 'false') return false
  if (v !== '' && !Number.isNaN(Number(v))) return Number(v)
  return v
}

export function ConnectionDialog({
  open,
  onOpenChange,
  catalog,
  connection,
  capability,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalog: AiProviderEntry[]
  /** Present = edit. */
  connection?: AiConnection | null
  /** Capability preselected for a new connection. */
  capability: AiCapability
}) {
  const { t } = useTranslation('consoleAi')
  const create = useCreateConnection()
  const update = useUpdateConnection()
  const editing = Boolean(connection)

  const [cap, setCap] = useState<AiCapability>(capability)
  const [name, setName] = useState('')
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [customModel, setCustomModel] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [clearKey, setClearKey] = useState(false)
  const [rows, setRows] = useState<SettingRow[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (!open) return
    const c = connection
    const startCap = c?.capability ?? capability
    const entry = catalog.find((p) => p.id === c?.provider)
    setCap(startCap)
    setName(c?.name ?? '')
    setProvider(c?.provider ?? '')
    setModel(c?.model ?? '')
    setCustomModel(Boolean(c && entry && !(entry.models[startCap] ?? []).includes(c.model)))
    setBaseUrl(c?.base_url ?? '')
    setApiKey('')
    setClearKey(false)
    setRows(c ? toRows(c.settings) : [])
    setErrors({})
    setFormError(null)
  }, [open, connection, capability, catalog])

  const providers = useMemo(() => catalog.filter((p) => p.capabilities.includes(cap)), [catalog, cap])
  const entry = catalog.find((p) => p.id === provider)
  const knownModels = entry?.models[cap] ?? []
  const pending = create.isPending || update.isPending

  const changeCapability = (next: AiCapability) => {
    setCap(next)
    const ok = catalog.find((p) => p.id === provider)?.capabilities.includes(next)
    if (!ok) {
      setProvider('')
      setModel('')
      setCustomModel(false)
    } else {
      setModel('')
    }
  }

  const changeProvider = (id: string) => {
    setProvider(id)
    const next = catalog.find((p) => p.id === id)
    const models = next?.models[cap] ?? []
    setCustomModel(false)
    setModel(models[0] ?? '')
    if (next?.default_base_url && !baseUrl) setBaseUrl(next.default_base_url)
    if (!next?.default_base_url && baseUrl === entry?.default_base_url) setBaseUrl('')
  }

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (name.trim().length < 2) e.name = t('providers.form.errName')
    if (!provider) e.provider = t('providers.form.errProvider')
    if (!model.trim()) e.model = t('providers.form.errModel')
    const url = baseUrl.trim()
    if (url) {
      try {
        const u = new URL(url)
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol')
      } catch {
        e.base_url = t('providers.form.errUrl')
      }
    } else if (provider === 'local') e.base_url = t('providers.form.errUrlRequired')
    const seen = new Set<string>()
    for (const r of rows) {
      const key = r.key.trim()
      if (!key && !r.value.trim()) continue
      if (!/^[a-z][a-z0-9_]{0,39}$/i.test(key)) e.settings = t('providers.form.errSettingKey')
      else if (seen.has(key.toLowerCase())) e.settings = t('providers.form.errSettingDup', { key })
      seen.add(key.toLowerCase())
    }
    return e
  }

  const submit = async () => {
    const e = validate()
    setErrors(e)
    setFormError(null)
    if (Object.keys(e).length) return
    const settings: Record<string, ConnectionSettingValue> = {}
    for (const r of rows) if (r.key.trim()) settings[r.key.trim()] = parseValue(r.value)
    const base = {
      name: name.trim(),
      provider,
      model: model.trim(),
      base_url: baseUrl.trim() || null,
      settings,
      ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
    }
    try {
      if (connection) {
        await update.mutateAsync({ id: connection.id, ...base, ...(clearKey && !apiKey.trim() ? { clear_key: true } : {}) })
        toast.success(t('providers.toast.updated', { name: base.name }))
      } else {
        await create.mutateAsync({ ...base, capability: cap })
        toast.success(t('providers.toast.created', { name: base.name }))
      }
      onOpenChange(false)
    } catch (error) {
      const next: Record<string, string> = {}
      for (const f of ['name', 'provider', 'model', 'base_url', 'settings', 'capability']) {
        const m = fieldError(error, f)
        if (m) next[f] = m
      }
      setErrors(next)
      if (!Object.keys(next).length) setFormError(errorMessage(error))
    }
  }

  const setRow = (i: number, patch: Partial<SettingRow>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      locked={pending}
      title={editing ? t('providers.form.editTitle') : t('providers.form.createTitle')}
      description={t('providers.form.description')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('actions.cancel', { ns: 'common' })}
          </Button>
          <Button variant="primary" onClick={submit} loading={pending} className="min-w-28">
            {editing ? t('providers.form.save') : t('providers.form.create')}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(ev) => {
          ev.preventDefault()
          void submit()
        }}
        noValidate
      >
        <Field label={t('providers.form.name')} error={errors.name} className="sm:col-span-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t('providers.form.namePh')} autoFocus />
        </Field>

        <Field label={t('providers.form.capability')}>
          <Select
            value={cap}
            onValueChange={(v) => changeCapability(v as AiCapability)}
            disabled={editing}
            options={CAPABILITIES.map((c) => ({ value: c, label: t(`capabilityLong.${c}`) }))}
          />
        </Field>

        <Field label={t('providers.form.provider')} error={errors.provider}>
          <Select
            value={provider || undefined}
            onValueChange={changeProvider}
            placeholder={t('providers.form.providerPh')}
            options={providers.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Field>

        <Field label={t('providers.form.model')} error={errors.model} hint={knownModels.length ? undefined : t('providers.form.modelHint')}>
          {knownModels.length && !customModel ? (
            <Select
              value={model || undefined}
              onValueChange={(v) => {
                if (v === CUSTOM) {
                  setCustomModel(true)
                  setModel('')
                } else setModel(v)
              }}
              placeholder={t('providers.form.modelPh')}
              options={[
                ...knownModels.map((m) => ({ value: m, label: m })),
                { value: CUSTOM, label: t('providers.form.customModel') },
              ]}
            />
          ) : (
            <Input mono value={model} onChange={(e) => setModel(e.target.value)} placeholder="model-name" maxLength={80} />
          )}
        </Field>

        <Field label={t('providers.form.baseUrl')} error={errors.base_url} hint={entry?.default_base_url ? t('providers.form.baseUrlDefault', { url: entry.default_base_url }) : t('providers.form.baseUrlHint')}>
          <Input mono value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://" inputMode="url" />
        </Field>

        <div className="sm:col-span-2">
          <Field
            label={t('providers.form.apiKey')}
            hint={connection?.has_key ? t('providers.form.apiKeyStored', { hint: connection.key_hint ?? '••••' }) : t('providers.form.apiKeyHint')}
          >
            <Input
              type="password"
              mono
              autoComplete="new-password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value)
                if (e.target.value) setClearKey(false)
              }}
              placeholder={connection?.has_key ? '••••••••••••' : t('providers.form.apiKeyPh')}
            />
          </Field>
          {connection?.has_key ? (
            <div className="mt-2">
              <Checkbox
                checked={clearKey}
                onCheckedChange={(v) => {
                  setClearKey(v)
                  if (v) setApiKey('')
                }}
                label={t('providers.form.clearKey')}
              />
            </div>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium">{t('providers.form.settings')}</div>
              <p className="text-xs text-muted">{t('providers.form.settingsHint')}</p>
            </div>
            <Button type="button" size="sm" variant="secondary" icon={<Plus />} onClick={() => setRows((rs) => [...rs, { key: '', value: '' }])}>
              {t('providers.form.addSetting')}
            </Button>
          </div>
          {rows.length ? (
            <ul className="mt-2 space-y-2">
              {rows.map((r, i) => (
                <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                  <Input mono size="sm" aria-label={t('providers.form.settingKey')} placeholder="temperature" value={r.key} onChange={(e) => setRow(i, { key: e.target.value })} />
                  <Input mono size="sm" aria-label={t('providers.form.settingValue')} placeholder="0.2" value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} />
                  <IconButton label={t('providers.form.removeSetting')} icon={<Trash2 />} size="sm" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-ctl border border-dashed border-line px-3 py-2 text-[13px] text-muted">{t('providers.form.noSettings')}</p>
          )}
          {errors.settings ? (
            <p role="alert" className="mt-1.5 text-xs text-danger">
              {errors.settings}
            </p>
          ) : null}
        </div>

        {formError ? (
          <p role="alert" className="text-[13px] text-danger sm:col-span-2">
            {formError}
          </p>
        ) : null}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  )
}
