/**
 * Super-admin console endpoints (owner: superadmin).
 *
 * Tenant lifecycle, staff of any tenant, channel feature flags, the platform
 * app settings, system health and the AI platform key. Every handler requires
 * the `superadmin` role and takes the tenant explicitly (`:id`).
 *
 * Error contract (same as admin-staff): the top-level message is a plain
 * English sentence; a machine code goes in `fieldErrors.code` (non-validation
 * errors) or is the message of a field error (validation); the UI translates.
 */
import { DemoApiError, notFound } from '@portfolio/demo-kit'

import type {
  ActivityAction,
  Admin,
  ChannelFeatures,
  ChatSession,
  ContentLang,
  Operator,
  PersonName,
  Supervisor,
  Tenant,
  TenantState,
} from '@/types'
import type {
  AiKeyResponse,
  AiTenantRef,
  CheckResult,
  HealthRange,
  HealthResponse,
  MemberRole,
  PlatformResponse,
} from '@/features/superadmin/types'

import { api } from '../api'
import { broadcast } from '../bus'
import { nowIso } from '../clock'
import { currentAccount, findTenant, requireRole } from '../context'
import { logActivity, requeueSession } from '../engine'
import { DEMO_PASSWORD, staffAccount } from '../seed'
import { buildAiLinks, buildIntegrations, buildSettings, buildWorkingHours } from '../seed/config'
import { accounts, addAccount, findAccount, removeAccount } from '../session'
import { fineSamples, liveSamples } from '../simulators/superadmin'
import { newId, store } from '../store'

/* ------------------------------------------------------------------ helpers */

function codeError(status: number, message: string, code: string): DemoApiError {
  return new DemoApiError(status, message, { code })
}

function stateOf(tenant: Tenant): TenantState {
  return tenant.deletedAt ? 'deleted' : tenant.disabled ? 'disabled' : 'active'
}

function countsOf(tenant: Tenant): Tenant['counts'] {
  const d = store.data
  const operators = d.operators.filter((row) => row.tenantId === tenant.id).length
  const admins = d.admins.filter((row) => row.tenantId === tenant.id).length
  const supervisors = d.supervisors.filter((row) => row.tenantId === tenant.id).length
  const hasRows = operators + admins + supervisors > 0
  return {
    operators: hasRows ? operators : tenant.counts.operators,
    admins: hasRows ? admins : tenant.counts.admins,
    supervisors: hasRows ? supervisors : tenant.counts.supervisors,
    customers: tenant.counts.customers > 0 ? tenant.counts.customers : d.customers.filter((row) => row.tenantId === tenant.id).length,
    sessions: tenant.counts.sessions > 0 ? tenant.counts.sessions : d.sessions.filter((row) => row.tenantId === tenant.id).length,
  }
}

function toRow(tenant: Tenant) {
  return { ...tenant, state: stateOf(tenant), counts: countsOf(tenant) }
}

function refreshCounts(tenant: Tenant): void {
  tenant.counts = { ...tenant.counts, operators: 0, admins: 0, supervisors: 0 }
  const d = store.data
  tenant.counts.operators = d.operators.filter((row) => row.tenantId === tenant.id).length
  tenant.counts.admins = d.admins.filter((row) => row.tenantId === tenant.id).length
  tenant.counts.supervisors = d.supervisors.filter((row) => row.tenantId === tenant.id).length
  broadcast('tenant:upsert', tenant)
}

function parseRole(raw: string): MemberRole {
  if (raw === 'admin' || raw === 'operator' || raw === 'supervisor') return raw
  throw notFound('Unknown role.')
}

const GEORGIAN_TO_LATIN: Record<string, string> = {
  ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 't', ი: 'i', კ: 'k', ლ: 'l', მ: 'm', ნ: 'n', ო: 'o', პ: 'p',
  ჟ: 'zh', რ: 'r', ს: 's', ტ: 't', უ: 'u', ფ: 'p', ქ: 'k', ღ: 'gh', ყ: 'q', შ: 'sh', ჩ: 'ch', ც: 'ts', ძ: 'dz', წ: 'ts',
  ჭ: 'ch', ხ: 'kh', ჯ: 'j', ჰ: 'h',
}
const LATIN_DIGRAPHS: Record<string, string> = { zh: 'ჟ', gh: 'ღ', sh: 'შ', ch: 'ჩ', ts: 'ც', dz: 'ძ', kh: 'ხ' }
const LATIN_TO_GEORGIAN: Record<string, string> = {
  a: 'ა', b: 'ბ', c: 'ც', d: 'დ', e: 'ე', f: 'ფ', g: 'გ', h: 'ჰ', i: 'ი', j: 'ჯ', k: 'კ', l: 'ლ', m: 'მ', n: 'ნ', o: 'ო', p: 'პ',
  q: 'ქ', r: 'რ', s: 'ს', t: 'თ', u: 'უ', v: 'ვ', w: 'ვ', x: 'ხ', y: 'ი', z: 'ზ',
}
const hasGeorgian = (value: string) => /[Ⴀ-ჿ]/.test(value)

