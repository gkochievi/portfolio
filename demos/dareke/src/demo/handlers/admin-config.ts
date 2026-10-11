/**
 * Mock API handlers for "admin-config":
 * agent statuses, dispositions, the DNC list, dialer settings and the super_admin system config.
 * Reads of statuses and dispositions are open to every signed-in role (the operator needs them);
 * every write needs admin or super_admin.
 */
import { DemoApiError, conflict, notFound, type MockApi } from '@portfolio/demo-kit'

import { addToDnc, changed, normalizePhone, nowIso, requireRole, requireUser, syncOut, userName } from '@/demo/domain'
import { store } from '@/demo/store'
import type {
  AgentStatus,
  AgentStatusType,
  ConnectionTestResult,
  Disposition,
  DncEntryView,
  DncImportResult,
  Localized,
  SystemConfig,
  SystemSettings,
  Tone,
} from '@/types'

const TONES: Tone[] = ['lime', 'success', 'info', 'warning', 'danger', 'muted', 'ink']
const STATUS_TYPES: AgentStatusType[] = ['working', 'paused', 'offline']
const REQUIRED = 'This field is required.'

type Body = Record<string, unknown>

const asBody = (body: unknown): Body => (body && typeof body === 'object' ? (body as Body) : {})
const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)
const num = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(n) ? n : null
}
const tone = (value: unknown, fallback: Tone): Tone => (TONES.includes(value as Tone) ? (value as Tone) : fallback)

/** `{en, ka}` from a body field; a missing ka falls back to en. */
const localized = (value: unknown): Localized => {
  const v = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const en = str(v.en)
  return { en, ka: str(v.ka) || en }
}

const requireAdmin = () => requireRole('admin', 'super_admin')
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const between = (min: number, max: number) => Math.round(min + Math.random() * (max - min))

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || 'status'

/* ------------------------------------------------------------------- statuses */

function validateStatus(input: Body, partial: boolean, current?: AgentStatus) {
  const errors: Record<string, string> = {}
  const name = input.displayName !== undefined || !partial ? localized(input.displayName) : null
  if (name && !name.en) errors['displayName.en'] = REQUIRED
  const type = input.type !== undefined || !partial ? (input.type as AgentStatusType) : null
  if (type !== null && !STATUS_TYPES.includes(type)) errors.type = 'Choose working, paused or offline.'
  if (current?.isSystem && type !== null && type !== current.type) errors.type = 'The type of a system status cannot change.'
  const timeout = input.timeoutSeconds !== undefined || !partial ? num(input.timeoutSeconds ?? 0) : null
  if (input.timeoutSeconds !== undefined && (timeout === null || timeout < 0 || timeout > 86_400 || !Number.isInteger(timeout)))
    errors.timeoutSeconds = 'Enter whole seconds between 0 and 86400.'
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
  return { name, type, timeout }
}

/* -------------------------------------------------------------- dispositions */

function validateDisposition(input: Body, partial: boolean, selfId?: string) {
  const errors: Record<string, string> = {}
  const code = input.code !== undefined || !partial ? str(input.code).toUpperCase().replace(/\s+/g, '_') : null
  if (code !== null) {
    if (!code) errors.code = REQUIRED
    else if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(code)) errors.code = 'Use 2-32 letters, digits or underscores.'
    else if (store.data.dispositions.some((d) => d.code === code && d.id !== selfId)) errors.code = 'This code already exists.'
  }
  const name = input.name !== undefined || !partial ? localized(input.name) : null
  if (name && !name.en) errors['name.en'] = REQUIRED
  const sortOrder = input.sortOrder !== undefined ? num(input.sortOrder) : null
  if (input.sortOrder !== undefined && (sortOrder === null || sortOrder < 1 || !Number.isInteger(sortOrder)))
    errors.sortOrder = 'Enter a whole number from 1.'
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
  return { code, name, sortOrder }
}

/* ----------------------------------------------------------------------- DNC */

const dncView = (entry: (typeof store.data.dnc)[number]): DncEntryView => ({ ...entry, addedByName: userName(entry.addedById) })

/** The first CSV column of a line, unquoted. */
const firstColumn = (line: string): string => {
  const cell = line.split(/[,;\t]/)[0] ?? ''
  return cell.trim().replace(/^"|"$/g, '').trim()
}

