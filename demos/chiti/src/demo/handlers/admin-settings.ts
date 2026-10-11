/**
 * Handlers for the admin-settings feature group (owner: admin-settings agent).
 *
 * Tenant settings, working hours, custom fields (the pre-chat form), quick
 * replies, ban rules, and the password-gated retention change + manual purge.
 * Admin only. Writes mutate `store.data`, broadcast the matching event so the
 * widget, the shell pill and the inbox refresh, and append an activity row.
 *
 * Error contract (same as admin-staff): validation errors carry a machine
 * code as the message of each field error (the UI translates them);
 * other errors put the code in `fieldErrors.code`.
 */
import { DemoApiError, notFound } from '@portfolio/demo-kit'

import type {
  ActivityAction,
  BannedClient,
  ContentLang,
  CustomField,
  CustomFieldType,
  DaySchedule,
  DistributionStrategy,
  LocalizedText,
  QuickReply,
  QuickReplyCategory,
  TenantSettings,
  ThemePreset,
  WorkingHours,
} from '@/types'

import { api } from '../api'
import { broadcast } from '../bus'
import { nowIso } from '../clock'
import { currentTenantId, requireRole, tenantSettings, tenantWorkingHours } from '../context'
import { autoAssign, logActivity, workingHoursStatus } from '../engine'
import { newId, store } from '../store'

/** The shared demo password (also what the retention change and purge ask for). */
const DEMO_PASSWORD = 'chiti-demo'

const THEMES: ThemePreset[] = ['canary', 'olive', 'clay', 'plum', 'moss', 'slate', 'night', 'paper']
const STRATEGIES: DistributionStrategy[] = ['ordered', 'round_robin', 'random', 'least_busy']
const FIELD_TYPES: CustomFieldType[] = ['text', 'number', 'email', 'phone', 'select']
const CATEGORIES: QuickReplyCategory[] = ['greetings', 'delivery', 'payment', 'closing']
const LANGS: ContentLang[] = ['ka', 'en', 'ru']

const MAX_FIELDS = 12
const MAX_OPTIONS = 20
const TBILISI_OFFSET = '+04:00'

type Scalar = string | number | boolean | null
type Raw = Record<string, unknown>

/* ------------------------------------------------------------------ helpers */

function codeError(status: number, message: string, code: string): DemoApiError {
  return new DemoApiError(status, message, { code })
}

function asRecord(body: unknown): Raw {
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Raw) : {}
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Remove matching rows from a store array in place; returns the removed rows. */
function removeWhere<T>(rows: T[], predicate: (row: T) => boolean): T[] {
  const removed: T[] = []
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (predicate(rows[i]!)) removed.unshift(...rows.splice(i, 1))
  }
  return removed
}

/** A ka/en/ru text from a request value; `required` languages must be non-empty. */
function localized(
  errors: Record<string, string>,
  field: string,
  value: unknown,
  required: ContentLang[],
  maxLength: number,
  fallback?: LocalizedText,
): LocalizedText {
  const input = asRecord(value)
  const out: LocalizedText = { ka: '', en: '' }
  for (const lang of LANGS) {
    const source = lang in input ? input[lang] : fallback?.[lang]
    const text = typeof source === 'string' ? source.trim() : ''
    if (text.length > maxLength) errors[field] = 'too_long'
    if (lang === 'ru') {
      if (text) out.ru = text
    } else {
      out[lang] = text
    }
  }
  for (const lang of required) {
    if (!(out[lang] ?? '')) {
      errors[`${field}.${lang}`] = 'required'
      errors[field] ??= 'required'
    }
  }
  return out
}

function integer(errors: Record<string, string>, field: string, value: unknown, min: number, max: number, fallback: number): number {
  if (value === undefined) return fallback
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n)) {
    errors[field] = 'integer'
    return fallback
  }
  if (n < min || n > max) {
    errors[field] = n < min ? 'too_small' : 'too_large'
    return fallback
  }
  return n
}

function bool(errors: Record<string, string>, field: string, value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') {
    errors[field] = 'boolean'
    return fallback
  }
  return value
}

