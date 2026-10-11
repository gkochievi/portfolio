/**
 * Staff management endpoints (owner: admin-staff).
 *
 * Operators (admin: full CRUD + live controls; supervisor: status controls
 * only), admins and supervisors (admin only). Every create/edit also
 * creates/updates the matching sign-in account, so a new staff member can
 * sign in with the shared demo password right away.
 *
 * Error contract: the top-level message is a plain English sentence; the
 * machine code goes in `fieldErrors.code` (non-validation errors) or is the
 * message of a field error (validation), and the UI translates it.
 */
import { DemoApiError, notFound } from '@portfolio/demo-kit'

import type { Admin, ContentLang, Operator, OperatorAuditLog, PersonName, Supervisor, Tenant } from '@/types'

import { api } from '../api'
import { broadcast } from '../bus'
import { nowIso } from '../clock'
import { currentTenantId, findTenant, requireRole } from '../context'
import { endSession, getOperator, logActivity, requeueSession, setOperatorStatus } from '../engine'
import { staffAccount } from '../seed'
import { accounts, addAccount, findAccount, removeAccount } from '../session'
import { newId, store } from '../store'

type Kind = 'operator' | 'admin' | 'supervisor'
type Staff = Operator | Admin | Supervisor
type Scalar = string | number | boolean | null

const NUMBER_KEY = { operator: 'operatorNumber', admin: 'adminNumber', supervisor: 'supervisorNumber' } as const
const ID_PREFIX = { operator: 'op_', admin: 'adm_', supervisor: 'sup_' } as const
const LANGS: ContentLang[] = ['ka', 'en', 'ru']

/* ------------------------------------------------------------------ helpers */

function codeError(status: number, message: string, code: string): DemoApiError {
  return new DemoApiError(status, message, { code })
}

function collection(kind: Kind): Staff[] {
  if (kind === 'operator') return store.data.operators
  if (kind === 'admin') return store.data.admins
  return store.data.supervisors
}

function numberOf(kind: Kind, row: Staff): string {
  return (row as unknown as Record<string, string>)[NUMBER_KEY[kind]] ?? ''
}

function findStaff(kind: Kind, id: string, tenantId: string): Staff {
  const row = collection(kind).find((item) => item.id === id && item.tenantId === tenantId)
  if (!row) throw notFound(`${kind[0]!.toUpperCase()}${kind.slice(1)} not found.`)
  return row
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
    if (LATIN_DIGRAPHS[pair]) {
      out += LATIN_DIGRAPHS[pair]
      i += 1
    } else out += LATIN_TO_GEORGIAN[lower[i]!] ?? lower[i]
  }
  return out
}

/** Both scripts from whatever the form sent; the missing one is transliterated. */
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

function autoNumber(kind: Kind, tenantId: string): string {
  const used = new Set(collection(kind).filter((row) => row.tenantId === tenantId).map((row) => numberOf(kind, row)))
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const candidate = String(1000 + Math.floor(Math.random() * 9000))
    if (!used.has(candidate)) return candidate
  }
  for (let n = 100; n < 1000; n += 1) if (!used.has(String(n))) return String(n)
  return String(Date.now() % 10000).padStart(4, '0')
}

interface Parsed {
  name: PersonName
  nickname: string
  email: string
  username: string
  number: string
  language: ContentLang
  isExternal: boolean
  password: string | null
  avatarId: string | null
  avatarUrl: string | null
  touched: { avatar: boolean }
}

