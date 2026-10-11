/**
 * Mock handlers for the `console-platform` group: the operator console
 * (workspaces and their users, server health, registered users, tier and
 * anonymous limits, retention, voices). Every route is operator-only.
 * Field errors are short codes (`slug_taken`, `required`, ...) that the UI maps
 * to translated copy. OWNED BY: console-platform.
 */
import { conflict, DemoApiError, notFound } from '@portfolio/demo-kit'

import { RANGE_SPEC, sampleAt, seriesFor, tenantLoads } from '@/features/console-platform/sim/health'
import { INDUSTRIES, SLUG_PATTERN } from '@/features/console-platform/types'
import type { ConsoleSummary, HealthOverview } from '@/features/console-platform/types'
import type { DemoDb, HealthRange, Id, LimitsConfig, Tenant, TenantUser } from '@/types'
import { DEFAULT_TENANT_ID } from '../accounts'
import { getActingTenantId, setActingTenantId } from '../context'
import { api, store } from '../core'
import { actorName, requireOperator } from '../guards'

/* ------------------------------------------------------------------ helpers */

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomString(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

const newApiKey = (): string => `snj_live_${randomString(32)}`
const newPassword = (): string => `${randomString(4)}-${randomString(4)}-${randomString(4)}`
const keyHint = (key: string): string => `snj_live_...${key.slice(-4)}`

const db = (): DemoDb => store.data
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value)

function fail(errors: Record<string, string>): never {
  throw DemoApiError.validation(errors)
}

function tenantOr404(id: string): Tenant {
  const tenant = db().tenants.find((t) => t.id === id)
  if (!tenant) throw notFound('tenant_not_found')
  return tenant
}

function refreshCounts(): void {
  for (const tenant of db().tenants) {
    tenant.users = db().tenantUsers.filter((u) => u.client_id === tenant.id).length
    tenant.documents = db().kbDocuments.filter((d) => d.client_id === tenant.id).length
  }
}

function runningJobs(): number {
  return db().recordings.filter((r) => r.running.length > 0 || r.status === 'transcribing' || r.status === 'analyzing').length
}

/* ----------------------------------------------------------------- settings */

api.register('GET', '/admin/settings', (): ConsoleSummary => {
  requireOperator()
  const { settings, tenants, tenantUsers, appUsers } = db()
  return {
    tenants: tenants.length,
    active_tenants: tenants.filter((t) => t.is_active).length,
    tenant_users: tenantUsers.length,
    registered_users: appUsers.length,
    retention_days: settings.retention_days,
    voices: settings.voices,
    health: settings.health,
    public_sentiment: settings.public_sentiment,
  }
})

/* ------------------------------------------------------------------ tenants */

api.register('GET', '/admin/tenants', (): Tenant[] => {
  requireOperator()
  refreshCounts()
  return db().tenants
})

interface TenantBody {
  name?: unknown
  name_ka?: unknown
  slug?: unknown
  industry?: unknown
  region?: unknown
  is_active?: unknown
}

function validateTenant(body: TenantBody, current: Tenant | null) {
  const errors: Record<string, string> = {}
  const name = text(body.name)
  const nameKa = text(body.name_ka)
  const region = text(body.region)
  const industry = body.industry
  if (!name) errors.name = 'required'
  else if (name.length > 80) errors.name = 'too_long'
  if (!nameKa) errors.name_ka = 'required'
  else if (nameKa.length > 80) errors.name_ka = 'too_long'
  if (!region) errors.region = 'required'
  if (!INDUSTRIES.includes(industry as Tenant['industry'])) errors.industry = 'required'
  let slug = current?.slug ?? ''
  if (!current) {
    slug = text(body.slug).toLowerCase()
    if (!slug) errors.slug = 'required'
    else if (!SLUG_PATTERN.test(slug)) errors.slug = 'slug_pattern'
    else if (db().tenants.some((t) => t.slug === slug)) errors.slug = 'slug_taken'
  }
  if (Object.keys(errors).length) fail(errors)
  return { name, name_ka: nameKa, region, industry: industry as Tenant['industry'], slug }
}