function oneOf<T extends string>(errors: Record<string, string>, field: string, value: unknown, allowed: readonly T[], fallback: T): T {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    errors[field] = 'invalid'
    return fallback
  }
  return value as T
}

function fail(errors: Record<string, string>): void {
  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)
}

function log(action: ActivityAction, targetId: string | null, targetLabel: string | null, metadata: Record<string, Scalar> = {}): void {
  logActivity({ action, targetId, targetLabel, metadata })
}

/** Settings that the widget reads (custom fields, quick replies) refresh on settings:update. */
function pingSettings(tenantId: string): void {
  broadcast('settings:update', tenantSettings(tenantId))
}

/** 'yyyy-MM-dd' to the first / last millisecond of that day in Tbilisi. */
function dayBounds(from: string, to: string): { start: number; end: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null
  const start = Date.parse(`${from}T00:00:00.000${TBILISI_OFFSET}`)
  const end = Date.parse(`${to}T23:59:59.999${TBILISI_OFFSET}`)
  return Number.isNaN(start) || Number.isNaN(end) ? null : { start, end }
}

function requirePassword(value: unknown): void {
  if (str(value) !== DEMO_PASSWORD) throw codeError(400, 'The password is incorrect.', 'password_invalid')
}

/* ----------------------------------------------------------------- settings */

const SETTINGS_SCALARS = [
  'clientTheme', 'operatorTheme', 'adminTheme', 'operatorEnterDirectly', 'chatDistributionStrategy', 'operatorChatLimit',
  'typingTransparency', 'requestFeedback', 'messageNotesEnabled', 'clientIpEnabled', 'autoGreetingEnabled',
  'inactiveWarningMinutes', 'inactiveDisconnectMinutes', 'operatorResponseMinutes', 'operatorLogoutGraceMinutes', 'chatRetentionDays',
] as const

function parseSettings(body: unknown, current: TenantSettings): Partial<TenantSettings> {
  const input = asRecord(body)
  const errors: Record<string, string> = {}
  const next: Partial<TenantSettings> = {}

  if ('chatTitle' in input) next.chatTitle = localized(errors, 'chatTitle', input.chatTitle, ['ka', 'en'], 80, current.chatTitle)
  if ('autoGreeting' in input) next.autoGreeting = localized(errors, 'autoGreeting', input.autoGreeting, [], 500, current.autoGreeting)
  if ('bannedMessage' in input) next.bannedMessage = localized(errors, 'bannedMessage', input.bannedMessage, ['ka', 'en'], 300, current.bannedMessage)

  if ('clientTheme' in input) next.clientTheme = oneOf(errors, 'clientTheme', input.clientTheme, THEMES, current.clientTheme)
  if ('operatorTheme' in input) next.operatorTheme = oneOf(errors, 'operatorTheme', input.operatorTheme, THEMES, current.operatorTheme)
  if ('adminTheme' in input) next.adminTheme = oneOf(errors, 'adminTheme', input.adminTheme, THEMES, current.adminTheme)
  if ('chatDistributionStrategy' in input) {
    next.chatDistributionStrategy = oneOf(errors, 'chatDistributionStrategy', input.chatDistributionStrategy, STRATEGIES, current.chatDistributionStrategy)
  }

  for (const key of ['operatorEnterDirectly', 'typingTransparency', 'requestFeedback', 'messageNotesEnabled', 'clientIpEnabled', 'autoGreetingEnabled'] as const) {
    if (key in input) next[key] = bool(errors, key, input[key], current[key])
  }

  if ('operatorChatLimit' in input) next.operatorChatLimit = integer(errors, 'operatorChatLimit', input.operatorChatLimit, 0, 50, current.operatorChatLimit)
  if ('inactiveWarningMinutes' in input) next.inactiveWarningMinutes = integer(errors, 'inactiveWarningMinutes', input.inactiveWarningMinutes, 1, 120, current.inactiveWarningMinutes)
  if ('inactiveDisconnectMinutes' in input) next.inactiveDisconnectMinutes = integer(errors, 'inactiveDisconnectMinutes', input.inactiveDisconnectMinutes, 2, 240, current.inactiveDisconnectMinutes)
  if ('operatorResponseMinutes' in input) next.operatorResponseMinutes = integer(errors, 'operatorResponseMinutes', input.operatorResponseMinutes, 0, 120, current.operatorResponseMinutes)
  if ('operatorLogoutGraceMinutes' in input) next.operatorLogoutGraceMinutes = integer(errors, 'operatorLogoutGraceMinutes', input.operatorLogoutGraceMinutes, 0, 120, current.operatorLogoutGraceMinutes)
  if ('chatRetentionDays' in input) next.chatRetentionDays = integer(errors, 'chatRetentionDays', input.chatRetentionDays, 7, 3650, current.chatRetentionDays)

  const warn = next.inactiveWarningMinutes ?? current.inactiveWarningMinutes
  const close = next.inactiveDisconnectMinutes ?? current.inactiveDisconnectMinutes
  if (!errors.inactiveWarningMinutes && !errors.inactiveDisconnectMinutes && close <= warn) errors.inactiveDisconnectMinutes = 'after_warning'

  const greetingOn = next.autoGreetingEnabled ?? current.autoGreetingEnabled
  const greeting = next.autoGreeting ?? current.autoGreeting
  if (greetingOn && !greeting.ka.trim() && !greeting.en.trim()) errors['autoGreeting'] = 'required'

  fail(errors)
  return next
}