function toLatin(value: string): string {
  const out = [...value].map((char) => GEORGIAN_TO_LATIN[char] ?? char).join('')
  return out.replace(/\b\p{L}/gu, (char) => char.toUpperCase())
}

function toGeorgian(value: string): string {
  const lower = value.toLowerCase()
  let out = ''
  for (let i = 0; i < lower.length; i += 1) {
    const pair = lower.slice(i, i + 2)
    const digraph = LATIN_DIGRAPHS[pair]
    if (digraph) {
      out += digraph
      i += 1
    } else out += LATIN_TO_GEORGIAN[lower[i] ?? ''] ?? lower[i] ?? ''
  }
  return out
}

function normaliseName(raw: unknown): PersonName | null {
  const input = (raw && typeof raw === 'object' ? raw : { en: typeof raw === 'string' ? raw : '' }) as { en?: unknown; ka?: unknown }
  let en = typeof input.en === 'string' ? input.en.trim().replace(/\s+/g, ' ') : ''
  let ka = typeof input.ka === 'string' ? input.ka.trim().replace(/\s+/g, ' ') : ''
  if (hasGeorgian(en) && !ka) {
    ka = en
    en = ''
  }
  if (en.length < 2 && ka.length < 2) return null
  if (en.length < 2) en = toLatin(ka)
  if (ka.length < 2) ka = toGeorgian(en)
  return { en, ka }
}

function slugify(name: string): string {
  const latin = [...name].map((char) => GEORGIAN_TO_LATIN[char] ?? char).join('')
  const slug = latin
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/g, '')
  return slug || 'tenant'
}

function randomCode(): string {
  return Math.random().toString(36).slice(2, 6).padEnd(4, '0')
}

const asRecord = (body: unknown): Record<string, unknown> => (body && typeof body === 'object' ? (body as Record<string, unknown>) : {})

function activity(action: ActivityAction, tenantId: string, targetId: string | null, targetLabel: string | null, metadata: Record<string, string | number | boolean | null> = {}): void {
  logActivity({ action, tenantId, targetId, targetLabel, metadata })
}

/* ---------------------------------------------------------------- overview */

api.register('GET', '/superadmin/overview', () => {
  requireRole('superadmin')
  const tenants = store.data.tenants
  let customers = 0
  let sessions = 0
  for (const tenant of tenants) {
    const counts = countsOf(tenant)
    customers += counts.customers
    sessions += counts.sessions
  }
  return {
    tenants: {
      total: tenants.length,
      active: tenants.filter((row) => stateOf(row) === 'active').length,
      disabled: tenants.filter((row) => stateOf(row) === 'disabled').length,
      deleted: tenants.filter((row) => stateOf(row) === 'deleted').length,
    },
    admins: store.data.admins.length,
    operators: store.data.operators.length,
    supervisors: store.data.supervisors.length,
    customers,
    sessions,
  }
})

/* ----------------------------------------------------------------- tenants */

api.register('GET', '/superadmin/tenants', ({ params }) => {
  requireRole('superadmin')
  const q = (params.q ?? '').trim().toLowerCase()
  const state = params.state ?? 'all'
  return store.data.tenants
    .filter((row) => (state === 'all' ? true : stateOf(row) === state))
    .filter((row) => !q || [row.slug, row.name.en, row.name.ka, row.name.ru ?? ''].some((field) => field.toLowerCase().includes(q)))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map(toRow)
})

api.register('POST', '/superadmin/tenants', ({ body }) => {
  requireRole('superadmin')
  const input = asRecord(body)
  const raw = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : ''
  if (raw.length < 2) throw DemoApiError.validation({ name: 'name_short' })
  if (raw.length > 60) throw DemoApiError.validation({ name: 'name_long' })
  const name = hasGeorgian(raw) ? { ka: raw, en: toLatin(raw) } : { ka: raw, en: raw }
  let slug = ''
  do slug = `${slugify(name.en)}-${randomCode()}`
  while (store.data.tenants.some((row) => row.slug === slug))
  const tenant: Tenant = {
    id: newId('ten_'),
    slug,
    name,
    industry: { en: 'New organization', ka: 'ახალი ორგანიზაცია' },
    allowedOrigins: [],
    disabled: false,
    disabledAt: null,
    deletedAt: null,
    createdAt: nowIso(),
    features: { facebook_messenger: true, instagram: true, whatsapp: true, telegram: false, tiktok: false },
    counts: { operators: 0, admins: 0, supervisors: 0, customers: 0, sessions: 0 },
  }
  store.data.tenants.push(tenant)
  const settings = buildSettings([tenant])[0]
  if (settings) {
    settings.aiBotEnabled = false
    store.data.settings.push(settings)
  }
  const hours = buildWorkingHours([tenant])[0]
  if (hours) store.data.workingHours.push(hours)
  const integrations = buildIntegrations([tenant])[0]
  if (integrations) store.data.integrations.push(integrations)
  const link = buildAiLinks([tenant])[0]
  if (link) {
    link.serverConfigured = store.data.platform.ai.source !== 'none'
    store.data.aiLinks.push(link)
  }
  broadcast('tenant:upsert', tenant)
  return toRow(tenant)
})