api.register('POST', '/admin/tenants', ({ body }) => {
  requireOperator()
  const input = validateTenant((body ?? {}) as TenantBody, null)
  const apiKey = newApiKey()
  const tenant: Tenant = {
    id: `tn_${input.slug.replace(/-/g, '_')}`,
    slug: input.slug,
    name: input.name,
    name_ka: input.name_ka,
    industry: input.industry,
    region: input.region,
    is_active: true,
    api_key_hint: keyHint(apiKey),
    settings: { timezone: 'Asia/Tbilisi', default_language: 'ka' },
    created_at: new Date().toISOString(),
    users: 0,
    documents: 0,
  }
  if (db().tenants.some((t) => t.id === tenant.id)) tenant.id = store.nextId('tn_')
  db().tenants.push(tenant)
  store.notify()
  return { tenant, api_key: apiKey }
})

api.register('PATCH', '/admin/tenants/:id', ({ path, body }) => {
  requireOperator()
  const tenant = tenantOr404(path.id as string)
  const input = (body ?? {}) as TenantBody
  const hasProfile = ['name', 'name_ka', 'industry', 'region'].some((k) => k in input)
  if (hasProfile) {
    const next = validateTenant({ name: tenant.name, name_ka: tenant.name_ka, industry: tenant.industry, region: tenant.region, ...input }, tenant)
    Object.assign(tenant, { name: next.name, name_ka: next.name_ka, industry: next.industry, region: next.region })
  }
  if (typeof input.is_active === 'boolean') tenant.is_active = input.is_active
  store.notify()
  refreshCounts()
  return tenant
})

/** Collections whose rows carry a `client_id`; all of them go with a deleted workspace. */
const TENANT_OWNED = [
  'tenantUsers',
  'recordings',
  'summaries',
  'scoringConfigs',
  'kbDocuments',
  'kbChunks',
  'kbEvents',
  'reembedJobs',
  'curationProposals',
  'sentimentConfigs',
  'transcriptionConfigs',
  'aiAssignments',
  'aiByo',
  'aiLegacy',
  'botConfigs',
  'conversations',
  'llmUsage',
] as const

api.register('DELETE', '/admin/tenants/:id', ({ path, body }) => {
  requireOperator()
  const tenant = tenantOr404(path.id as string)
  const confirm = text((body as { confirm_slug?: unknown } | null)?.confirm_slug)
  if (confirm !== tenant.slug) fail({ confirm_slug: 'slug_mismatch' })
  const data = db() as unknown as Record<string, Array<{ client_id?: Id | null }>>
  for (const key of TENANT_OWNED) data[key] = (data[key] ?? []).filter((row) => row.client_id !== tenant.id)
  const goneConversations = new Set(db().conversations.map((c) => c.id))
  db().turns = db().turns.filter((turn) => goneConversations.has(turn.conversation_id))
  delete db().scoreBands[tenant.id]
  db().killState.disabled_clients = db().killState.disabled_clients.filter((id) => id !== tenant.id)
  for (const integration of db().integrations) integration.grants = integration.grants.filter((g) => g.client_id !== tenant.id)
  db().tenants = db().tenants.filter((t) => t.id !== tenant.id)
  if (getActingTenantId() === tenant.id) {
    const fallback = db().tenants.find((t) => t.id === DEFAULT_TENANT_ID) ?? db().tenants[0]
    setActingTenantId(fallback?.id ?? null)
  }
  store.notify()
  return { ok: true }
})

api.register('POST', '/admin/tenants/:id/rotate-key', ({ path }) => {
  requireOperator()
  const tenant = tenantOr404(path.id as string)
  const apiKey = newApiKey()
  tenant.api_key_hint = keyHint(apiKey)
  store.notify()
  return { tenant, api_key: apiKey }
})