api.register('GET', '/admin/settings', () => {
  requireRole('admin')
  return structuredClone(tenantSettings(currentTenantId()))
})

api.register('PATCH', '/admin/settings', ({ body }) => {
  requireRole('admin')
  const tenantId = currentTenantId()
  const settings = tenantSettings(tenantId)
  const patch = parseSettings(body, settings)

  if (patch.chatRetentionDays !== undefined && patch.chatRetentionDays !== settings.chatRetentionDays) {
    requirePassword(asRecord(body).password)
  }

  const changed: string[] = []
  for (const key of Object.keys(patch) as (keyof TenantSettings)[]) {
    if (JSON.stringify(settings[key]) !== JSON.stringify(patch[key])) changed.push(key)
  }
  const wasAuto = settings.operatorEnterDirectly
  Object.assign(settings, patch)

  if (changed.length > 0) {
    const knownScalars: readonly string[] = SETTINGS_SCALARS
    const metadata: Record<string, Scalar> = { area: 'settings', changed: changed.join(', ') }
    for (const key of changed) {
      if (knownScalars.includes(key)) metadata[key] = settings[key as keyof TenantSettings] as Scalar
    }
    log('admin_update_settings', tenantId, null, metadata)
  }
  broadcast('settings:update', settings)
  // Turning auto-assign on is live: waiting chats move to operators right away.
  if (!wasAuto && settings.operatorEnterDirectly) autoAssign(tenantId)
  return structuredClone(settings)
})

api.register('POST', '/admin/verify-password', ({ body }) => {
  requireRole('admin')
  requirePassword(asRecord(body).password)
  return { ok: true }
})

api.register('POST', '/admin/purge', ({ body }) => {
  requireRole('admin')
  const tenantId = currentTenantId()
  const input = asRecord(body)
  const errors: Record<string, string> = {}
  const from = str(input.from)
  const to = str(input.to)
  const bounds = dayBounds(from, to)
  if (!from) errors.from = 'required'
  if (!to) errors.to = 'required'
  if (from && to && !bounds) errors.from = 'invalid'
  if (bounds && bounds.start > bounds.end) errors.to = 'before_from'
  fail(errors)
  requirePassword(input.password)

  const { start, end } = bounds!
  const doomed = new Set(
    store.data.sessions
      .filter((row) => {
        if (row.tenantId !== tenantId || row.status !== 'ended') return false
        const at = Date.parse(row.endedAt ?? row.lastActivity)
        return at >= start && at <= end
      })
      .map((row) => row.id),
  )

  // Summary-only transcripts are generated on read; count them from the session.
  let messages = 0
  let files = 0
  for (const session of store.data.sessions) {
    if (!doomed.has(session.id)) continue
    const stored = store.data.messages.filter((row) => row.sessionId === session.id)
    messages += Math.max(stored.length, session.messageCount)
    files += stored.filter((row) => row.file).length
  }

  const inDoomed = (row: { sessionId?: string }) => !!row.sessionId && doomed.has(row.sessionId)
  removeWhere(store.data.messages, inDoomed)
  removeWhere(store.data.assignments, inDoomed)
  removeWhere(store.data.notes, inDoomed)
  removeWhere(store.data.feedback, inDoomed)
  removeWhere(store.data.copilotDrafts, inDoomed)
  removeWhere(store.data.sessions, (row) => doomed.has(row.id))

  const result = { sessions: doomed.size, messages, files }
  log('admin_purge_sessions', tenantId, `${from} – ${to}`, { from, to, ...result })
  return result
})