api.register('PATCH', '/superadmin/tenants/:id', ({ path, body }) => {
  requireRole('superadmin')
  const tenant = findTenant(path.id ?? '')
  const input = asRecord(body)
  if (input.name !== undefined) {
    const name = normaliseName(input.name)
    if (!name) throw DemoApiError.validation({ name: 'name_short' })
    tenant.name = { ...tenant.name, ka: name.ka, en: name.en }
  }
  if (input.allowedOrigins !== undefined) {
    if (!Array.isArray(input.allowedOrigins)) throw DemoApiError.validation({ allowedOrigins: 'origin_invalid' })
    const origins: string[] = []
    for (const item of input.allowedOrigins) {
      const text = typeof item === 'string' ? item.trim() : ''
      if (!text) continue
      let origin = ''
      try {
        const url = new URL(text)
        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('protocol')
        origin = url.origin
      } catch {
        throw DemoApiError.validation({ allowedOrigins: 'origin_invalid', value: text })
      }
      if (!origins.includes(origin)) origins.push(origin)
    }
    if (origins.length > 20) throw DemoApiError.validation({ allowedOrigins: 'origin_limit' })
    tenant.allowedOrigins = origins
  }
  broadcast('tenant:upsert', tenant)
  return toRow(tenant)
})

function lifecycle(id: string, from: TenantState[], apply: (tenant: Tenant) => void, code: string) {
  requireRole('superadmin')
  const tenant = findTenant(id)
  if (!from.includes(stateOf(tenant))) throw codeError(409, 'This tenant is not in a state where that action applies.', code)
  apply(tenant)
  broadcast('tenant:upsert', tenant)
  return toRow(tenant)
}

api.register('POST', '/superadmin/tenants/:id/disable', ({ path }) =>
  lifecycle(path.id ?? '', ['active'], (tenant) => {
    tenant.disabled = true
    tenant.disabledAt = nowIso()
  }, 'invalid_state'),
)

api.register('POST', '/superadmin/tenants/:id/enable', ({ path }) =>
  lifecycle(path.id ?? '', ['disabled'], (tenant) => {
    tenant.disabled = false
    tenant.disabledAt = null
  }, 'invalid_state'),
)

api.register('POST', '/superadmin/tenants/:id/delete', ({ path }) =>
  lifecycle(path.id ?? '', ['active', 'disabled'], (tenant) => {
    tenant.deletedAt = nowIso()
  }, 'invalid_state'),
)

api.register('POST', '/superadmin/tenants/:id/restore', ({ path }) =>
  lifecycle(path.id ?? '', ['deleted'], (tenant) => {
    tenant.deletedAt = null
    tenant.disabled = false
    tenant.disabledAt = null
  }, 'invalid_state'),
)

function purge<T>(rows: T[], drop: (row: T) => boolean): void {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]
    if (row !== undefined && drop(row)) rows.splice(index, 1)
  }
}

