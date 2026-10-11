import { useEffect, useId, useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import {
  AudioLines,
  Archive,
  CalendarClock,
  ChevronDown,
  Cloud,
  Database,
  FolderTree,
  HardDrive,
  Hash,
  Headset,
  Mic,
  PhoneForwarded,
  PlugZap,
  Server,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react'

import { Banner, Button, Card, Checkbox, Field, IconButton, Input, Select, StatusChip, Switch, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { fieldErrors } from '@/api/client'
import { fmtDateTime } from '@/lib/format'
import { useLang } from '@/shell/state'
import { UNCHANGED_SECRET, type ConnectionKey, type ConnectionTestResult, type ServiceConfig } from '@/types'
import { useSaveConnection, useTestConnection } from '../api'
import {
  DEF_BY_KEY,
  isVisible,
  validateConnection,
  withDefaults,
  type ConnectionDef,
  type ConnectionValue,
  type FieldDef,
  type FieldValue,
} from '../schema'

const ICONS: Record<ConnectionKey, LucideIcon> = {
  directory: FolderTree,
  edge_api: Cloud,
  core_admin_api: Server,
  transfer_detection: PhoneForwarded,
  voice_archive: Archive,
  edge_recordings_a: Mic,
  edge_recordings_b: AudioLines,
  backup_target_a: HardDrive,
  backup_target_b: HardDrive,
  backup_schedule: CalendarClock,
  extension_provisioning: Hash,
  contact_centre: Headset,
  record_mirror: Database,
}

/** Text inputs that stay half width on wide screens. */
const SHORT = new Set(['username', 'clientId', 'host', 'secondaryHost', 'rangeFrom', 'rangeTo', 'runAt', 'timeZone', 'defaultContext', 'database'])

interface Draft {
  enabled: boolean
  value: ConnectionValue
}

const fromConfig = (def: ConnectionDef, cfg: ServiceConfig): Draft => ({ enabled: cfg.enabled, value: withDefaults(def, cfg.value) })

const canon = (def: ConnectionDef, d: Draft): string =>
  JSON.stringify([d.enabled, def.fields.map((f) => [f.name, f.kind === 'checkbox' ? d.value[f.name] === true : String(d.value[f.name] ?? '')])])

/** Numbers are typed as text in the inputs; send real numbers. */
function toPayload(def: ConnectionDef, value: ConnectionValue): ConnectionValue {
  const out: ConnectionValue = { ...value }
  for (const f of def.fields) {
    if (f.kind === 'number' && out[f.name] !== '' && out[f.name] !== undefined) out[f.name] = Number(out[f.name])
  }
  return out
}

/* ------------------------------------------------------------- field copy */

function useFieldCopy(t: TFunction, key: ConnectionKey) {
  return {
    label: (name: string) => t([`connections.fields.${key}.${name}.label`, `connections.fields.${name}.label`], { defaultValue: name }),
    hint: (name: string) => t([`connections.fields.${key}.${name}.hint`, `connections.fields.${name}.hint`], { defaultValue: '' }),
    error: (code?: string) => {
      if (!code) return undefined
      const [kind, min, max] = code.split(':')
      return t(`connections.validation.${kind}`, { min, max, defaultValue: code })
    },
  }
}

/** The readable line for a test result (the mock API answers with a short code). */
function describeTest(t: TFunction, result: ConnectionTestResult, labelOf: (name: string) => string): string {
  const [code = '', ...rest] = result.message.split(':')
  const arg = rest.join(':')
  switch (code) {
    case 'ok':
      return t('connections.test.ok', { target: arg })
    case 'missing':
      return t('connections.test.missing', { fields: arg.split(',').map(labelOf).join(', ') })
    case 'invalid':
      return t('connections.test.invalid', { fields: arg.split(',').map(labelOf).join(', ') })
    case 'auth_failed':
      return t('connections.test.authFailed', { who: arg })
    default:
      return result.message
  }
}

/* ------------------------------------------------------------- field input */

interface FieldInputProps {
  field: FieldDef
  draft: Draft
  stored: boolean
  error?: string
  copy: ReturnType<typeof useFieldCopy>
  onChange: (name: string, value: FieldValue) => void
}

function FieldInput({ field, draft, stored, error, copy, onChange }: FieldInputProps) {
  const { t } = useTranslation('access')
  const uid = useId()
  const id = `${uid}-${field.name}`
  const value = draft.value[field.name]
  const label = copy.label(field.name)
  const hint = copy.hint(field.name)

  if (field.kind === 'checkbox') {
    return (
      <div className="sm:col-span-2">
        <Checkbox checked={value === true} onCheckedChange={(b) => onChange(field.name, b === true)} label={label} />
        {hint && <p className="mt-1 pl-6 text-[12.5px] text-muted">{hint}</p>}
      </div>
    )
  }

  let control: React.ReactNode
  if (field.kind === 'select') {
    control = (
      <Select
        id={id}
        value={String(value ?? '')}
        onValueChange={(v: string) => onChange(field.name, v)}
        options={(field.options ?? []).map((o) => ({ value: o, label: t(`connections.options.${o}`, { defaultValue: o }) }))}
        invalid={!!error}
      />
    )
  } else if (field.kind === 'password') {
    const kept = value === UNCHANGED_SECRET
    control = (
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="password"
          autoComplete="new-password"
          mono
          invalid={!!error}
          value={kept ? '' : String(value ?? '')}
          placeholder={kept ? '••••••••  ' + t('connections.secretKept') : t('connections.secretEmpty')}
          onChange={(e) => onChange(field.name, e.target.value)}
        />
        {stored &&
          (kept ? (
            <IconButton label={t('connections.secretClear')} icon={X} variant="ghost" onClick={() => onChange(field.name, '')} />
          ) : (
            <IconButton label={t('connections.secretKeep')} icon={Undo2} variant="ghost" onClick={() => onChange(field.name, UNCHANGED_SECRET)} />
          ))}
      </div>
    )
  } else if (field.kind === 'number') {
    control = (
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        mono
        min={field.min}
        max={field.max}
        invalid={!!error}
        value={String(value ?? '')}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
    )
  } else {
    control = (
      <Input
        id={id}
        mono={field.mono}
        invalid={!!error}
        value={String(value ?? '')}
        placeholder={field.example}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => onChange(field.name, e.target.value)}
      />
    )
  }

  const wide = field.kind === 'text' && !SHORT.has(field.name)
  return (
    <div className={cn(wide && 'sm:col-span-2')}>
      <Field label={label} hint={hint || undefined} error={error} required={field.required && draft.enabled} htmlFor={id}>
        {control}
      </Field>
    </div>
  )
}

/* -------------------------------------------------------------------- card */

export interface ConnectionCardProps {
  config: ServiceConfig
  open: boolean
  onToggle: () => void
}

export function ConnectionCard({ config, open, onToggle }: ConnectionCardProps) {
  const { t } = useTranslation('access')
  const lang = useLang()
  const def = DEF_BY_KEY[config.key]
  const bodyId = useId()
  const copy = useFieldCopy(t, config.key)

  const [draft, setDraft] = useState<Draft>(() => fromConfig(def, config))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useSaveConnection()
  const test = useTestConnection()

  // The draft follows the server whenever the stored record changes (after Save, after a demo reset).
  useEffect(() => {
    setDraft(fromConfig(def, config))
    setErrors({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.updatedAt])

  const baseline = useMemo(() => canon(def, fromConfig(def, config)), [def, config])
  const dirty = canon(def, draft) !== baseline
  const storedSecrets = useMemo(() => new Set(def.fields.filter((f) => config.value[f.name] === UNCHANGED_SECRET).map((f) => f.name)), [def, config])
  const configuredNow = config.configured
  const Icon = ICONS[config.key]

  const edit = (name: string, v: FieldValue) => {
    setDraft((d) => ({ ...d, value: { ...d.value, [name]: v } }))
    setErrors((e) => {
      if (!e[name]) return e
      const { [name]: _drop, ...rest } = e
      return rest
    })
    if (test.data || test.isError) test.reset()
  }

  const onSave = () => {
    const problems = validateConnection(def, draft.enabled, draft.value)
    setErrors(problems)
    if (Object.keys(problems).length > 0) {
      if (!open) onToggle()
      return
    }
    save.mutate(
      { key: config.key, enabled: draft.enabled, value: toPayload(def, draft.value) },
      {
        onSuccess: () => {
          test.reset()
          toast.success(t('card.saved', { name: t(`connections.items.${config.key}.title`) }))
        },
        onError: (err) => setErrors(fieldErrors(err)),
      },
    )
  }

  const onTest = () => {
    const problems = validateConnection(def, true, draft.value)
    setErrors(problems)
    if (Object.keys(problems).length > 0) return
    test.mutate({ key: config.key, value: toPayload(def, draft.value) })
  }

  const result = test.data
  const title = t(`connections.items.${config.key}.title`)

  return (
    <Card className={cn(dirty && 'border-primary/50')}>
      <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-[8px] text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <Icon size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-snug text-ink">{title}</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-muted">{t(`connections.items.${config.key}.description`)}</span>
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              {configuredNow ? (
                <StatusChip tone="success" size="sm">
                  {t('card.configured')}
                </StatusChip>
              ) : (
                <StatusChip tone="neutral" size="sm">
                  {t('card.notConfigured')}
                </StatusChip>
              )}
              {dirty && (
                <StatusChip tone="warning" size="sm">
                  {t('card.unsaved')}
                </StatusChip>
              )}
            </span>
          </span>
          <ChevronDown
            size={18}
            strokeWidth={1.75}
            className={cn('mt-0.5 shrink-0 text-muted transition-transform duration-[160ms]', open && 'rotate-180')}
            aria-hidden
          />
        </button>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <span className="hidden text-sm text-ink sm:inline" aria-hidden>
            {draft.enabled ? t('card.enabled') : t('card.disabled')}
          </span>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(b) => setDraft((d) => ({ ...d, enabled: b }))}
            aria-label={t('card.enabledAria', { name: title })}
          />
        </div>
      </div>

      {open && (
        <div id={bodyId} className="border-t border-line px-4 py-4 sm:px-5">
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            {def.fields
              .filter((f) => isVisible(f, draft.value))
              .map((f) => (
                <FieldInput
                  key={f.name}
                  field={f}
                  draft={draft}
                  stored={storedSecrets.has(f.name)}
                  error={copy.error(errors[f.name])}
                  copy={copy}
                  onChange={edit}
                />
              ))}
          </div>

          {save.isError && Object.keys(errors).length === 0 && (
            <Banner tone="danger" className="mt-4">
              {save.error instanceof Error ? save.error.message : t('card.saveError')}
            </Banner>
          )}

          {(test.isPending || result || test.isError) && (
            <div className="mt-4" aria-live="polite">
              {test.isPending ? (
                <StatusChip tone="info" size="md" icon={PlugZap}>
                  {t('card.testing')}
                </StatusChip>
              ) : result?.ok ? (
                <Banner tone="success" title={t('card.testSuccess', { ms: result.latencyMs })}>
                  {describeTest(t, result, copy.label)}
                </Banner>
              ) : result ? (
                <Banner tone="danger" title={t('card.testFailed')}>
                  {describeTest(t, result, copy.label)}
                </Banner>
              ) : (
                <Banner tone="danger" title={t('card.testFailed')}>
                  {test.error instanceof Error ? test.error.message : t('card.saveError')}
                </Banner>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <p className="text-[12.5px] text-muted">{t('card.updated', { time: fmtDateTime(config.updatedAt, lang) })}</p>
            <div className="flex flex-wrap items-center gap-2">
              {dirty && (
                <Button
                  variant="ghost"
                  icon={Undo2}
                  onClick={() => {
                    setDraft(fromConfig(def, config))
                    setErrors({})
                    test.reset()
                  }}
                  disabled={save.isPending}
                >
                  {t('card.revert')}
                </Button>
              )}
              <Button icon={PlugZap} onClick={onTest} loading={test.isPending} disabled={save.isPending}>
                {t('card.test')}
              </Button>
              <Button variant="primary" onClick={onSave} loading={save.isPending} disabled={!dirty || test.isPending}>
                {save.isPending ? t('card.saving') : t('card.save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