/** Validate a create (existing = null) or a partial edit and return the merged values. */
function parse(kind: Kind, tenantId: string, body: unknown, existing: Staff | null): Parsed {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
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

  const takenBy = (predicate: (account: (typeof accounts)[number]) => boolean) =>
    accounts.some((account) => account.id !== existing?.id && predicate(account))

  let email = existing?.email ?? ''
  if (!existing || has('email')) {
    email = typeof input.email === 'string' ? input.email.trim() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'email_invalid'
    else if (takenBy((account) => account.email.toLowerCase() === email.toLowerCase())) errors.email = 'email_taken'
  }

  let username = existing?.username ?? ''
  if (!existing || has('username')) {
    username = typeof input.username === 'string' ? input.username.trim() : ''
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) errors.username = 'username_invalid'
    else if (takenBy((account) => account.username.toLowerCase() === username.toLowerCase())) errors.username = 'username_taken'
  }

  let password: string | null = null
  if (!existing || (has('password') && input.password !== '')) {
    password = typeof input.password === 'string' ? input.password : ''
    if (password.length < 6) errors.password = 'password_short'
  }

  let number = existing ? numberOf(kind, existing) : ''
  if (!existing || has(NUMBER_KEY[kind]) || has('number')) {
    const raw = String(input[NUMBER_KEY[kind]] ?? input.number ?? '').trim()
    if (raw === '') number = ''
    else if (!/^\d{3,4}$/.test(raw)) errors.number = 'number_invalid'
    else if (collection(kind).some((row) => row.tenantId === tenantId && row.id !== existing?.id && numberOf(kind, row) === raw)) errors.number = 'number_taken'
    else number = raw
  }

  let language: ContentLang = existing?.language ?? 'ka'
  if (has('language')) {
    if (!LANGS.includes(input.language as ContentLang)) errors.language = 'language_invalid'
    else language = input.language as ContentLang
  }

  const isExternal = has('isExternal') ? input.isExternal === true : (existing?.isExternal ?? false)

  const existingOperator = existing && kind === 'operator' ? (existing as Operator) : null
  const touchedAvatar = kind === 'operator' && (has('avatarId') || has('avatarUrl'))
  const avatarId = touchedAvatar && has('avatarId') ? ((input.avatarId as string | null) ?? null) : (existingOperator?.avatarId ?? null)
  const avatarUrl = touchedAvatar && has('avatarUrl') ? ((input.avatarUrl as string | null) ?? null) : (existingOperator?.avatarUrl ?? null)

  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)
  if (!number) number = autoNumber(kind, tenantId)
  return { name, nickname, email, username, number, language, isExternal, password, avatarId, avatarUrl, touched: { avatar: touchedAvatar } }
}

function refreshCounts(tenant: Tenant): void {
  tenant.counts = {
    ...tenant.counts,
    operators: store.data.operators.filter((row) => row.tenantId === tenant.id).length,
    admins: store.data.admins.filter((row) => row.tenantId === tenant.id).length,
    supervisors: store.data.supervisors.filter((row) => row.tenantId === tenant.id).length,
  }
  broadcast('tenant:upsert', tenant)
}

function audit(operator: Pick<Operator, 'id' | 'email'>, tenantId: string, action: OperatorAuditLog['action'], changes: OperatorAuditLog['changes']): void {
  const account = requireRole('admin')
  const row: OperatorAuditLog = {
    id: newId('oaud_'),
    tenantId,
    operatorId: operator.id,
    operatorEmail: operator.email,
    action,
    performedBy: account.name,
    changes,
    createdAt: nowIso(),
  }
  store.data.operatorAudit.unshift(row)
}

function syncAccount(kind: Kind, record: Staff, tenant: Tenant, password: string | null): void {
  const existing = findAccount(record.id)
  if (existing) {
    existing.name = record.name.en
    existing.nameKa = record.name.ka
    existing.email = record.email
    existing.username = record.username
    if (password) existing.password = password
    return
  }
  const account = staffAccount(kind, record, tenant.name.en)
  if (password) account.password = password
  addAccount(account)
}

function diff(before: Record<string, Scalar>, after: Record<string, Scalar>): OperatorAuditLog['changes'] {
  const changes: OperatorAuditLog['changes'] = {}
  for (const key of Object.keys(after)) if (before[key] !== after[key]) changes[key] = { from: before[key] ?? null, to: after[key] ?? null }
  return changes
}

function snapshot(kind: Kind, row: Staff): Record<string, Scalar> {
  const base: Record<string, Scalar> = {
    name: row.name.en,
    nameKa: row.name.ka,
    nickname: row.nickname,
    email: row.email,
    username: row.username,
    operatorNumber: numberOf(kind, row),
    language: row.language,
    isExternal: row.isExternal,
  }
  if (kind === 'operator') base.avatarId = (row as Operator).avatarId
  return base
}