api.register('POST', '/superadmin/tenants/:id/erase', ({ path, body }) => {
  const caller = requireRole('superadmin')
  const tenant = findTenant(path.id ?? '')
  if (stateOf(tenant) !== 'deleted') throw codeError(409, 'Only a deleted tenant can be erased.', 'not_deleted')
  const password = typeof asRecord(body).password === 'string' ? (asRecord(body).password as string) : ''
  if (!password) throw DemoApiError.validation({ password: 'password_required' })
  if (password !== caller.password && password !== DEMO_PASSWORD) throw DemoApiError.validation({ password: 'password_wrong' })

  const d = store.data
  const staffIds = [...d.operators, ...d.admins, ...d.supervisors].filter((row) => row.tenantId === tenant.id).map((row) => row.id)
  if (staffIds.some((id) => findAccount(id)?.headline)) {
    throw codeError(409, 'This tenant powers the demo account switcher and cannot be erased. Create another one to try erasing.', 'cannot_erase_demo_tenant')
  }
  const sessionIds = new Set(d.sessions.filter((row) => row.tenantId === tenant.id).map((row) => row.id))
  for (const id of staffIds) removeAccount(id)
  const mine = (row: { tenantId: string }) => row.tenantId === tenant.id
  purge(d.operators, mine)
  purge(d.admins, mine)
  purge(d.supervisors, mine)
  purge(d.customers, mine)
  purge(d.sessions, mine)
  purge(d.messages, mine)
  purge(d.assignments, (row) => sessionIds.has(row.sessionId))
  purge(d.notes, mine)
  purge(d.feedback, mine)
  purge(d.customFields, mine)
  purge(d.quickReplies, mine)
  purge(d.bans, mine)
  purge(d.waTemplates, mine)
  purge(d.integrations, mine)
  purge(d.comments, mine)
  purge(d.staffConversations, mine)
  purge(d.staffMessages, mine)
  purge(d.activity, mine)
  purge(d.operatorAudit, mine)
  purge(d.copilotDrafts, mine)
  purge(d.copilotFeedback, (row) => sessionIds.has(row.sessionId))
  purge(d.aiLinks, mine)
  purge(d.settings, mine)
  purge(d.workingHours, mine)
  purge(d.tenants, (row) => row.id === tenant.id)
  return { id: tenant.id, erased: true }
})

/* ----------------------------------------------------------------- members */

type StaffRow = Admin | Operator | Supervisor

const NUMBER_KEY = { operator: 'operatorNumber', admin: 'adminNumber', supervisor: 'supervisorNumber' } as const
const LANGS: ContentLang[] = ['ka', 'en', 'ru']

function collection(role: MemberRole): StaffRow[] {
  if (role === 'operator') return store.data.operators
  if (role === 'admin') return store.data.admins
  return store.data.supervisors
}

function numberOf(role: MemberRole, row: StaffRow): string {
  return (row as unknown as Record<string, string>)[NUMBER_KEY[role]] ?? ''
}

function autoNumber(role: MemberRole, tenantId: string): string {
  const used = new Set(collection(role).filter((row) => row.tenantId === tenantId).map((row) => numberOf(role, row)))
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const candidate = String(1000 + Math.floor(Math.random() * 9000))
    if (!used.has(candidate)) return candidate
  }
  return String(Date.now() % 10000).padStart(4, '0')
}

interface ParsedMember {
  name: PersonName
  nickname: string
  email: string
  username: string
  password: string | null
  number: string
  isExternal: boolean
  language: ContentLang
}

function parseMember(role: MemberRole, tenantId: string, body: unknown, existing: StaffRow | null): ParsedMember {
  const input = asRecord(body)
  const errors: Record<string, string> = {}
  const has = (key: string) => input[key] !== undefined

  let name = existing?.name ?? { en: '', ka: '' }
  if (!existing || has('name')) {
    const parsed = normaliseName(input.name)
    if (!parsed) errors.name = 'name_short'
    else name = parsed
  }

  let nickname = existing?.nickname ?? ''
  if (!existing || has('nickname')) {
    nickname = typeof input.nickname === 'string' ? input.nickname.trim() : ''
    if (!nickname && name.en) nickname = name.en.split(' ')[0] ?? name.en
    if (nickname.length > 30) errors.nickname = 'nickname_long'
  }

  const taken = (predicate: (account: (typeof accounts)[number]) => boolean) => accounts.some((account) => account.id !== existing?.id && predicate(account))

  let email = existing?.email ?? ''
  if (!existing || has('email')) {
    email = typeof input.email === 'string' ? input.email.trim() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'email_invalid'
    else if (taken((account) => account.email.toLowerCase() === email.toLowerCase())) errors.email = 'email_taken'
  }

  let username = existing?.username ?? ''
  if (!existing || has('username')) {
    username = typeof input.username === 'string' ? input.username.trim() : ''
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) errors.username = 'username_invalid'
    else if (taken((account) => account.username.toLowerCase() === username.toLowerCase())) errors.username = 'username_taken'
  }

  let password: string | null = null
  if (!existing || (has('password') && input.password !== '')) {
    password = typeof input.password === 'string' ? input.password : ''
    if (password.length < 6) errors.password = 'password_short'
  }

  let number = existing ? numberOf(role, existing) : ''
  if (!existing || has('number')) {
    const raw = String(input.number ?? '').trim()
    if (raw === '') number = existing ? number : ''
    else if (!/^\d{3,4}$/.test(raw)) errors.number = 'number_invalid'
    else if (collection(role).some((row) => row.tenantId === tenantId && row.id !== existing?.id && numberOf(role, row) === raw)) errors.number = 'number_taken'
    else number = raw
  }

  let language: ContentLang = existing?.language ?? 'ka'
  if (has('language')) {
    if (!LANGS.includes(input.language as ContentLang)) errors.language = 'language_invalid'
    else language = input.language as ContentLang
  }
  const isExternal = has('isExternal') ? input.isExternal === true : (existing?.isExternal ?? false)

  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)
  if (!number) number = autoNumber(role, tenantId)
  return { name, nickname, email, username, password, number, isExternal, language }
}