/* ------------------------------------------------------------- tenant users */

api.register('GET', '/admin/tenants/:id/users', ({ path }): TenantUser[] => {
  requireOperator()
  const tenant = tenantOr404(path.id as string)
  return db().tenantUsers.filter((u) => u.client_id === tenant.id)
})

const USERNAME = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

api.register('POST', '/admin/tenants/:id/users', ({ path, body }) => {
  requireOperator()
  const tenant = tenantOr404(path.id as string)
  const input = (body ?? {}) as { username?: unknown; display_name?: unknown; role?: unknown; password?: unknown }
  const errors: Record<string, string> = {}
  const username = text(input.username).toLowerCase()
  const displayName = text(input.display_name)
  const password = text(input.password)
  if (!username) errors.username = 'required'
  else if (!USERNAME.test(username)) errors.username = 'email_invalid'
  else if (db().tenantUsers.some((u) => u.username.toLowerCase() === username)) errors.username = 'username_taken'
  if (!displayName) errors.display_name = 'required'
  if (input.role !== 'owner' && input.role !== 'member') errors.role = 'required'
  if (password && password.length < 8) errors.password = 'password_short'
  if (Object.keys(errors).length) fail(errors)
  const generated = password || newPassword()
  const user: TenantUser = {
    id: store.nextId('tu_'),
    client_id: tenant.id,
    username,
    display_name: displayName,
    role: input.role as TenantUser['role'],
    is_active: true,
    created_at: new Date().toISOString(),
    last_login_at: null,
  }
  db().tenantUsers.push(user)
  refreshCounts()
  store.notify()
  return { user, password: generated }
})

function userOr404(id: string): TenantUser {
  const user = db().tenantUsers.find((u) => u.id === id)
  if (!user) throw notFound('user_not_found')
  return user
}

/** A workspace always keeps at least one active owner. */
function wouldLoseLastOwner(user: TenantUser, next: { role?: TenantUser['role']; is_active?: boolean } | null): boolean {
  if (user.role !== 'owner' || !user.is_active) return false
  const stillOwner = next && (next.role ?? user.role) === 'owner' && (next.is_active ?? user.is_active)
  if (stillOwner) return false
  return !db().tenantUsers.some((u) => u.client_id === user.client_id && u.id !== user.id && u.role === 'owner' && u.is_active)
}

api.register('PATCH', '/admin/tenant-users/:id', ({ path, body }) => {
  requireOperator()
  const user = userOr404(path.id as string)
  const input = (body ?? {}) as { role?: unknown; is_active?: unknown; display_name?: unknown }
  const role = input.role === 'owner' || input.role === 'member' ? input.role : undefined
  const active = typeof input.is_active === 'boolean' ? input.is_active : undefined
  if (wouldLoseLastOwner(user, { role, is_active: active })) throw conflict('last_owner')
  if (role) user.role = role
  if (active !== undefined) user.is_active = active
  if (typeof input.display_name === 'string' && text(input.display_name)) user.display_name = text(input.display_name)
  store.notify()
  return user
})

api.register('DELETE', '/admin/tenant-users/:id', ({ path }) => {
  requireOperator()
  const user = userOr404(path.id as string)
  if (wouldLoseLastOwner(user, null)) throw conflict('last_owner')
  db().tenantUsers = db().tenantUsers.filter((u) => u.id !== user.id)
  refreshCounts()
  store.notify()
  return { ok: true }
})

api.register('POST', '/admin/tenant-users/:id/reset-password', ({ path }) => {
  requireOperator()
  userOr404(path.id as string)
  return { password: newPassword() }
})

/* ------------------------------------------------------------------- health */

const parseRange = (value: string | undefined): HealthRange => (value && value in RANGE_SPEC ? (value as HealthRange) : '1h')