function guardRemovable(row: Staff): void {
  const caller = requireRole('admin')
  if (caller.staffId === row.id) throw codeError(409, 'You cannot delete your own account.', 'cannot_delete_self')
  const account = findAccount(row.id)
  if (account?.headline) throw codeError(409, 'This account powers the demo account switcher and cannot be removed. Create a new one to try deleting.', 'cannot_delete_demo_account')
}

/* --------------------------------------------------------------- operators */

const STATUS_ORDER = { online: 0, away: 1, offline: 2 } as const

api.register('GET', '/admin/operators', ({ params }) => {
  requireRole('admin', 'supervisor')
  const tenantId = currentTenantId()
  const q = (params.q ?? '').trim().toLowerCase()
  const rows = store.data.operators.filter((row) => row.tenantId === tenantId)
  const matching = q
    ? rows.filter((row) =>
        [row.name.en, row.name.ka, row.nickname, row.email, row.username, row.operatorNumber, `#${row.operatorNumber}`].some((field) => field.toLowerCase().includes(q)),
      )
    : rows
  return [...matching].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.en.localeCompare(b.name.en))
})

api.register('POST', '/admin/operators', ({ body }) => {
  const caller = requireRole('admin')
  const tenantId = currentTenantId()
  const tenant = findTenant(tenantId)
  const parsed = parse('operator', tenantId, body, null)
  const now = nowIso()
  const operator: Operator = {
    id: newId('op_'),
    tenantId,
    name: parsed.name,
    nickname: parsed.nickname,
    username: parsed.username,
    email: parsed.email,
    operatorNumber: parsed.number,
    isExternal: parsed.isExternal,
    avatarId: parsed.avatarId,
    avatarUrl: parsed.avatarUrl,
    status: 'offline',
    pausedAt: null,
    pausedBy: null,
    activeChatCount: 0,
    language: parsed.language,
    pushEnabled: false,
    lastSeen: now,
    createdAt: now,
  }
  store.data.operators.push(operator)
  syncAccount('operator', operator, tenant, parsed.password)
  audit(operator, tenantId, 'created', {
    name: { from: null, to: operator.name.en },
    nickname: { from: null, to: operator.nickname },
    operatorNumber: { from: null, to: operator.operatorNumber },
    language: { from: null, to: operator.language },
    isExternal: { from: null, to: operator.isExternal },
  })
  logActivity({
    action: 'admin_create_operator',
    tenantId,
    actorId: caller.staffId,
    targetId: operator.id,
    targetLabel: operator.name.en,
    metadata: { number: operator.operatorNumber, language: operator.language, external: operator.isExternal },
  })
  refreshCounts(tenant)
  broadcast('operator:upsert', operator)
  return operator
})

api.register('PATCH', '/admin/operators/:id', ({ path, body }) => {
  const caller = requireRole('admin')
  const tenantId = currentTenantId()
  const tenant = findTenant(tenantId)
  const operator = findStaff('operator', path.id!, tenantId) as Operator
  const before = snapshot('operator', operator)
  const parsed = parse('operator', tenantId, body, operator)
  operator.name = parsed.name
  operator.nickname = parsed.nickname
  operator.email = parsed.email
  operator.username = parsed.username
  operator.operatorNumber = parsed.number
  operator.language = parsed.language
  operator.isExternal = parsed.isExternal
  if (parsed.touched.avatar) {
    operator.avatarId = parsed.avatarId
    operator.avatarUrl = parsed.avatarUrl
  }
  syncAccount('operator', operator, tenant, parsed.password)
  const changes = diff(before, snapshot('operator', operator))
  if (parsed.password) changes.password = { from: null, to: 'changed' }
  if (Object.keys(changes).length > 0) {
    audit(operator, tenantId, 'updated', changes)
    logActivity({
      action: 'admin_update_operator',
      tenantId,
      actorId: caller.staffId,
      targetId: operator.id,
      targetLabel: operator.name.en,
      metadata: { fields: Object.keys(changes).join(', ') },
    })
  }
  broadcast('operator:upsert', operator)
  return operator
})