function findMember(role: MemberRole, id: string): StaffRow {
  const row = collection(role).find((item) => item.id === id)
  if (!row) throw notFound('Member not found.')
  return row
}

api.register('GET', '/superadmin/tenants/:id/members', ({ path }) => {
  requireRole('superadmin')
  const tenant = findTenant(path.id ?? '')
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((row) => row.tenantId === tenant.id)
  return { admins: mine(store.data.admins), operators: mine(store.data.operators), supervisors: mine(store.data.supervisors) }
})

api.register('POST', '/superadmin/tenants/:id/members', ({ path, body }) => {
  requireRole('superadmin')
  const tenant = findTenant(path.id ?? '')
  if (stateOf(tenant) === 'deleted') throw codeError(409, 'This tenant is deleted. Restore it first.', 'tenant_deleted')
  const input = asRecord(body)
  const roleRaw = typeof input.role === 'string' ? input.role : ''
  if (roleRaw !== 'admin' && roleRaw !== 'operator' && roleRaw !== 'supervisor') throw DemoApiError.validation({ role: 'role_invalid' })
  const role: MemberRole = roleRaw
  const parsed = parseMember(role, tenant.id, input, null)
  const now = nowIso()
  const base = {
    tenantId: tenant.id,
    name: parsed.name,
    nickname: parsed.nickname,
    username: parsed.username,
    email: parsed.email,
    isExternal: parsed.isExternal,
    language: parsed.language,
    createdAt: now,
  }
  let record: StaffRow
  if (role === 'operator') {
    const operator: Operator = {
      ...base,
      id: newId('op_'),
      operatorNumber: parsed.number,
      avatarId: null,
      avatarUrl: null,
      status: 'offline',
      pausedAt: null,
      pausedBy: null,
      activeChatCount: 0,
      pushEnabled: false,
      lastSeen: now,
    }
    store.data.operators.push(operator)
    record = operator
    broadcast('operator:upsert', operator)
  } else if (role === 'admin') {
    const admin: Admin = { ...base, id: newId('adm_'), adminNumber: parsed.number, operatorId: null }
    store.data.admins.push(admin)
    record = admin
  } else {
    const supervisor: Supervisor = { ...base, id: newId('sup_'), supervisorNumber: parsed.number }
    store.data.supervisors.push(supervisor)
    record = supervisor
  }
  const account = staffAccount(role, record, tenant.name.en)
  if (parsed.password) account.password = parsed.password
  addAccount(account)
  refreshCounts(tenant)
  const action = `admin_create_${role}` as ActivityAction
  activity(action, tenant.id, record.id, record.name.en, { number: parsed.number, external: parsed.isExternal })
  return record
})

api.register('PATCH', '/superadmin/members/:role/:id', ({ path, body }) => {
  requireRole('superadmin')
  const role = parseRole(path.role ?? '')
  const row = findMember(role, path.id ?? '')
  const parsed = parseMember(role, row.tenantId, body, row)
  row.name = parsed.name
  row.nickname = parsed.nickname
  row.email = parsed.email
  row.username = parsed.username
  row.isExternal = parsed.isExternal
  row.language = parsed.language
  ;(row as unknown as Record<string, string>)[NUMBER_KEY[role]] = parsed.number
  const account = findAccount(row.id)
  if (account) {
    account.name = row.name.en
    account.nameKa = row.name.ka
    account.email = row.email
    account.username = row.username
    if (parsed.password) account.password = parsed.password
  }
  if (role === 'operator') broadcast('operator:upsert', row as Operator)
  const tenant = store.data.tenants.find((item) => item.id === row.tenantId)
  if (tenant) broadcast('tenant:upsert', tenant)
  activity(`admin_update_${role}` as ActivityAction, row.tenantId, row.id, row.name.en)
  return row
})

