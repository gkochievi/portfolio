/**
 * Mock API for the "access" feature group (PLAN section 6): the role x feature
 * permission matrix (feature `rbac`) and the integration connections (feature
 * `settings`). Import store/api/bus helpers from '../core' only.
 *
 * Connections: GET masks every secret field as UNCHANGED_SECRET; PUT merges the
 * submitted values over the stored ones and keeps any secret sent back unchanged.
 * The test endpoint is simulated: it validates the settings and answers after a
 * realistic delay. Its `message` is a short code (`ok:<target>`, `missing:<fields>`,
 * `invalid:<fields>`, `auth_failed:<user>@<host>`) that the page renders in the
 * visitor's language.
 */
import { DemoApiError, notFound } from '@portfolio/demo-kit'

import {
  DEF_BY_KEY,
  isConfigured,
  isSecretName,
  validateConnection,
  withDefaults,
  type ConnectionDef,
  type ConnectionValue,
  type FieldValue,
} from '@/features/access/schema'
import { FEATURES, defaultAllows, defaultsByRole, RBAC_ROLES, sanitizeOverrides } from '@/lib/rbac'
import {
  UNCHANGED_SECRET,
  type ConnectionKey,
  type ConnectionTestResult,
  type FeatureKey,
  type RbacMatrixResponse,
  type RbacOverrides,
  type ServiceConfig,
} from '@/types'
import { api, bus, jitter, nowIso, requireFeature, sleep, store } from '../core'

/* -------------------------------------------------------------------- rbac */

function matrix(actorRole: RbacMatrixResponse['yourRole']): RbacMatrixResponse {
  return {
    roles: [...RBAC_ROLES],
    features: FEATURES.map((f) => ({ ...f })),
    defaults: defaultsByRole(),
    overrides: structuredClone(store.data.rbacOverrides),
    yourRole: actorRole,
  }
}

/** Drop overrides that only repeat the default, and rows left empty. */
function pruneOverrides(overrides: RbacOverrides): RbacOverrides {
  const out: RbacOverrides = {}
  for (const role of RBAC_ROLES) {
    const row = overrides[role]
    if (!row) continue
    const kept: Partial<Record<FeatureKey, boolean>> = {}
    for (const [feature, value] of Object.entries(row) as [FeatureKey, boolean][]) {
      if (defaultAllows(role, feature) !== value) kept[feature] = value
    }
    if (Object.keys(kept).length > 0) out[role] = kept
  }
  return out
}

/* ------------------------------------------------------------- connections */

function defOf(key: string): ConnectionDef {
  const def = DEF_BY_KEY[key as ConnectionKey]
  if (!def) throw notFound('Unknown connection.')
  return def
}

function stored(key: string): ServiceConfig {
  const cfg = store.data.connections.find((c) => c.key === key)
  if (!cfg) throw notFound('Unknown connection.')
  return cfg
}

const CRON_DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** Stored value + schema defaults + values derived from other state (cron, host, port cap). */
function normalize(def: ConnectionDef, value: ServiceConfig['value']): ConnectionValue {
  const v = withDefaults(def, value)
  if (def.key === 'backup_schedule' && typeof value.cron === 'string') {
    const [m, h, , , dow] = value.cron.trim().split(/\s+/)
    if (value.frequency === undefined) v.frequency = dow && dow !== '*' ? 'weekly' : 'daily'
    if (value.runAt === undefined && m && h && /^\d+$/.test(m) && /^\d+$/.test(h)) v.runAt = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
    if (value.weekday === undefined && dow && /^\d$/.test(dow)) v.weekday = CRON_DOW[Number(dow) % 7] ?? 'sun'
  }
  if (def.key === 'contact_centre') {
    if (value.host === undefined && typeof value.baseUrl === 'string') {
      try {
        v.host = new URL(value.baseUrl).hostname
      } catch {
        /* keep the default */
      }
    }
    // The campaign port cap is the single source of truth for this field.
    v.maxDedicatedPorts = store.data.campaignSettings.maxDedicatedPortsNonSuperAdmin
  }
  return v
}

/** What the API returns: normalised, secrets masked, `configured` recomputed. */
function toWire(cfg: ServiceConfig): ServiceConfig {
  const def = defOf(cfg.key)
  const value = normalize(def, cfg.value)
  const masked: ConnectionValue = {}
  for (const [name, v] of Object.entries(value)) {
    masked[name] = isSecretName(name) ? (String(v) === '' ? '' : UNCHANGED_SECRET) : v
  }
  return {
    key: cfg.key,
    section: cfg.section,
    enabled: cfg.enabled,
    configured: isConfigured(def, value),
    value: masked,
    updatedAt: cfg.updatedAt,
  }
}

