/**
 * Field schema for the 13 integration connections. Pure data and pure functions
 * (no React): the Connections cards render from it and the mock handler validates
 * and normalises with the same code, so both sides always agree.
 *
 * Labels and hints live in the `access` namespace:
 *   connections.fields.<connection>.<field>.label  (falls back to connections.fields.<field>.label)
 */
import { UNCHANGED_SECRET, type ConnectionKey, type ConnectionSection } from '@/types'

export type FieldKind = 'text' | 'password' | 'number' | 'checkbox' | 'select'
export type FieldValue = string | number | boolean

export interface FieldDef {
  name: string
  kind: FieldKind
  required?: boolean
  mono?: boolean
  min?: number
  max?: number
  /** `select` option values; labels are `connections.options.<value>`. */
  options?: readonly string[]
  default?: FieldValue
  /** Only shown (and validated) while another field has this value. */
  showWhen?: { field: string; equals: FieldValue }
  /** Literal example shown as the input placeholder (hostnames, paths: not translated). */
  example?: string
}

export interface ConnectionDef {
  key: ConnectionKey
  section: ConnectionSection
  fields: readonly FieldDef[]
}

export const SECTIONS: readonly ConnectionSection[] = ['core', 'recordings', 'extensions', 'contact_centre', 'record_store']

/** Fields whose name says "secret": masked by the API as `__UNCHANGED__`. */
const SECRET_NAME = /password|secret|apikey|community|token/i
export const isSecretName = (name: string): boolean => SECRET_NAME.test(name)

const text = (name: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, kind: 'text', ...extra })
const secret = (name: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, kind: 'password', mono: true, ...extra })
const num = (name: string, min: number, max: number, extra: Partial<FieldDef> = {}): FieldDef => ({
  name,
  kind: 'number',
  min,
  max,
  mono: true,
  ...extra,
})
const check = (name: string, def: boolean): FieldDef => ({ name, kind: 'checkbox', default: def })
const select = (name: string, options: readonly string[], def: string, extra: Partial<FieldDef> = {}): FieldDef => ({
  name,
  kind: 'select',
  options,
  default: def,
  ...extra,
})

export const CONNECTION_DEFS: readonly ConnectionDef[] = [
  /* ------------------------------------------------------------------ core */
  {
    key: 'directory',
    section: 'core',
    fields: [
      text('url', { required: true, mono: true, example: 'ldaps://directory.example:636' }),
      text('baseDn', { required: true, mono: true, example: 'DC=example,DC=org' }),
      text('bindDn', { required: true, mono: true }),
      secret('bindPassword', { required: true }),
      text('userFilter', { mono: true, default: '(sAMAccountName={username})' }),
      text('groupSearchBase', { mono: true }),
    ],
  },
  {
    key: 'edge_api',
    section: 'core',
    fields: [
      text('baseUrl', { required: true, mono: true, example: 'https://edge-pbx.example/api' }),
      text('clientId', { required: true, mono: true }),
      secret('clientSecret', { required: true }),
      num('timeoutSec', 1, 120, { default: 15 }),
    ],
  },
  {
    key: 'core_admin_api',
    section: 'core',
    fields: [
      text('host', { required: true, mono: true, example: 'core-node.example' }),
      num('port', 1, 65535, { required: true, default: 8443 }),
      text('username', { required: true, mono: true }),
      secret('password', { required: true }),
      check('verifyTls', true),
      text('dropPath', { mono: true, default: '/var/drop/core-records', example: '/var/drop/core-records' }),
    ],
  },
  {
    key: 'transfer_detection',
    section: 'core',
    fields: [
      text('operatorDevicePattern', { required: true, mono: true, default: '^Agent' }),
      num('mergeWindowMinutes', 1, 1440, { required: true, default: 60 }),
      text('huntPilots', { mono: true, example: '2000,2001' }),
    ],
  },
  /* ------------------------------------------------------------ recordings */
  {
    key: 'voice_archive',
    section: 'recordings',
    fields: [
      text('host', { required: true, mono: true }),
      text('share', { required: true, mono: true }),
      text('username', { required: true, mono: true }),
      secret('password', { required: true }),
      select('format', ['opus', 'wav', 'mp3'], 'opus'),
    ],
  },
  {
    key: 'edge_recordings_a',
    section: 'recordings',
    fields: [
      text('host', { required: true, mono: true }),
      text('path', { required: true, mono: true, default: '/recordings' }),
      text('username', { required: true, mono: true }),
      secret('password', { required: true }),
      select('format', ['wav', 'mp3'], 'wav'),
    ],
  },
  {
    key: 'edge_recordings_b',
    section: 'recordings',
    fields: [
      text('host', { required: true, mono: true }),
      text('path', { required: true, mono: true, default: '/recordings' }),
      text('username', { required: true, mono: true }),
      secret('password', { required: true }),
      select('format', ['wav', 'mp3'], 'wav'),
    ],
  },
  {
    key: 'backup_target_a',
    section: 'recordings',
    fields: [
      text('share', { required: true, mono: true }),
      text('username', { required: true, mono: true }),
      secret('password', { required: true }),
      num('retentionDays', 30, 36500, { required: true, default: 2555 }),
    ],
  },
  {
    key: 'backup_target_b',
    section: 'recordings',
    fields: [
      text('share', { required: true, mono: true }),
      text('username', { required: true, mono: true }),
      secret('password', { required: true }),
      num('retentionDays', 30, 36500, { required: true, default: 1825 }),
    ],
  },
  {
    key: 'backup_schedule',
    section: 'recordings',
    fields: [
      select('frequency', ['daily', 'weekly'], 'daily'),
      select('weekday', ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], 'sun', { showWhen: { field: 'frequency', equals: 'weekly' } }),
      text('runAt', { required: true, mono: true, default: '02:00', example: '02:00' }),
      text('timeZone', { required: true, mono: true, default: 'Asia/Tbilisi' }),
      num('retryDays', 0, 14, { required: true, default: 3 }),
      num('parallelCopies', 1, 16, { required: true, default: 4 }),
    ],
  },
  /* ------------------------------------------------------------ extensions */
  {
    key: 'extension_provisioning',
    section: 'extensions',
    fields: [
      text('rangeFrom', { required: true, mono: true, default: '5000' }),
      text('rangeTo', { required: true, mono: true, default: '5999' }),
      text('reserved', { mono: true, example: '5000,5100' }),
      num('lockMinutes', 1, 60, { required: true, default: 10 }),
      text('defaultContext', { mono: true, default: 'internal' }),
      text('namePattern', { mono: true, default: '{site} {ext}', example: '{site} {ext}' }),
      check('bulkImport', true),
    ],
  },
  /* -------------------------------------------------------- contact centre */
  {
    key: 'contact_centre',
    section: 'contact_centre',
    fields: [
      text('host', { mono: true, example: 'cc-node.example' }),
      text('baseUrl', { required: true, mono: true, example: 'https://cc-node.example:8445/admin' }),
      text('username', { required: true, mono: true }),
      secret('password', { required: true }),
      secret('snmpCommunity'),
      num('pollSeconds', 5, 600, { required: true, default: 30 }),
      text('secondaryHost', { mono: true, default: '', example: 'cc-node-b.example' }),
      num('maxDedicatedPorts', 1, 50, { required: true, default: 10 }),
    ],
  },
  /* ----------------------------------------------------------- record store */
  {
    key: 'record_mirror',
    section: 'record_store',
    fields: [
      text('host', { required: true, mono: true }),
      num('port', 1, 65535, { required: true, default: 5432 }),
      text('database', { required: true, mono: true }),
      text('username', { required: true, mono: true }),
      secret('password', { required: true }),
      num('syncIntervalMin', 1, 1440, { required: true, default: 5 }),
    ],
  },
]