api.register('DELETE', '/superadmin/members/:role/:id', ({ path }) => {
  requireRole('superadmin')
  const role = parseRole(path.role ?? '')
  const row = findMember(role, path.id ?? '')
  const account = findAccount(row.id)
  if (account?.headline) {
    throw codeError(409, 'This account powers the demo account switcher and cannot be removed. Create a new one to try deleting.', 'cannot_delete_demo_account')
  }
  if (role === 'operator') {
    const held: ChatSession[] = store.data.sessions.filter((item) => item.operatorId === row.id && (item.status === 'active' || item.status === 'inactive'))
    for (const session of held) {
      try {
        requeueSession(session.id, 'operator_removed', true)
      } catch (error) {
        console.error('[chiti] requeue on delete', error)
      }
    }
  }
  const rows = collection(role)
  const index = rows.findIndex((item) => item.id === row.id)
  if (index >= 0) rows.splice(index, 1)
  removeAccount(row.id)
  const tenant = store.data.tenants.find((item) => item.id === row.tenantId)
  if (tenant) refreshCounts(tenant)
  activity(`admin_delete_${role}` as ActivityAction, row.tenantId, row.id, row.name.en)
  return { id: row.id, deleted: true }
})

/* ---------------------------------------------------------------- features */

const FEATURE_KEYS: (keyof ChannelFeatures)[] = ['facebook_messenger', 'instagram', 'whatsapp', 'telegram', 'tiktok']

api.register('PATCH', '/superadmin/tenants/:id/features', ({ path, body }) => {
  requireRole('superadmin')
  const tenant = findTenant(path.id ?? '')
  if (stateOf(tenant) === 'deleted') throw codeError(409, 'This tenant is deleted. Restore it first.', 'tenant_deleted')
  const input = asRecord(body)
  const changed: Record<string, boolean> = {}
  for (const key of FEATURE_KEYS) {
    const value = input[key]
    if (typeof value === 'boolean' && tenant.features[key] !== value) {
      tenant.features = { ...tenant.features, [key]: value }
      changed[key] = value
    }
  }
  if (Object.keys(changed).length > 0) {
    activity('admin_update_settings', tenant.id, tenant.id, tenant.name.en, changed)
    broadcast('tenant:upsert', tenant)
  }
  return toRow(tenant)
})

/* -------------------------------------------------------------- staff chats */

api.register('GET', '/superadmin/tenants/:id/staff-chats', ({ path }) => {
  requireRole('superadmin')
  const tenant = findTenant(path.id ?? '')
  return store.data.staffConversations
    .filter((row) => row.tenantId === tenant.id)
    .sort((a, b) => Date.parse(b.lastMessageAt ?? '1970-01-01') - Date.parse(a.lastMessageAt ?? '1970-01-01'))
})

api.register('GET', '/superadmin/staff-chats/:conversationId/messages', ({ path }) => {
  requireRole('superadmin')
  const id = path.conversationId ?? ''
  if (!store.data.staffConversations.some((row) => row.id === id)) throw notFound('Conversation not found.')
  return store.data.staffMessages.filter((row) => row.conversationId === id).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
})

/* ------------------------------------------------------------ impersonation */

api.register('POST', '/superadmin/impersonate', ({ body }) => {
  requireRole('superadmin')
  const input = asRecord(body)
  const role = parseRole(typeof input.role === 'string' ? input.role : '')
  const memberId = typeof input.memberId === 'string' ? input.memberId : ''
  const row = findMember(role, memberId)
  const tenant = findTenant(row.tenantId)
  const state = stateOf(tenant)
  if (state === 'deleted') throw codeError(409, 'This tenant is deleted. Restore it first.', 'tenant_deleted')
  if (state === 'disabled') throw codeError(409, 'This tenant is disabled. Enable it first.', 'tenant_disabled')
  const account = findAccount(row.id)
  if (!account) throw notFound('This member has no sign-in account.')
  activity('admin_login', tenant.id, row.id, row.name.en, { impersonated: true, by: currentAccount()?.username ?? null })
  return { accountId: account.id, homeRoute: account.homeRoute }
})

/* ---------------------------------------------------------------- platform */

function maskId(value: string): string {
  const text = value.trim()
  if (text.includes('•')) return text
  if (text.length <= 8) return `${text.slice(0, 2)}••••`
  return `${text.slice(0, 4)}••••${text.slice(-4)}`
}