/* ------------------------------------------------------------------ settings */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function validateSettings(input: Body, current: SystemSettings): SystemSettings {
  const d = asBody(input.dialer)
  const w = asBody(input.wrapup)
  const h = asBody(input.workingHours)
  const errors: Record<string, string> = {}
  const pick = (value: unknown, fallback: number) => (value === undefined ? fallback : num(value))

  const base = pick(d.baseDialRatio, current.dialer.baseDialRatio)
  const max = pick(d.maxDialRatio, current.dialer.maxDialRatio)
  const min = pick(d.minDialRatio, current.dialer.minDialRatio)
  const abandon = pick(d.targetAbandonRate, current.dialer.targetAbandonRate)
  for (const [key, value] of [['minDialRatio', min], ['baseDialRatio', base], ['maxDialRatio', max]] as const) {
    if (value === null || value < 1 || value > 5) errors[`dialer.${key}`] = 'Enter a ratio between 1.0 and 5.0.'
  }
  if (min !== null && base !== null && max !== null && !errors['dialer.baseDialRatio']) {
    if (min > base) errors['dialer.minDialRatio'] = 'The minimum cannot exceed the base ratio.'
    if (base > max) errors['dialer.maxDialRatio'] = 'The maximum must be at least the base ratio.'
  }
  if (abandon === null || abandon < 0 || abandon > 100) errors['dialer.targetAbandonRate'] = 'Enter a percentage between 0 and 100.'

  const wDefault = pick(w.defaultWrapupTime, current.wrapup.defaultWrapupTime)
  const wMax = pick(w.maxWrapupTime, current.wrapup.maxWrapupTime)
  if (wDefault === null || wDefault < 0 || wDefault > 3600 || !Number.isInteger(wDefault)) errors['wrapup.defaultWrapupTime'] = 'Enter whole seconds between 0 and 3600.'
  if (wMax === null || wMax < 0 || wMax > 3600 || !Number.isInteger(wMax)) errors['wrapup.maxWrapupTime'] = 'Enter whole seconds between 0 and 3600.'
  if (wDefault !== null && wMax !== null && wDefault > wMax && !errors['wrapup.maxWrapupTime'])
    errors['wrapup.maxWrapupTime'] = 'The maximum must be at least the default.'

  const start = h.startTime === undefined ? current.workingHours.startTime : str(h.startTime)
  const end = h.endTime === undefined ? current.workingHours.endTime : str(h.endTime)
  if (!TIME.test(start)) errors['workingHours.startTime'] = 'Use HH:mm.'
  if (!TIME.test(end)) errors['workingHours.endTime'] = 'Use HH:mm.'
  else if (TIME.test(start) && end <= start) errors['workingHours.endTime'] = 'The end must be after the start.'
  const days = h.workingDays === undefined ? current.workingHours.workingDays : Array.isArray(h.workingDays) ? h.workingDays : []
  const cleanDays = [...new Set(days.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))].sort()
  if (cleanDays.length === 0) errors['workingHours.workingDays'] = 'Pick at least one working day.'

  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
  return {
    dialer: { baseDialRatio: base as number, maxDialRatio: max as number, minDialRatio: min as number, targetAbandonRate: abandon as number },
    wrapup: { defaultWrapupTime: wDefault as number, maxWrapupTime: wMax as number },
    workingHours: { startTime: start, endTime: end, workingDays: cleanDays },
  }
}

/* ------------------------------------------------------------- system config */

const SECTIONS = ['app', 'client', 'pbx', 'ldap'] as const
type Section = (typeof SECTIONS)[number]

const port = (value: unknown, field: string, errors: Record<string, string>, fallback: number): number => {
  const n = value === undefined ? fallback : num(value)
  if (n === null || !Number.isInteger(n) || n < 1 || n > 65_535) {
    errors[field] = 'Enter a port between 1 and 65535.'
    return fallback
  }
  return n
}