export const DEF_BY_KEY: Record<ConnectionKey, ConnectionDef> = Object.fromEntries(
  CONNECTION_DEFS.map((d) => [d.key, d]),
) as Record<ConnectionKey, ConnectionDef>

/* ----------------------------------------------------------------- values */

export type ConnectionValue = Record<string, FieldValue>

export function defaultFor(field: FieldDef): FieldValue {
  if (field.default !== undefined) return field.default
  return field.kind === 'checkbox' ? false : ''
}

/** Stored (or wire) value with schema defaults filled in for anything missing. */
export function withDefaults(def: ConnectionDef, value: Record<string, FieldValue | undefined>): ConnectionValue {
  const out: ConnectionValue = {}
  for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = v
  for (const f of def.fields) if (out[f.name] === undefined) out[f.name] = defaultFor(f)
  return out
}

export function isVisible(field: FieldDef, value: ConnectionValue): boolean {
  return !field.showWhen || value[field.showWhen.field] === field.showWhen.equals
}

const isFilled = (field: FieldDef, v: FieldValue | undefined): boolean => {
  if (v === undefined || v === null) return false
  if (field.kind === 'checkbox') return true
  if (field.kind === 'number') return v !== '' && Number.isFinite(Number(v))
  return String(v).trim() !== ''
}

/** Every required (visible) field has a value. A masked secret counts as present. */
export function isConfigured(def: ConnectionDef, value: ConnectionValue): boolean {
  return def.fields.every((f) => !f.required || !isVisible(f, value) || isFilled(f, value[f.name]))
}

/**
 * Validation codes per field (`required`, `number`, `integer`, `range:<min>:<max>`,
 * `url`, `ldapUrl`, `time`, `regex`, `order`). The UI maps a code to `connections.validation.*`.
 * `required` only applies while the connection is enabled, so a disabled card can be saved half-filled.
 */
export function validateConnection(def: ConnectionDef, enabled: boolean, value: ConnectionValue): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const f of def.fields) {
    if (!isVisible(f, value)) continue
    const v = value[f.name]
    if (!isFilled(f, v)) {
      if (f.required && enabled) errors[f.name] = 'required'
      continue
    }
    if (f.kind === 'number') {
      const n = Number(v)
      if (!Number.isInteger(n)) errors[f.name] = 'integer'
      else if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) errors[f.name] = `range:${f.min}:${f.max}`
      continue
    }
    if (f.kind === 'select' && f.options && !f.options.includes(String(v))) {
      errors[f.name] = 'required'
      continue
    }
    if (f.kind !== 'text') continue
    const s = String(v).trim()
    if (f.name === 'baseUrl' && !/^https?:\/\/\S+$/i.test(s)) errors[f.name] = 'url'
    else if (f.name === 'url' && !/^ldaps?:\/\/\S+$/i.test(s)) errors[f.name] = 'ldapUrl'
    else if (f.name === 'runAt' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) errors[f.name] = 'time'
    else if (f.name === 'operatorDevicePattern') {
      try {
        new RegExp(s)
      } catch {
        errors[f.name] = 'regex'
      }
    } else if ((f.name === 'rangeFrom' || f.name === 'rangeTo') && !/^\d{2,6}$/.test(s)) errors[f.name] = 'digits'
  }
  if (def.key === 'extension_provisioning' && !errors.rangeFrom && !errors.rangeTo) {
    if (Number(value.rangeFrom) > Number(value.rangeTo)) errors.rangeTo = 'order'
  }
  return errors
}

export { UNCHANGED_SECRET }