function platformView(): PlatformResponse {
  const settings = store.data.platform
  const registeredUrl = settings.tiktokWebhookRegisteredUrl
  return {
    settings,
    tenants: store.data.tenants.map((tenant) => ({ id: tenant.id, slug: tenant.slug, name: tenant.name, state: stateOf(tenant), features: tenant.features })),
    webhook: {
      expectedUrl: settings.tiktokWebhookExpectedUrl,
      registeredUrl,
      registeredAt: settings.tiktokWebhookRegisteredAt,
      inSync: registeredUrl !== null && registeredUrl === settings.tiktokWebhookExpectedUrl,
    },
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

api.register('GET', '/superadmin/platform', () => {
  requireRole('superadmin')
  return platformView()
})

api.register('PUT', '/superadmin/platform/meta', ({ body }) => {
  requireRole('superadmin')
  const input = asRecord(body)
  const errors: Record<string, string> = {}
  const settings = store.data.platform
  const str = (key: string) => (typeof input[key] === 'string' ? (input[key] as string).trim() : '')

  const appId = str('appId')
  if (!appId) errors.appId = 'required'
  const redirect = str('oauthRedirectBase').replace(/\/+$/, '')
  if (!redirect) errors.oauthRedirectBase = 'required'
  else if (!isHttpUrl(redirect)) errors.oauthRedirectBase = 'url_invalid'
  const secret = str('appSecret')
  if (secret && secret.length < 8) errors.appSecret = 'secret_short'
  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)

  settings.metaAppId = maskId(appId)
  settings.metaOAuthRedirectBase = redirect
  if (secret) {
    settings.hasMetaAppSecret = true
    settings.metaAppSecretPreview = `sec_••••${secret.slice(-4)}`
  }
  const login = str('loginConfigId')
  const whatsapp = str('whatsappConfigId')
  settings.metaLoginConfigId = login ? maskId(login) : null
  settings.metaWhatsappConfigId = whatsapp ? maskId(whatsapp) : null
  return platformView()
})

api.register('PUT', '/superadmin/platform/tiktok', ({ body }) => {
  requireRole('superadmin')
  const input = asRecord(body)
  const errors: Record<string, string> = {}
  const settings = store.data.platform
  const appId = typeof input.appId === 'string' ? input.appId.trim() : ''
  const secret = typeof input.appSecret === 'string' ? input.appSecret.trim() : ''
  if (!appId) errors.appId = 'required'
  if (secret && secret.length < 8) errors.appSecret = 'secret_short'
  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)
  settings.tiktokAppId = maskId(appId)
  if (secret) settings.tiktokAppSecretPreview = `tts_••••${secret.slice(-4)}`
  return platformView()
})

api.register('POST', '/superadmin/platform/test', ({ body }) => {
  requireRole('superadmin')
  const target = asRecord(body).target === 'tiktok' ? 'tiktok' : 'meta'
  const settings = store.data.platform
  const checks: CheckResult[] = []
  if (target === 'meta') {
    checks.push({ id: 'appId', ok: Boolean(settings.metaAppId) })
    checks.push({ id: 'appSecret', ok: settings.hasMetaAppSecret })
    checks.push({ id: 'redirect', ok: isHttpUrl(settings.metaOAuthRedirectBase) && settings.metaOAuthRedirectBase.startsWith('https://'), value: settings.metaOAuthRedirectBase })
    checks.push({ id: 'loginConfig', ok: Boolean(settings.metaLoginConfigId) })
    checks.push({ id: 'whatsappConfig', ok: Boolean(settings.metaWhatsappConfigId) })
    checks.push({ id: 'graph', ok: Boolean(settings.metaAppId) && settings.hasMetaAppSecret, value: 38 })
  } else {
    checks.push({ id: 'appId', ok: Boolean(settings.tiktokAppId) })
    checks.push({ id: 'appSecret', ok: Boolean(settings.tiktokAppSecretPreview) })
    checks.push({ id: 'webhookRegistered', ok: settings.tiktokWebhookRegisteredUrl !== null })
    checks.push({ id: 'webhookMatches', ok: settings.tiktokWebhookRegisteredUrl === settings.tiktokWebhookExpectedUrl })
  }
  return { ok: checks.every((check) => check.ok), checks }
})

api.register('POST', '/superadmin/platform/tiktok/register-webhook', () => {
  requireRole('superadmin')
  const settings = store.data.platform
  if (!settings.tiktokAppId || !settings.tiktokAppSecretPreview) throw codeError(409, 'Save the TikTok app id and secret first.', 'tiktok_not_configured')
  settings.tiktokWebhookRegisteredUrl = settings.tiktokWebhookExpectedUrl
  settings.tiktokWebhookRegisteredAt = nowIso()
  return platformView()
})

/* ------------------------------------------------------------------ health */

const RANGE_MS: Record<Exclude<HealthRange, 'live'>, number> = { '1h': 3_600_000, '24h': 86_400_000, '7d': 7 * 86_400_000 }