/* ------------------------------------------------------------ working hours */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function parseHours(body: unknown, current: WorkingHours): Omit<WorkingHours, 'tenantId' | 'timezone'> {
  const input = asRecord(body)
  const errors: Record<string, string> = {}

  let weeklySchedule = current.weeklySchedule
  if ('weeklySchedule' in input) {
    const rows = Array.isArray(input.weeklySchedule) ? (input.weeklySchedule as unknown[]) : []
    const byDay = new Map<number, DaySchedule>()
    rows.forEach((raw, index) => {
      const row = asRecord(raw)
      const day = Number(row.day)
      if (!Number.isInteger(day) || day < 0 || day > 6) {
        errors[`weeklySchedule.${index}`] = 'invalid'
        return
      }
      const enabled = row.enabled === true
      const start = str(row.start)
      const end = str(row.end)
      if (enabled) {
        if (!TIME.test(start)) errors[`weeklySchedule.${index}.start`] = 'invalid_time'
        if (!TIME.test(end)) errors[`weeklySchedule.${index}.end`] = 'invalid_time'
        if (TIME.test(start) && TIME.test(end) && start >= end) errors[`weeklySchedule.${index}.end`] = 'after_start'
      }
      byDay.set(day, { day, enabled, start: TIME.test(start) ? start : '09:00', end: TIME.test(end) ? end : '18:00' })
    })
    if (byDay.size !== 7) errors.weeklySchedule = 'seven_days'
    weeklySchedule = [...byDay.values()].sort((a, b) => a.day - b.day)
  }

  const isTemporarilyClosed = bool(errors, 'isTemporarilyClosed', input.isTemporarilyClosed, current.isTemporarilyClosed)
  const time = (field: string, value: unknown, fallback: string | null): string | null => {
    if (value === undefined) return fallback
    if (value === null || value === '') return null
    const ms = typeof value === 'string' ? Date.parse(value) : NaN
    if (Number.isNaN(ms)) {
      errors[field] = 'invalid_date'
      return fallback
    }
    return new Date(ms).toISOString()
  }
  const temporaryClosedFrom = time('temporaryClosedFrom', input.temporaryClosedFrom, current.temporaryClosedFrom)
  const temporaryClosedUntil = time('temporaryClosedUntil', input.temporaryClosedUntil, current.temporaryClosedUntil)
  if (isTemporarilyClosed) {
    if (!temporaryClosedFrom && !errors.temporaryClosedFrom) errors.temporaryClosedFrom = 'required'
    if (!temporaryClosedUntil && !errors.temporaryClosedUntil) errors.temporaryClosedUntil = 'required'
    if (temporaryClosedFrom && temporaryClosedUntil && Date.parse(temporaryClosedUntil) <= Date.parse(temporaryClosedFrom)) {
      errors.temporaryClosedUntil = 'after_from'
    }
  }

  const temporaryClosedMessage = localized(errors, 'temporaryClosedMessage', input.temporaryClosedMessage ?? current.temporaryClosedMessage, isTemporarilyClosed ? ['ka', 'en'] : [], 400)
  const nextAvailableMessage = localized(errors, 'nextAvailableMessage', input.nextAvailableMessage ?? current.nextAvailableMessage, ['ka', 'en'], 400)
  const demoOverride = oneOf(errors, 'demoOverride', input.demoOverride, ['auto', 'open', 'closed'] as const, current.demoOverride)

  fail(errors)
  return { weeklySchedule, isTemporarilyClosed, temporaryClosedFrom, temporaryClosedUntil, temporaryClosedMessage, nextAvailableMessage, demoOverride }
}