api.register('GET', '/admin/health/overview', (): HealthOverview => {
  requireOperator()
  const now = Date.now()
  const ctx = { jobsNow: runningJobs() }
  return { sample: sampleAt(now, ctx, now), previous: sampleAt(now - 300_000, ctx, now), settings: db().settings.health }
})

api.register('GET', '/admin/health/series', ({ params }) => {
  requireOperator()
  return seriesFor(parseRange(params.range), { jobsNow: runningJobs() })
})

api.register('GET', '/admin/health/tenants', ({ params }) => {
  requireOperator()
  return tenantLoads(db(), parseRange(params.range))
})

api.register('PUT', '/admin/health/settings', ({ body }) => {
  requireOperator()
  const input = (body ?? {}) as { retention_days?: unknown; sample_interval_s?: unknown }
  const errors: Record<string, string> = {}
  if (!isInt(input.retention_days) || input.retention_days < 1 || input.retention_days > 365) errors.retention_days = 'range_1_365'
  if (!isInt(input.sample_interval_s) || input.sample_interval_s < 5 || input.sample_interval_s > 300) errors.sample_interval_s = 'range_5_300'
  if (Object.keys(errors).length) fail(errors)
  db().settings.health = { retention_days: input.retention_days as number, sample_interval_s: input.sample_interval_s as number }
  store.notify()
  return db().settings.health
})

/* ----------------------------------------------------------- registered users */

api.register('GET', '/admin/users', ({ params }) => {
  requireOperator()
  const q = (params.q ?? '').trim().toLowerCase()
  const rows = db().appUsers
  if (!q) return rows
  return rows.filter((u) => u.email.toLowerCase().includes(q) || u.display_name.toLowerCase().includes(q))
})

function appUserOr404(id: string) {
  const user = db().appUsers.find((u) => u.id === id)
  if (!user) throw notFound('user_not_found')
  return user
}

const LIMIT_KEYS = ['analyses', 'tts', 'conversions', 'max_audio_mb'] as const

api.register('PATCH', '/admin/users/:id', ({ path, body }) => {
  requireOperator()
  const user = appUserOr404(path.id as string)
  const input = (body ?? {}) as { is_active?: unknown; limits?: Record<string, unknown> }
  if (input.limits && typeof input.limits === 'object') {
    const errors: Record<string, string> = {}
    for (const key of LIMIT_KEYS) {
      const value = input.limits[key]
      if (value === undefined || value === null) continue
      const max = key === 'max_audio_mb' ? 500 : 10_000
      if (!isInt(value) || value < (key === 'max_audio_mb' ? 1 : 0) || value > max) errors[key] = key === 'max_audio_mb' ? 'range_1_500' : 'range_0_10000'
    }
    if (Object.keys(errors).length) fail(errors)
    const next = { ...user.limits }
    for (const key of LIMIT_KEYS) {
      if (!(key in input.limits)) continue
      const value = input.limits[key]
      if (value === null) delete next[key]
      else if (isInt(value)) next[key] = value
    }
    user.limits = next
  }
  if (typeof input.is_active === 'boolean') user.is_active = input.is_active
  store.notify()
  return user
})

api.register('DELETE', '/admin/users/:id', ({ path }) => {
  requireOperator()
  const user = appUserOr404(path.id as string)
  db().appUsers = db().appUsers.filter((u) => u.id !== user.id)
  delete db().quotaUsed[user.id]
  store.notify()
  return { ok: true }
})

api.register('POST', '/admin/users/:id/reset-password', ({ path }) => {
  requireOperator()
  appUserOr404(path.id as string)
  return { password: newPassword() }
})

/* ------------------------------------------------------------------- limits */