/** Coerce an incoming value to the field's type; secrets sent back unchanged keep the stored one. */
function merge(def: ConnectionDef, base: ConnectionValue, incoming: Record<string, unknown>): ConnectionValue {
  const out: ConnectionValue = { ...base }
  for (const f of def.fields) {
    if (!(f.name in incoming)) continue
    const raw = incoming[f.name]
    if (isSecretName(f.name)) {
      if (raw === UNCHANGED_SECRET) continue
      out[f.name] = typeof raw === 'string' ? raw : ''
    } else if (f.kind === 'number') {
      out[f.name] = raw === '' || raw === null || raw === undefined ? '' : Number(raw)
    } else if (f.kind === 'checkbox') {
      out[f.name] = raw === true
    } else {
      out[f.name] = typeof raw === 'string' ? raw.trim() : String(raw ?? '')
    }
  }
  return out
}

function cronFor(v: ConnectionValue): string {
  const [h = '02', m = '00'] = String(v.runAt).split(':')
  const dow = v.frequency === 'weekly' ? String(Math.max(0, CRON_DOW.indexOf(String(v.weekday)))) : '*'
  return `${Number(m)} ${Number(h)} * * ${dow}`
}

function targetOf(v: ConnectionValue): string {
  for (const k of ['host', 'url', 'baseUrl', 'share']) {
    const s = v[k]
    if (typeof s === 'string' && s) return s
  }
  return 'localhost'
}

export function register(): void {
  /* ---- rbac */
  api.register('GET', '/rbac', () => {
    const actor = requireFeature('rbac')
    return matrix(actor.role)
  })

  api.register('PUT', '/rbac', ({ body }) => {
    const actor = requireFeature('rbac')
    const input = (body ?? {}) as { overrides?: unknown }
    if (typeof input.overrides !== 'object' || input.overrides === null) {
      throw DemoApiError.validation({ overrides: 'Send the overrides object.' })
    }
    const clean = pruneOverrides(sanitizeOverrides(input.overrides, actor.role, store.data.rbacOverrides))
    store.data.rbacOverrides = clean
    bus.emit('rbac:changed')
    return matrix(actor.role)
  })

  /* ---- connections */
  api.register('GET', '/connections', () => {
    requireFeature('settings')
    return store.data.connections.map(toWire)
  })

  api.register('PUT', '/connections/:key', ({ path, body }) => {
    requireFeature('settings')
    const def = defOf(path.key ?? '')
    const cfg = stored(def.key)
    const input = (body ?? {}) as { enabled?: unknown; value?: Record<string, unknown> }
    if (typeof input.value !== 'object' || input.value === null) throw DemoApiError.validation({ value: 'Send the connection values.' })
    const enabled = input.enabled === undefined ? cfg.enabled : input.enabled === true

    const merged = merge(def, normalize(def, cfg.value), input.value)
    const errors = validateConnection(def, enabled, merged)
    if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)

    const next: ConnectionValue = { ...merged }
    if (def.key === 'backup_schedule') next.cron = cronFor(next)
    if (def.key === 'contact_centre') {
      store.data.campaignSettings.maxDedicatedPortsNonSuperAdmin = Number(next.maxDedicatedPorts)
    }
    cfg.value = next as Record<string, FieldValue>
    cfg.enabled = enabled
    cfg.configured = isConfigured(def, next)
    cfg.updatedAt = nowIso()
    return toWire(cfg)
  })

  api.register('POST', '/connections/:key/test', async ({ path, body }): Promise<ConnectionTestResult> => {
    requireFeature('settings')
    const def = defOf(path.key ?? '')
    const cfg = stored(def.key)
    // The page tests what is on screen, so an optional draft overrides the stored values.
    const draft = ((body ?? {}) as { value?: Record<string, unknown> }).value
    const value = draft && typeof draft === 'object' ? merge(def, normalize(def, cfg.value), draft) : normalize(def, cfg.value)

    await sleep(jitter(800, 2000))

    const missing = def.fields.filter((f) => f.required && !isConfigured({ ...def, fields: [f] }, value)).map((f) => f.name)
    if (missing.length > 0) return { ok: false, message: `missing:${missing.join(',')}`, latencyMs: 0 }
    const invalid = Object.keys(validateConnection(def, true, value))
    if (invalid.length > 0) return { ok: false, message: `invalid:${invalid.join(',')}`, latencyMs: 0 }

    // One link in the estate is genuinely unhappy until its password is replaced.
    if (def.key === 'edge_recordings_b' && value.password === 'demo-batumi-secret') {
      return { ok: false, message: `auth_failed:${String(value.username)}@${targetOf(value)}`, latencyMs: jitter(1400, 2100) }
    }
    const slow = def.key === 'directory' || def.key === 'voice_archive' || def.key.startsWith('backup_target')
    return { ok: true, message: `ok:${targetOf(value)}`, latencyMs: slow ? jitter(46, 168) : jitter(11, 92) }
  })
}