api.register('DELETE', '/admin/operators/:id', ({ path }) => {
  const caller = requireRole('admin')
  const tenantId = currentTenantId()
  const tenant = findTenant(tenantId)
  const operator = findStaff('operator', path.id!, tenantId) as Operator
  guardRemovable(operator)

  // Take them off the roster first so auto-assign can never pick them again.
  operator.status = 'offline'
  operator.pausedAt = null
  operator.pausedBy = null
  const held = store.data.sessions.filter((row) => row.operatorId === operator.id && (row.status === 'active' || row.status === 'inactive'))
  for (const session of held) requeueSession(session.id, 'operator_removed', false)

  const index = store.data.operators.findIndex((row) => row.id === operator.id)
  if (index >= 0) store.data.operators.splice(index, 1)
  removeAccount(operator.id)
  audit(operator, tenantId, 'deleted', { name: { from: operator.name.en, to: null }, operatorNumber: { from: operator.operatorNumber, to: null } })
  logActivity({
    action: 'admin_delete_operator',
    tenantId,
    actorId: caller.staffId,
    targetId: operator.id,
    targetLabel: operator.name.en,
    metadata: { requeuedChats: held.length },
  })
  refreshCounts(tenant)
  broadcast('operator:force-logout', { operatorId: operator.id, by: caller.name })
  return { id: operator.id, requeued: held.length }
})

api.register('POST', '/admin/operators/:id/force-status', ({ path, body }) => {
  requireRole('admin', 'supervisor')
  const tenantId = currentTenantId()
  const operator = findStaff('operator', path.id!, tenantId) as Operator
  const paused = (body as { paused?: unknown } | null)?.paused
  if (typeof paused !== 'boolean') throw DemoApiError.validation({ paused: 'paused_required' })
  if (paused) {
    if (operator.status === 'offline') throw codeError(409, 'This operator is offline, so there is nothing to pause.', 'operator_offline')
    if (operator.status === 'away') return operator
    return setOperatorStatus(operator.id, 'away', 'admin')
  }
  if (operator.status === 'offline') throw codeError(409, 'This operator is offline.', 'operator_offline')
  if (operator.status === 'online') return operator
  return setOperatorStatus(operator.id, 'online', 'admin')
})

api.register('POST', '/admin/operators/:id/force-logout', ({ path }) => {
  const caller = requireRole('admin', 'supervisor')
  const tenantId = currentTenantId()
  const operator = findStaff('operator', path.id!, tenantId) as Operator
  if (operator.status === 'offline') throw codeError(409, 'This operator is already signed out.', 'operator_offline')
  operator.status = 'offline'
  operator.pausedAt = null
  operator.pausedBy = null
  operator.lastSeen = nowIso()
  broadcast('operator:upsert', operator)
  broadcast('operator:force-logout', { operatorId: operator.id, by: caller.name })
  logActivity({
    action: 'admin_force_operator_logout',
    tenantId,
    actorId: caller.staffId,
    targetId: operator.id,
    targetLabel: operator.name.en,
    metadata: { chats: operator.activeChatCount },
  })
  return operator
})

api.register('POST', '/admin/operators/:id/end-chats', ({ path }) => {
  const caller = requireRole('admin')
  const tenantId = currentTenantId()
  const operator = findStaff('operator', path.id!, tenantId) as Operator
  const held = store.data.sessions.filter((row) => row.operatorId === operator.id && (row.status === 'active' || row.status === 'inactive'))
  for (const session of held) endSession(session.id, 'admin', 'manual')
  if (held.length > 0) {
    logActivity({
      action: 'admin_end_operator_chats',
      tenantId,
      actorId: caller.staffId,
      targetId: operator.id,
      targetLabel: operator.name.en,
      metadata: { count: held.length },
    })
  }
  return { ended: held.length, operator: getOperator(operator.id) ?? operator }
})