api.register('GET', '/superadmin/health', ({ params }) => {
  requireRole('superadmin')
  const range: HealthRange = params.range === '1h' || params.range === '24h' || params.range === '7d' ? params.range : 'live'
  const live = liveSamples()
  const current = live[live.length - 1]
  if (!current) throw new DemoApiError(503, 'No health data yet.')
  const now = Date.now()
  let samples = live
  if (range === '1h') samples = fineSamples().filter((row) => Date.parse(row.at) >= now - RANGE_MS['1h'])
  else if (range === '24h' || range === '7d') {
    const cutoff = now - RANGE_MS[range]
    samples = store.data.healthSamples.filter((row) => Date.parse(row.at) >= cutoff)
    const tail = fineSamples().filter((row) => Date.parse(row.at) > Date.parse(samples[samples.length - 1]?.at ?? '1970-01-01'))
    samples = [...samples, ...tail]
  }
  const response: HealthResponse = { range, samples: [...samples], current, retentionMonths: store.data.platform.systemHealthRetentionMonths }
  return response
})

api.register('PATCH', '/superadmin/health/retention', ({ body }) => {
  requireRole('superadmin')
  const months = Number(asRecord(body).months)
  if (!Number.isInteger(months) || months < 1 || months > 36) throw DemoApiError.validation({ months: 'months_invalid' })
  store.data.platform.systemHealthRetentionMonths = months
  return { retentionMonths: months }
})

/* ------------------------------------------------------------------ AI key */

function aiView(): AiKeyResponse {
  const ai = store.data.platform.ai
  const refs = (predicate: (link: (typeof store.data.aiLinks)[number]) => boolean): AiTenantRef[] =>
    store.data.aiLinks.filter(predicate).flatMap((link) => {
      const tenant = store.data.tenants.find((row) => row.id === link.tenantId)
      return tenant ? [{ id: tenant.id, slug: tenant.slug, name: tenant.name, aiClientId: link.aiClientId }] : []
    })
  return {
    source: ai.source,
    keyId: ai.keyId,
    keyPreview: ai.keyPreview,
    baseUrl: ai.baseUrl,
    suggestedBaseUrl: ai.suggestedBaseUrl,
    mappedTenants: refs((link) => link.aiClientId !== null),
    botEnabledTenants: refs((link) => link.aiBotEnabled),
  }
}

api.register('GET', '/superadmin/ai-key', () => {
  requireRole('superadmin')
  return aiView()
})

api.register('PUT', '/superadmin/ai-key', ({ body }) => {
  requireRole('superadmin')
  const input = asRecord(body)
  const ai = store.data.platform.ai
  const errors: Record<string, string> = {}
  const key = typeof input.key === 'string' ? input.key.trim() : ''
  let baseUrl = typeof input.baseUrl === 'string' ? input.baseUrl.trim().replace(/\/+$/, '') : ''
  if (!baseUrl) baseUrl = ai.suggestedBaseUrl
  if (!isHttpUrl(baseUrl)) errors.baseUrl = 'url_invalid'
  if (key) {
    if (key.length < 12 || /\s/.test(key)) errors.key = 'key_invalid'
  } else if (ai.source === 'none') errors.key = 'key_required'
  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)
  if (key) {
    let hash = 0
    for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
    ai.source = 'db'
    ai.keyId = `key_${hash.toString(16).padStart(8, '0').slice(0, 4)}`
    ai.keyPreview = `${key.slice(0, 4)}••••${key.slice(-4)}`
  }
  ai.baseUrl = baseUrl
  for (const link of store.data.aiLinks) link.serverConfigured = true
  return aiView()
})

api.register('POST', '/superadmin/ai-key/test', () => {
  requireRole('superadmin')
  const ai = store.data.platform.ai
  const checks: CheckResult[] = []
  if (ai.source === 'none') {
    for (const id of ['health', 'config', 'autopilot', 'languages', 'scopes']) checks.push({ id, ok: false, value: 'no_key' })
    return { ok: false, checks }
  }
  const outageUntil = store.data.demo.aiOutageUntil
  const outage = outageUntil !== null && Date.parse(outageUntil) > Date.now()
  const mapped = store.data.aiLinks.filter((link) => link.aiClientId !== null).length
  checks.push({ id: 'health', ok: !outage, value: outage ? 'unreachable' : 142 })
  checks.push({ id: 'config', ok: true, value: ai.baseUrl })
  checks.push({ id: 'autopilot', ok: mapped > 0, value: mapped })
  checks.push({ id: 'languages', ok: true, value: 'ka, en, ru' })
  checks.push({ id: 'scopes', ok: true, value: 'chat, copilot, knowledge' })
  return { ok: checks.every((check) => check.ok), checks }
})

api.register('DELETE', '/superadmin/ai-key', () => {
  requireRole('superadmin')
  const ai = store.data.platform.ai
  if (ai.source === 'env') throw codeError(409, 'This key comes from the server environment and cannot be removed here.', 'env_key')
  ai.source = 'none'
  ai.keyId = null
  ai.keyPreview = null
  for (const link of store.data.aiLinks) link.serverConfigured = false
  return aiView()
})