function applySection(section: Section, input: Body, config: SystemConfig): void {
  const errors: Record<string, string> = {}
  const text = (value: unknown, fallback: string) => (value === undefined ? fallback : str(value))
  if (section === 'app') {
    const app = config.app
    config.app = {
      port: port(input.port, 'port', errors, app.port),
      host: text(input.host, app.host),
      jwtExpiresIn: text(input.jwtExpiresIn, app.jwtExpiresIn),
      corsOrigin: text(input.corsOrigin, app.corsOrigin),
      recordingsPath: text(input.recordingsPath, app.recordingsPath),
      dialerMockMode: bool(input.dialerMockMode, app.dialerMockMode),
    }
    if (!config.app.host) errors.host = REQUIRED
  } else if (section === 'client') {
    const c = config.client
    const next = {
      apiUrl: text(input.apiUrl, c.apiUrl),
      wsUrl: text(input.wsUrl, c.wsUrl),
      webrtcEnabled: bool(input.webrtcEnabled, c.webrtcEnabled),
      sipWssUrl: text(input.sipWssUrl, c.sipWssUrl),
      sipDomain: text(input.sipDomain, c.sipDomain),
      iceServers: input.iceServers === undefined ? c.iceServers : String(input.iceServers).trim(),
      useMockData: bool(input.useMockData, c.useMockData),
    }
    if (!/^https?:\/\//.test(next.apiUrl)) errors.apiUrl = 'Start with http:// or https://.'
    if (!/^wss?:\/\//.test(next.wsUrl)) errors.wsUrl = 'Start with ws:// or wss://.'
    if (next.webrtcEnabled && !/^wss?:\/\//.test(next.sipWssUrl)) errors.sipWssUrl = 'Start with ws:// or wss://.'
    config.client = next
  } else if (section === 'pbx') {
    const p = config.pbx
    const secret = typeof input.secret === 'string' ? input.secret : ''
    config.pbx = {
      host: text(input.host, p.host),
      port: port(input.port, 'port', errors, p.port),
      username: text(input.username, p.username),
      secretSet: secret ? true : p.secretSet,
      trunk: text(input.trunk, p.trunk),
      context: text(input.context, p.context),
      enabled: bool(input.enabled, p.enabled),
    }
    if (config.pbx.enabled && !config.pbx.host) errors.host = 'A host is required while the PBX is enabled.'
  } else {
    const l = config.ldap
    const password = typeof input.bindPassword === 'string' ? input.bindPassword : ''
    config.ldap = {
      url: text(input.url, l.url),
      bindDn: text(input.bindDn, l.bindDn),
      bindPasswordSet: password ? true : l.bindPasswordSet,
      baseDn: text(input.baseDn, l.baseDn),
      userSearchFilter: text(input.userSearchFilter, l.userSearchFilter),
      enabled: bool(input.enabled, l.enabled),
    }
    if (config.ldap.url && !/^ldaps?:\/\//.test(config.ldap.url)) errors.url = 'Start with ldap:// or ldaps://.'
    if (config.ldap.userSearchFilter && !config.ldap.userSearchFilter.includes('{{username}}'))
      errors.userSearchFilter = 'The filter must contain {{username}}.'
    if (config.ldap.enabled && !config.ldap.url) errors.url = 'A URL is required while the directory is enabled.'
  }
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
}

/* ---------------------------------------------------------------- register */

export function register(api: MockApi): void {
  /* agent statuses */
  api.register('GET', '/agent-statuses', () => {
    requireUser()
    return [...store.data.agentStatuses].sort((a, b) => a.sortOrder - b.sortOrder)
  })

  api.register('POST', '/agent-statuses', ({ body }) => {
    requireAdmin()
    const input = asBody(body)
    const { name, type, timeout } = validateStatus(input, false)
    const base = `custom_${slug(name?.en ?? '')}`
    let key = base
    for (let i = 2; store.data.agentStatuses.some((s) => s.name === key); i += 1) key = `${base}_${i}`
    const status: AgentStatus = {
      id: store.nextId('st_'),
      name: key,
      displayName: name as Localized,
      type: type as AgentStatusType,
      timeoutSeconds: timeout ?? 0,
      autoReturn: bool(input.autoReturn, false),
      color: tone(input.color, 'muted'),
      sortOrder: Math.max(0, ...store.data.agentStatuses.map((s) => s.sortOrder)) + 1,
      isDefault: false,
      isSystem: false,
      isActive: true,
    }
    store.data.agentStatuses.push(status)
    changed('statuses', 'agents', 'me')
    return status
  })

  api.register('PATCH', '/agent-statuses/:id', ({ path, body }) => {
    requireAdmin()
    const status = store.data.agentStatuses.find((s) => s.id === path.id)
    if (!status) throw notFound('Status not found.')
    const input = asBody(body)
    const { name, type, timeout } = validateStatus(input, true, status)
    if (name) status.displayName = name
    if (type) status.type = type
    if (timeout !== null && input.timeoutSeconds !== undefined) status.timeoutSeconds = timeout
    if (input.autoReturn !== undefined) status.autoReturn = bool(input.autoReturn, status.autoReturn)
    if (input.color !== undefined) status.color = tone(input.color, status.color)
    changed('statuses', 'agents', 'me', 'metrics')
    return status
  })

  api.register('DELETE', '/agent-statuses/:id', ({ path }) => {
    requireAdmin()
    const index = store.data.agentStatuses.findIndex((s) => s.id === path.id)
    const status = store.data.agentStatuses[index]
    if (!status) throw notFound('Status not found.')
    if (status.isDefault || status.isSystem) throw conflict('Cannot delete default status')
    const inUse = store.data.agentStates.filter((state) => state.statusId === status.id).length
    if (inUse > 0) throw conflict(`Status is in use by ${inUse} agent(s) right now`)
    store.data.agentStatuses.splice(index, 1)
    changed('statuses', 'agents')
    return undefined
  })

  /* dispositions */
  api.register('GET', '/dispositions', () => {
    requireUser()
    return [...store.data.dispositions].sort((a, b) => a.sortOrder - b.sortOrder)
  })

  api.register('POST', '/dispositions', ({ body }) => {
    requireAdmin()
    const input = asBody(body)
    const { code, name } = validateDisposition(input, false)
    const disposition: Disposition = {
      id: store.nextId('disp_'),
      code: code as string,
      name: name as Localized,
      description: null,
      isFinal: bool(input.isFinal, false),
      scheduleCallback: bool(input.scheduleCallback, false),
      addToDnc: bool(input.addToDnc, false),
      color: tone(input.color, 'info'),
      sortOrder: store.data.dispositions.length + 1,
      isActive: true,
    }
    store.data.dispositions.push(disposition)
    changed('dispositions')
    return disposition
  })

  api.register('PATCH', '/dispositions/:id', ({ path, body }) => {
    requireAdmin()
    const disposition = store.data.dispositions.find((d) => d.id === path.id)
    if (!disposition) throw notFound('Disposition not found.')
    const input = asBody(body)
    const { code, name, sortOrder } = validateDisposition(input, true, disposition.id)
    const previousCode = disposition.code
    if (code) disposition.code = code
    if (name) disposition.name = name
    if (sortOrder !== null) disposition.sortOrder = sortOrder
    if (input.isFinal !== undefined) disposition.isFinal = bool(input.isFinal, disposition.isFinal)
    if (input.scheduleCallback !== undefined) disposition.scheduleCallback = bool(input.scheduleCallback, disposition.scheduleCallback)
    if (input.addToDnc !== undefined) disposition.addToDnc = bool(input.addToDnc, disposition.addToDnc)
    if (input.color !== undefined) disposition.color = tone(input.color, disposition.color)
    // Keep call history pointing at the renamed code.
    if (code && code !== previousCode) for (const call of store.data.calls) if (call.dispositionCode === previousCode) call.dispositionCode = code
    changed('dispositions', 'calls', 'reports')
    return disposition
  })

  api.register('DELETE', '/dispositions/:id', ({ path }) => {
    requireAdmin()
    const index = store.data.dispositions.findIndex((d) => d.id === path.id)
    if (index < 0) throw notFound('Disposition not found.')
    store.data.dispositions.splice(index, 1)
    // Close the gap so hotkeys stay 1..n.
    store.data.dispositions.sort((a, b) => a.sortOrder - b.sortOrder).forEach((d, i) => (d.sortOrder = i + 1))
    changed('dispositions')
    return undefined
  })

  /* DNC */
  api.register('GET', '/dnc', ({ params }) => {
    requireAdmin()
    const q = (params.q ?? '').toLowerCase().replace(/\s+/g, '')
    return store.data.dnc
      .filter((entry) => !q || entry.phoneNumber.includes(q.replace(/^\+/, '')) || entry.reason.toLowerCase().replace(/\s+/g, '').includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(dncView)
  })

  api.register('GET', '/dnc/check', ({ params }) => {
    requireUser()
    const phone = normalizePhone(params.phone ?? '')
    return { onDnc: phone ? store.data.dnc.some((entry) => entry.phoneNumber === phone) : false }
  })

  api.register('POST', '/dnc', ({ body }) => {
    const user = requireAdmin()
    const input = asBody(body)
    const raw = str(input.phoneNumber)
    if (!raw) throw DemoApiError.validation({ phoneNumber: REQUIRED })
    const phone = normalizePhone(raw)
    if (!phone) throw DemoApiError.validation({ phoneNumber: 'Enter a valid phone number.' })
    if (store.data.dnc.some((entry) => entry.phoneNumber === phone))
      throw DemoApiError.validation({ phoneNumber: 'This number is already on the DNC list.' })
    const entry = addToDnc(phone, { reason: str(input.reason) || 'Added manually', source: 'MANUAL', addedById: user.id })
    changed('dnc', 'numbers', 'campaigns')
    return dncView(entry)
  })

  api.register('DELETE', '/dnc/:id', ({ path }) => {
    requireAdmin()
    const index = store.data.dnc.findIndex((entry) => entry.id === path.id)
    if (index < 0) throw notFound('Entry not found.')
    store.data.dnc.splice(index, 1)
    syncOut('dnc', path.id as string, null)
    changed('dnc', 'numbers', 'campaigns')
    return undefined
  })

  api.register('POST', '/dnc/import', ({ body }) => {
    const user = requireAdmin()
    const input = asBody(body)
    const text = typeof input.text === 'string' ? input.text : ''
    const filename = str(input.filename) || 'upload.csv'
    if (!text.trim()) throw DemoApiError.validation({ file: 'The file is empty.' })
    const result: DncImportResult = { imported: 0, duplicates: 0, invalid: 0 }
    const lines = text.replace(/^﻿/, '').split(/\r?\n/)
    lines.forEach((line, i) => {
      const cell = firstColumn(line)
      if (!cell) return
      if (i === 0 && !/\d/.test(cell)) return // header row
      const phone = normalizePhone(cell)
      if (!phone) {
        result.invalid += 1
        return
      }
      if (store.data.dnc.some((entry) => entry.phoneNumber === phone)) {
        result.duplicates += 1
        return
      }
      addToDnc(phone, { reason: `Imported from ${filename}`, source: 'IMPORT', addedById: user.id })
      result.imported += 1
    })
    if (result.imported > 0) changed('dnc', 'numbers', 'campaigns')
    return result
  })

  /* dialer settings */
  api.register('GET', '/settings', () => {
    requireUser()
    return store.data.settings
  })

  api.register('PUT', '/settings', ({ body }) => {
    requireAdmin()
    store.data.settings = validateSettings(asBody(body), store.data.settings)
    changed('settings', 'dialer')
    return store.data.settings
  })

  /* system config (super_admin) */
  api.register('GET', '/system-config', () => {
    requireRole('super_admin')
    return store.data.systemConfig
  })

  api.register('PUT', '/system-config/:section', ({ path, body }) => {
    const user = requireRole('super_admin')
    const section = path.section as Section
    if (!SECTIONS.includes(section)) throw notFound('Unknown section.')
    const draft: SystemConfig = structuredClone(store.data.systemConfig)
    applySection(section, asBody(body), draft)
    draft.updatedAt = nowIso()
    draft.updatedById = user.id
    store.data.systemConfig = draft
    changed('config')
    return draft
  })

  api.register('POST', '/system-config/pbx/test', async ({ body }) => {
    requireRole('super_admin')
    const input = asBody(body)
    const host = input.host !== undefined ? str(input.host) : store.data.systemConfig.pbx.host
    const p = input.port !== undefined ? num(input.port) : store.data.systemConfig.pbx.port
    const wait = between(800, 1500)
    await sleep(wait)
    let result: ConnectionTestResult
    if (!host) result = { ok: false, message: 'PBX host is not configured', latencyMs: null }
    else if (p === null || p < 1 || p > 65_535) result = { ok: false, message: 'Invalid AMI port', latencyMs: null }
    else result = { ok: true, message: 'Connected to PBX (Asterisk 20.x)', latencyMs: between(14, 62) }
    return result
  })

  api.register('POST', '/system-config/ldap/test', async ({ body }) => {
    requireRole('super_admin')
    const input = asBody(body)
    const ldap = store.data.systemConfig.ldap
    const url = input.url !== undefined ? str(input.url) : ldap.url
    const bindDn = input.bindDn !== undefined ? str(input.bindDn) : ldap.bindDn
    await sleep(between(800, 1500))
    let result: ConnectionTestResult
    if (!url) result = { ok: false, message: 'Directory URL is not configured', latencyMs: null }
    else if (!/^ldaps?:\/\//.test(url)) result = { ok: false, message: 'Invalid directory URL', latencyMs: null }
    else if (!bindDn) result = { ok: false, message: 'Bind DN is required', latencyMs: null }
    else result = { ok: true, message: 'Bind succeeded, directory reachable', latencyMs: between(22, 95) }
    return result
  })
}