function hoursPayload(tenantId: string) {
  return { hours: structuredClone(tenantWorkingHours(tenantId)), status: workingHoursStatus(tenantId) }
}

api.register('GET', '/admin/working-hours', () => {
  requireRole('admin')
  return hoursPayload(currentTenantId())
})

api.register('PUT', '/admin/working-hours', ({ body }) => {
  requireRole('admin')
  const tenantId = currentTenantId()
  const hours = tenantWorkingHours(tenantId)
  const next = parseHours(body, hours)
  const closedNow = next.isTemporarilyClosed && !hours.isTemporarilyClosed
  Object.assign(hours, next)
  log('admin_update_working_hours', tenantId, null, {
    temporaryClosure: hours.isTemporarilyClosed,
    openDays: hours.weeklySchedule.filter((day) => day.enabled).length,
    demoOverride: hours.demoOverride,
    ...(closedNow ? { closedUntil: hours.temporaryClosedUntil } : {}),
  })
  broadcast('working-hours:update', hours)
  return hoursPayload(tenantId)
})

/* ------------------------------------------------------------ custom fields */

function tenantFields(tenantId: string): CustomField[] {
  return store.data.customFields.filter((row) => row.tenantId === tenantId).sort((a, b) => a.sortOrder - b.sortOrder)
}

function slug(value: string): string {
  const base = value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return base.slice(0, 24)
}

function parseField(body: unknown, current: CustomField | null): Omit<CustomField, 'id' | 'tenantId' | 'sortOrder'> {
  const input = asRecord(body)
  const errors: Record<string, string> = {}
  const base = current ?? { label: { ka: '', en: '' }, type: 'text' as CustomFieldType, required: false, placeholder: { ka: '', en: '' }, options: [], enabled: true, groupBy: false }

  const label = localized(errors, 'label', 'label' in input ? input.label : base.label, ['ka', 'en'], 60)
  const placeholder = localized(errors, 'placeholder', 'placeholder' in input ? input.placeholder : base.placeholder, [], 80)
  const type = oneOf(errors, 'type', input.type, FIELD_TYPES, base.type)
  const required = bool(errors, 'required', input.required, base.required)
  const enabled = bool(errors, 'enabled', input.enabled, base.enabled)
  const groupBy = bool(errors, 'groupBy', input.groupBy, base.groupBy)

  const options: CustomField['options'] = []
  if (type === 'select') {
    const rows = 'options' in input ? (Array.isArray(input.options) ? (input.options as unknown[]) : []) : base.options
    if (rows.length > MAX_OPTIONS) errors.options = 'too_many'
    const used = new Set<string>()
    rows.forEach((raw, index) => {
      const row = asRecord(raw)
      const optionLabel = localized(errors, `options.${index}.label`, row.label, ['ka', 'en'], 60)
      let value = str(row.value) || slug(optionLabel.en) || `option_${index + 1}`
      while (used.has(value)) value = `${value}_${index + 1}`
      used.add(value)
      options.push({ value, label: optionLabel })
    })
    if (options.length === 0 && !errors.options) errors.options = 'need_option'
  }
  if (groupBy && !enabled) errors.groupBy = 'disabled'

  fail(errors)
  return { label, placeholder, type, required, enabled, groupBy, options }
}

api.register('GET', '/admin/custom-fields', () => {
  requireRole('admin')
  return structuredClone(tenantFields(currentTenantId()))
})