api.register('GET', '/admin/operators/:id/audit', ({ path }) => {
  requireRole('admin')
  const tenantId = currentTenantId()
  const operator = findStaff('operator', path.id!, tenantId)
  return store.data.operatorAudit
    .filter((row) => row.operatorId === operator.id && row.tenantId === tenantId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
})

/* ------------------------------------------------- admins and supervisors */

function registerStaffKind(kind: 'admin' | 'supervisor'): void {
  const base = kind === 'admin' ? '/admin/admins' : '/admin/supervisors'
  const createAction = kind === 'admin' ? 'admin_create_admin' : 'admin_create_supervisor'
  const updateAction = kind === 'admin' ? 'admin_update_admin' : 'admin_update_supervisor'
  const deleteAction = kind === 'admin' ? 'admin_delete_admin' : 'admin_delete_supervisor'
  const numberKey = NUMBER_KEY[kind]

  api.register('GET', base, ({ params }) => {
    requireRole('admin')
    const tenantId = currentTenantId()
    const q = (params.q ?? '').trim().toLowerCase()
    const rows = collection(kind).filter((row) => row.tenantId === tenantId)
    const matching = q
      ? rows.filter((row) =>
          [row.name.en, row.name.ka, row.nickname, row.email, row.username, numberOf(kind, row), `#${numberOf(kind, row)}`].some((field) => field.toLowerCase().includes(q)),
        )
      : rows
    return [...matching].sort((a, b) => a.name.en.localeCompare(b.name.en))
  })

  api.register('POST', base, ({ body }) => {
    const caller = requireRole('admin')
    const tenantId = currentTenantId()
    const tenant = findTenant(tenantId)
    const parsed = parse(kind, tenantId, body, null)
    const common = {
      id: newId(ID_PREFIX[kind]),
      tenantId,
      name: parsed.name,
      nickname: parsed.nickname,
      username: parsed.username,
      email: parsed.email,
      isExternal: parsed.isExternal,
      language: parsed.language,
      createdAt: nowIso(),
    }
    const record: Admin | Supervisor =
      kind === 'admin'
        ? { ...common, adminNumber: parsed.number, operatorId: null }
        : { ...common, supervisorNumber: parsed.number }
    collection(kind).push(record)
    syncAccount(kind, record, tenant, parsed.password)
    logActivity({
      action: createAction,
      tenantId,
      actorId: caller.staffId,
      targetId: record.id,
      targetLabel: record.name.en,
      metadata: { number: parsed.number, language: parsed.language, external: parsed.isExternal },
    })
    refreshCounts(tenant)
    return record
  })

  api.register('PATCH', `${base}/:id`, ({ path, body }) => {
    const caller = requireRole('admin')
    const tenantId = currentTenantId()
    const tenant = findTenant(tenantId)
    const record = findStaff(kind, path.id!, tenantId)
    const before = snapshot(kind, record)
    const parsed = parse(kind, tenantId, body, record)
    record.name = parsed.name
    record.nickname = parsed.nickname
    record.email = parsed.email
    record.username = parsed.username
    ;(record as unknown as Record<string, string>)[numberKey] = parsed.number
    record.language = parsed.language
    record.isExternal = parsed.isExternal
    syncAccount(kind, record, tenant, parsed.password)
    const changes = diff(before, snapshot(kind, record))
    if (parsed.password) changes.password = { from: null, to: 'changed' }
    if (Object.keys(changes).length > 0) {
      logActivity({
        action: updateAction,
        tenantId,
        actorId: caller.staffId,
        targetId: record.id,
        targetLabel: record.name.en,
        metadata: { fields: Object.keys(changes).join(', ') },
      })
    }
    return record
  })

  api.register('DELETE', `${base}/:id`, ({ path }) => {
    const caller = requireRole('admin')
    const tenantId = currentTenantId()
    const tenant = findTenant(tenantId)
    const record = findStaff(kind, path.id!, tenantId)
    guardRemovable(record)
    const rows = collection(kind)
    const index = rows.findIndex((row) => row.id === record.id)
    if (index >= 0) rows.splice(index, 1)
    removeAccount(record.id)
    logActivity({ action: deleteAction, tenantId, actorId: caller.staffId, targetId: record.id, targetLabel: record.name.en, metadata: { number: numberOf(kind, record) } })
    refreshCounts(tenant)
    return { id: record.id }
  })
}

registerStaffKind('admin')
registerStaffKind('supervisor')