function cleanLimits(body: unknown): LimitsConfig {
  const input = (body ?? {}) as Partial<LimitsConfig> & { features?: Partial<LimitsConfig['features']> }
  const errors: Record<string, string> = {}
  const count = (key: 'max_analyses_per_day' | 'max_tts_per_day' | 'max_conversions_per_day') => {
    const value = input[key]
    if (!isInt(value) || value < 0 || value > 10_000) errors[key] = 'range_0_10000'
    return value as number
  }
  const analyses = count('max_analyses_per_day')
  const tts = count('max_tts_per_day')
  const conversions = count('max_conversions_per_day')
  if (!isInt(input.max_audio_mb) || input.max_audio_mb < 1 || input.max_audio_mb > 500) errors.max_audio_mb = 'range_1_500'
  if (Object.keys(errors).length) fail(errors)
  const f: Partial<LimitsConfig['features']> = input.features ?? {}
  return {
    enabled: Boolean(input.enabled),
    max_analyses_per_day: analyses,
    max_tts_per_day: tts,
    max_conversions_per_day: conversions,
    max_audio_mb: input.max_audio_mb as number,
    features: {
      analyze: Boolean(f.analyze),
      tts: Boolean(f.tts),
      convert: Boolean(f.convert),
      score: Boolean(f.score),
      semantic: Boolean(f.semantic),
      summarise: Boolean(f.summarise),
    },
  }
}

api.register('GET', '/admin/limits/registered', () => {
  requireOperator()
  return db().limits.registered
})

api.register('PUT', '/admin/limits/registered', ({ body }) => {
  requireOperator()
  db().limits.registered = cleanLimits(body)
  store.notify()
  return db().limits.registered
})

api.register('GET', '/admin/limits/anonymous', () => {
  requireOperator()
  return { limits: db().limits.anonymous, public_sentiment: db().settings.public_sentiment }
})

api.register('PUT', '/admin/limits/anonymous', ({ body }) => {
  requireOperator()
  const input = (body ?? {}) as { limits?: unknown; public_sentiment?: { enabled?: unknown; guidance?: unknown } }
  const limits = cleanLimits(input.limits)
  const guidance = typeof input.public_sentiment?.guidance === 'string' ? input.public_sentiment.guidance.trim() : ''
  if (guidance.length > 1000) fail({ guidance: 'too_long' })
  db().limits.anonymous = limits
  db().settings.public_sentiment = { enabled: Boolean(input.public_sentiment?.enabled), guidance }
  store.notify()
  return { limits: db().limits.anonymous, public_sentiment: db().settings.public_sentiment }
})

/* ------------------------------------------------------------------ storage */

api.register('GET', '/admin/storage', () => {
  requireOperator()
  return { retention_days: db().settings.retention_days }
})

api.register('PUT', '/admin/storage', ({ body }) => {
  requireOperator()
  const days = (body as { retention_days?: unknown } | null)?.retention_days
  if (!isInt(days) || days < 0 || days > 3650) fail({ retention_days: 'range_0_3650' })
  db().settings.retention_days = days as number
  store.notify()
  return { retention_days: db().settings.retention_days }
})

/* ------------------------------------------------------------------- voices */

const voicesPayload = () => ({
  mode: db().settings.voices.mode,
  voice_ids: db().settings.voices.voice_ids,
  voices: db().voices,
  languages: db().ttsLanguages,
})

api.register('GET', '/admin/voices', () => {
  requireOperator()
  return voicesPayload()
})

api.register('PUT', '/admin/voices', ({ body }) => {
  requireOperator()
  const input = (body ?? {}) as { mode?: unknown; voice_ids?: unknown }
  const mode = input.mode === 'all' ? 'all' : input.mode === 'allowlist' ? 'allowlist' : null
  if (!mode) fail({ mode: 'required' })
  const known = new Set(db().voices.map((v) => v.voice_id))
  const ids = Array.isArray(input.voice_ids) ? input.voice_ids.filter((id): id is string => typeof id === 'string' && known.has(id)) : []
  if (mode === 'allowlist' && ids.length === 0) fail({ voice_ids: 'at_least_one_voice' })
  db().settings.voices = { mode: mode as 'all' | 'allowlist', voice_ids: [...new Set(ids)] }
  store.notify()
  return voicesPayload()
})

void actorName