api.register('POST', '/admin/custom-fields', ({ body }) => {
  requireRole('admin')
  const tenantId = currentTenantId()
  const fields = tenantFields(tenantId)
  if (fields.length >= MAX_FIELDS) throw codeError(409, 'The form already has the maximum number of fields.', 'too_many_fields')
  const parsed = parseField(body, null)
  const row: CustomField = {
    id: newId('cf_'),
    tenantId,
    sortOrder: fields.reduce((max, field) => Math.max(max, field.sortOrder), 0) + 1,
    ...parsed,
  }
  if (row.groupBy) for (const other of fields) other.groupBy = false
  store.data.customFields.push(row)
  log('admin_update_settings', row.id, row.label.en, { area: 'custom_fields', op: 'create', type: row.type })
  pingSettings(tenantId)
  return structuredClone(row)
})

api.register('PATCH', '/admin/custom-fields/:id', ({ path, body }) => {
  requireRole('admin')
  const tenantId = currentTenantId()
  const row = tenantFields(tenantId).find((field) => field.id === path.id)
  if (!row) throw notFound('Field not found.')
  const parsed = parseField(body, row)
  if (parsed.groupBy) for (const other of tenantFields(tenantId)) if (other.id !== row.id) other.groupBy = false
  Object.assign(row, parsed)
  log('admin_update_settings', row.id, row.label.en, { area: 'custom_fields', op: 'update', enabled: row.enabled })
  pingSettings(tenantId)
  return structuredClone(row)
})

api.register('DELETE', '/admin/custom-fields/:id', ({ path }) => {
  requireRole('admin')
  const tenantId = currentTenantId()
  const row = tenantFields(tenantId).find((field) => field.id === path.id)
  if (!row) throw notFound('Field not found.')
  if (store.data.bans.some((ban) => ban.tenantId === tenantId && ban.fieldId === row.id)) {
    throw codeError(409, 'Remove the ban rules that use this field first.', 'field_in_use')
  }
  removeWhere(store.data.customFields, (field) => field.id === row.id)
  log('admin_update_settings', row.id, row.label.en, { area: 'custom_fields', op: 'delete' })
  pingSettings(tenantId)
  return { ok: true }
})

/* ------------------------------------------------------------ quick replies */

function tenantReplies(tenantId: string): QuickReply[] {
  return store.data.quickReplies.filter((row) => row.tenantId === tenantId).sort((a, b) => a.sortOrder - b.sortOrder)
}

function parseReply(body: unknown, current: QuickReply | null): Omit<QuickReply, 'id' | 'tenantId' | 'sortOrder'> {
  const input = asRecord(body)
  const errors: Record<string, string> = {}
  const title = localized(errors, 'title', 'title' in input ? input.title : (current?.title ?? {}), ['ka', 'en'], 60)
  const content = localized(errors, 'content', 'content' in input ? input.content : (current?.content ?? {}), ['ka', 'en'], 1000)
  const category = oneOf(errors, 'category', input.category, CATEGORIES, current?.category ?? 'greetings')
  const enabled = bool(errors, 'enabled', input.enabled, current?.enabled ?? true)
  fail(errors)
  return { title, content, category, enabled }
}

api.register('GET', '/admin/quick-replies', () => {
  requireRole('admin')
  return structuredClone(tenantReplies(currentTenantId()))
})

api.register('POST', '/admin/quick-replies', ({ body }) => {
  requireRole('admin')
  const tenantId = currentTenantId()
  const parsed = parseReply(body, null)
  const row: QuickReply = {
    id: newId('qr_'),
    tenantId,
    sortOrder: tenantReplies(tenantId).reduce((max, reply) => Math.max(max, reply.sortOrder), 0) + 1,
    ...parsed,
  }
  store.data.quickReplies.push(row)
  log('admin_update_settings', row.id, row.title.en, { area: 'quick_replies', op: 'create', category: row.category })
  return structuredClone(row)
})

api.register('PATCH', '/admin/quick-replies/:id', ({ path, body }) => {
  requireRole('admin')
  const row = tenantReplies(currentTenantId()).find((reply) => reply.id === path.id)
  if (!row) throw notFound('Quick reply not found.')
  Object.assign(row, parseReply(body, row))
  log('admin_update_settings', row.id, row.title.en, { area: 'quick_replies', op: 'update', enabled: row.enabled })
  return structuredClone(row)
})

api.register('POST', '/admin/quick-replies/:id/move', ({ path, body }) => {
  requireRole('admin')
  const tenantId = currentTenantId()
  const direction = asRecord(body).direction
  if (direction !== 'up' && direction !== 'down') throw DemoApiError.validation({ direction: 'invalid' })
  const group = tenantReplies(tenantId)
  const row = group.find((reply) => reply.id === path.id)
  if (!row) throw notFound('Quick reply not found.')
  const siblings = group.filter((reply) => reply.category === row.category)
  const index = siblings.findIndex((reply) => reply.id === row.id)
  const other = siblings[direction === 'up' ? index - 1 : index + 1]
  if (!other) return structuredClone(tenantReplies(tenantId))
  const keep = row.sortOrder
  row.sortOrder = other.sortOrder
  other.sortOrder = keep
  log('admin_update_settings', row.id, row.title.en, { area: 'quick_replies', op: 'move', direction })
  return structuredClone(tenantReplies(tenantId))
})

api.register('DELETE', '/admin/quick-replies/:id', ({ path }) => {
  requireRole('admin')
  const row = tenantReplies(currentTenantId()).find((reply) => reply.id === path.id)
  if (!row) throw notFound('Quick reply not found.')
  removeWhere(store.data.quickReplies, (reply) => reply.id === row.id)
  log('admin_update_settings', row.id, row.title.en, { area: 'quick_replies', op: 'delete' })
  return { ok: true }
})

/* --------------------------------------------------------------------- bans */

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
const IPV6 = /^[0-9a-f:]{3,39}$/i

function tenantBans(tenantId: string): BannedClient[] {
  return store.data.bans.filter((row) => row.tenantId === tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

const sameValue = (a: string, b: string) => a.replace(/[\s()+-]/g, '').toLowerCase() === b.replace(/[\s()+-]/g, '').toLowerCase()

api.register('GET', '/admin/bans', () => {
  requireRole('admin')
  return structuredClone(tenantBans(currentTenantId()))
})

api.register('POST', '/admin/bans', ({ body }) => {
  const account = requireRole('admin')
  const tenantId = currentTenantId()
  const input = asRecord(body)
  const errors: Record<string, string> = {}
  const type = oneOf(errors, 'type', input.type, ['ip', 'customField'] as const, 'ip')
  const value = str(input.value)
  const reason = str(input.reason)
  let fieldId: string | null = null
  let fieldLabel: string | null = null

  if (!value) errors.value = 'required'
  else if (value.length > 80) errors.value = 'too_long'
  else if (type === 'ip' && !IPV4.test(value) && !(value.includes(':') && IPV6.test(value))) errors.value = 'invalid_ip'
  if (type === 'customField') {
    const field = tenantFields(tenantId).find((row) => row.id === str(input.fieldId))
    if (!field) errors.fieldId = 'required'
    else {
      fieldId = field.id
      fieldLabel = field.label.en
    }
  }
  if (!reason) errors.reason = 'required'
  else if (reason.length > 200) errors.reason = 'too_long'
  fail(errors)

  if (tenantBans(tenantId).some((ban) => ban.type === type && ban.fieldId === fieldId && sameValue(ban.value, value))) {
    throw codeError(409, 'This client is already banned.', 'ban_exists')
  }
  const row: BannedClient = { id: newId('ban_'), tenantId, type, value, fieldId, fieldLabel, reason, createdBy: account.name, createdAt: nowIso() }
  store.data.bans.push(row)
  log('admin_ban_client', row.id, value, { type, fieldId, reason })
  return structuredClone(row)
})

api.register('DELETE', '/admin/bans/:id', ({ path }) => {
  requireRole('admin')
  const row = tenantBans(currentTenantId()).find((ban) => ban.id === path.id)
  if (!row) throw notFound('Ban rule not found.')
  removeWhere(store.data.bans, (ban) => ban.id === row.id)
  log('admin_unban_client', row.id, row.value, { type: row.type })
  return { ok: true }
})
