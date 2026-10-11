/**
 * Mock API handlers for "campaigns".
 * Paths are registered WITHOUT the "/api" prefix. Every route is admin / super_admin.
 *
 * Lifecycle: draft -> active (needs >= 1 PENDING and >= 1 agent), active <-> paused,
 * any non-completed (and non-archived) -> completed. Delete archives when the
 * campaign has call history. Clearing the list keeps DIALING leads.
 */
import { DemoApiError, conflict, notFound, type DemoParams, type MockApi } from '@portfolio/demo-kit'

import { campaignById, changed, isOnDnc, normalizePhone, nowIso, requireRole, withStats } from '@/demo/domain'
import { store } from '@/demo/store'
import type {
  Campaign,
  CampaignNumber,
  CampaignWithStats,
  DialingMode,
  ImportResult,
  Localized,
  NumberStatus,
  ScriptStep,
  User,
} from '@/types'

const guard = () => requireRole('admin', 'super_admin')

/** Error messages (the UI maps these to translated copy). */
export const CAMPAIGN_ERRORS = {
  notFound: 'Campaign not found.',
  startStatus: 'Campaign can only be started from draft or paused status.',
  noPending: 'No pending numbers to call. Upload numbers first.',
  noAgents: 'Assign at least one agent before starting.',
  pauseStatus: 'Only an active campaign can be paused.',
  stopStatus: 'This campaign is already finished.',
  deleteActive: 'Cannot delete an active campaign. Pause or stop it first.',
  clearActive: 'Cannot clear numbers from an active campaign. Pause or stop the campaign first.',
  closed: 'Cannot add numbers to a completed or archived campaign.',
  numberDialing: 'Cannot remove a number that is currently being called.',
  duplicateNumber: 'This number is already in the campaign.',
  invalidPhone: 'Enter a valid phone number.',
  predictive: 'Predictive dialing is coming soon.',
  noRows: 'The file has no rows to import.',
  tooManyRows: 'Import at most 5000 rows at a time.',
  badAgent: 'Only active operators can be assigned.',
} as const

const NUMBER_GROUPS: Record<string, NumberStatus[]> = {
  pending: ['PENDING', 'NO_ANSWER', 'BUSY', 'DIALING', 'CONNECTED'],
  completed: ['COMPLETED'],
  failed: ['FAILED'],
  dnc: ['DNC'],
  callback: ['CALLBACK_SCHEDULED'],
}

const MAX_IMPORT_ROWS = 5000

let seq = 0
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`

function getCampaign(id: string | undefined): Campaign {
  const campaign = id ? campaignById(id) : undefined
  if (!campaign) throw notFound(CAMPAIGN_ERRORS.notFound)
  return campaign
}

const lc = (value: string) => value.toLocaleLowerCase()
const textOf = (value: Localized | null | undefined) => (value ? `${value.en} ${value.ka}` : '')

/* ---------------------------------------------------------------- validation */

type Input = Record<string, unknown>

function asLocalized(value: unknown, field: string, required: boolean, max: number): Localized | null {
  let out: Localized | null = null
  if (typeof value === 'string') out = { en: value.trim(), ka: value.trim() }
  else if (value && typeof value === 'object' && 'en' in value && 'ka' in value) {
    const v = value as { en: unknown; ka: unknown }
    out = { en: String(v.en ?? '').trim(), ka: String(v.ka ?? '').trim() }
  }
  if (!out || (!out.en && !out.ka)) {
    if (required) throw DemoApiError.validation({ [field]: 'This field is required.' })
    return { en: '', ka: '' }
  }
  if (out.en.length > max || out.ka.length > max) throw DemoApiError.validation({ [field]: `At most ${max} characters.` })
  return out
}

function asInt(value: unknown, field: string, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) throw DemoApiError.validation({ [field]: 'A valid number is required.' })
  if (n < min || n > max) throw DemoApiError.validation({ [field]: `Enter a value from ${min} to ${max}.` })
  return Math.round(n)
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Validates a full (create) or partial (patch) campaign body. */
function readCampaignInput(body: Input, partial: boolean, current?: Campaign): Partial<Campaign> {
  const out: Partial<Campaign> = {}
  const has = (key: string) => key in body && body[key] !== undefined
  if (!partial || has('name')) {
    const name = asLocalized(body.name, 'name', true, 100)!
    if (Math.min(name.en.length, name.ka.length) < 2) throw DemoApiError.validation({ name: 'At least 2 characters.' })
    out.name = name
  }
  if (!partial || has('clientName')) out.clientName = asLocalized(body.clientName, 'clientName', true, 100)!
  if (!partial || has('description')) out.description = asLocalized(body.description ?? '', 'description', false, 500)!
  if (!partial || has('callerId')) {
    const callerId = String(body.callerId ?? '').trim()
    if (!callerId) throw DemoApiError.validation({ callerId: 'Caller ID is required.' })
    if (!/^\+?[\d\s()-]{5,20}$/.test(callerId)) throw DemoApiError.validation({ callerId: 'Enter a valid caller ID.' })
    out.callerId = callerId
  }
  if (!partial || has('queueName')) {
    const queue = String(body.queueName ?? '').trim()
    if (queue && !/^[A-Za-z0-9_-]{1,40}$/.test(queue)) {
      throw DemoApiError.validation({ queueName: 'Use letters, digits, - and _ only.' })
    }
    out.queueName = queue || null
  }
  if (!partial || has('workingHoursStart')) {
    const v = String(body.workingHoursStart ?? '10:00')
    if (!HHMM.test(v)) throw DemoApiError.validation({ workingHoursStart: 'Use HH:mm.' })
    out.workingHoursStart = v
  }
  if (!partial || has('workingHoursEnd')) {
    const v = String(body.workingHoursEnd ?? '19:00')
    if (!HHMM.test(v)) throw DemoApiError.validation({ workingHoursEnd: 'Use HH:mm.' })
    out.workingHoursEnd = v
  }
  const start = out.workingHoursStart ?? current?.workingHoursStart ?? '10:00'
  const end = out.workingHoursEnd ?? current?.workingHoursEnd ?? '19:00'
  if (end <= start) throw DemoApiError.validation({ workingHoursEnd: 'End time must be after the start time.' })

  if (!partial || has('maxAttempts')) out.maxAttempts = asInt(body.maxAttempts ?? 3, 'maxAttempts', 1, 10)
  if (!partial || has('retryDelayMinutes')) out.retryDelayMinutes = asInt(body.retryDelayMinutes ?? 60, 'retryDelayMinutes', 1, 1440)

  if (!partial || has('dialingMode')) {
    const mode = String(body.dialingMode ?? 'MANUAL') as DialingMode
    if (mode === 'PREDICTIVE') throw DemoApiError.validation({ dialingMode: CAMPAIGN_ERRORS.predictive })
    if (mode !== 'MANUAL' && mode !== 'AUTO') throw DemoApiError.validation({ dialingMode: 'Choose a dialing mode.' })
    out.dialingMode = mode
  }
  const { minDialRatio, maxDialRatio, baseDialRatio } = store.data.settings.dialer
  if (!partial || has('dialRatio')) {
    const ratio = Number(body.dialRatio ?? baseDialRatio)
    if (!Number.isFinite(ratio) || ratio < minDialRatio || ratio > maxDialRatio) {
      throw DemoApiError.validation({ dialRatio: `Dial ratio must be between ${minDialRatio} and ${maxDialRatio}.` })
    }
    out.dialRatio = Math.round(ratio * 10) / 10
  }
  if (!partial || has('maxConcurrentCalls')) out.maxConcurrentCalls = asInt(body.maxConcurrentCalls ?? 6, 'maxConcurrentCalls', 1, 50)
  if (!partial || has('dialIntervalMs')) out.dialIntervalMs = asInt(body.dialIntervalMs ?? 1500, 'dialIntervalMs', 250, 10000)
  return out
}

function defaultScript(): ScriptStep[] {
  const step = (n: number, en: [string, string], ka: [string, string]): ScriptStep => ({
    id: newId(`step${n}`),
    title: { en: en[0], ka: ka[0] },
    body: { en: en[1], ka: ka[1] },
  })
  return [
    step(1, ['Greeting', 'Hello, this is {agent} calling on behalf of {client}. Is this a good moment to talk for two minutes?'], [
      'მისალმება',
      'გამარჯობა, {agent} გირეკავთ {client}-ის სახელით. მოსახერხებელია ორი წუთით საუბარი?',
    ]),
    step(2, ['Purpose', 'Explain briefly why you are calling and confirm you are speaking with the right person.'], [
      'ზარის მიზანი',
      'მოკლედ აუხსენით, რატომ რეკავთ, და დარწმუნდით, რომ სწორ ადამიანს ესაუბრებით.',
    ]),
    step(3, ['Questions', 'Ask the agreed questions, listen, and note the answers in the call notes.'], [
      'კითხვები',
      'დასვით შეთანხმებული კითხვები, მოუსმინეთ და პასუხები ზარის შენიშვნებში ჩაწერეთ.',
    ]),
    step(4, ['Closing', 'Thank the customer, confirm the next step and pick a disposition.'], [
      'დასრულება',
      'მადლობა გადაუხადეთ მომხმარებელს, დააზუსტეთ შემდეგი ნაბიჯი და აირჩიეთ ზარის შედეგი.',
    ]),
  ]
}

/* ------------------------------------------------------------------- helpers */

const agentLinks = (campaignId: string) => store.data.campaignAgents.filter((link) => link.campaignId === campaignId)
const numbersOf = (campaignId: string) => store.data.numbers.filter((lead) => lead.campaignId === campaignId)

function touch(campaign: Campaign) {
  campaign.updatedAt = nowIso()
}

/** Keep the auto-dialer runtime in step with an AUTO campaign's lifecycle. */
function syncAutoRuntime(campaign: Campaign) {
  const runtime = store.data.autoDialer
  if (!runtime) return
  const existing = runtime.campaigns[campaign.id]
  const running = campaign.status === 'active' && campaign.dialingMode === 'AUTO'
  if (existing) {
    existing.isRunning = running
    existing.dialRatio = campaign.dialRatio
    existing.maxConcurrentCalls = campaign.maxConcurrentCalls
    existing.dialIntervalMs = campaign.dialIntervalMs
  } else if (campaign.dialingMode === 'AUTO') {
    runtime.campaigns[campaign.id] = {
      campaignId: campaign.id,
      isRunning: running,
      availableAgents: 0,
      dialRatio: campaign.dialRatio,
      target: 0,
      inFlight: 0,
      maxConcurrentCalls: campaign.maxConcurrentCalls,
      dialIntervalMs: campaign.dialIntervalMs,
      consecutiveErrors: 0,
      backoffUntil: null,
      lastDialAt: null,
      dialedThisSession: 0,
      abandonRate: 0,
    }
  }
}

const LIFECYCLE_SCOPES = ['campaigns', 'me', 'dialer', 'metrics', 'reports'] as const

function phoneFrom(row: Record<string, string>): string {
  for (const [key, value] of Object.entries(row)) {
    const k = key.toLowerCase().replace(/[^a-z]/g, '')
    if (k === 'phone' || k === 'phonenumber' || k === 'number') return String(value ?? '')
  }
  return ''
}

function nameFrom(row: Record<string, string>): string {
  for (const [key, value] of Object.entries(row)) {
    const k = key.toLowerCase().replace(/[^a-z]/g, '')
    if (k === 'name' || k === 'customername') return String(value ?? '').trim()
  }
  return ''
}

function insertLead(campaignId: string, phone: string, name: string, customData: Record<string, string>, instance: number, status: NumberStatus): CampaignNumber {
  const lead: CampaignNumber = {
    id: newId('num'),
    campaignId,
    phoneNumber: phone,
    customerName: name ? { en: name, ka: name } : null,
    customData,
    status,
    attempts: 0,
    lastAttemptAt: null,
    nextAttemptAt: null,
    lastDispositionCode: null,
    instanceNumber: instance,
    createdAt: nowIso(),
  }
  store.data.numbers.push(lead)
  return lead
}

function assertOpen(campaign: Campaign) {
  if (campaign.status === 'completed' || campaign.status === 'archived') throw new DemoApiError(400, CAMPAIGN_ERRORS.closed)
}

/* ---------------------------------------------------------------- register */

export function register(api: MockApi): void {
  api.register('GET', '/campaigns', ({ params }: { params: DemoParams }) => {
    guard()
    const q = lc((params.q ?? '').trim())
    const status = params.status && params.status !== 'all' ? params.status : null
    return store.data.campaigns
      .filter((c) => (status ? c.status === status : true))
      .filter((c) => (q ? lc(`${textOf(c.name)} ${textOf(c.clientName)}`).includes(q) : true))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(withStats) satisfies CampaignWithStats[]
  })

  api.register('POST', '/campaigns', ({ body }) => {
    const user = guard()
    const input = readCampaignInput((body ?? {}) as Input, false)
    const now = nowIso()
    const campaign: Campaign = {
      id: newId('cmp'),
      name: input.name!,
      clientName: input.clientName!,
      description: input.description!,
      status: 'draft',
      dialingMode: input.dialingMode!,
      callerId: input.callerId!,
      queueName: input.queueName ?? null,
      workingHoursStart: input.workingHoursStart!,
      workingHoursEnd: input.workingHoursEnd!,
      maxAttempts: input.maxAttempts!,
      retryDelayMinutes: input.retryDelayMinutes!,
      dialRatio: input.dialRatio!,
      maxConcurrentCalls: input.maxConcurrentCalls!,
      dialIntervalMs: input.dialIntervalMs!,
      script: defaultScript(),
      createdById: user.id,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
    }
    store.data.campaigns.push(campaign)
    syncAutoRuntime(campaign)
    changed('campaigns', 'metrics')
    return withStats(campaign)
  })

  api.register('GET', '/campaigns/:id', ({ path }) => {
    guard()
    return withStats(getCampaign(path.id))
  })

  api.register('PATCH', '/campaigns/:id', ({ path, body }) => {
    guard()
    const campaign = getCampaign(path.id)
    const input = readCampaignInput((body ?? {}) as Input, true, campaign)
    Object.assign(campaign, input)
    touch(campaign)
    syncAutoRuntime(campaign)
    changed(...LIFECYCLE_SCOPES)
    return withStats(campaign)
  })

  api.register('DELETE', '/campaigns/:id', ({ path }) => {
    guard()
    const campaign = getCampaign(path.id)
    if (campaign.status === 'active') throw new DemoApiError(400, CAMPAIGN_ERRORS.deleteActive)
    const hasHistory = store.data.calls.some((call) => call.campaignId === campaign.id)
    if (hasHistory) {
      campaign.status = 'archived'
      campaign.completedAt ??= nowIso()
      touch(campaign)
      syncAutoRuntime(campaign)
      changed(...LIFECYCLE_SCOPES)
      return { archived: true }
    }
    store.data.campaigns = store.data.campaigns.filter((c) => c.id !== campaign.id)
    store.data.numbers = store.data.numbers.filter((lead) => lead.campaignId !== campaign.id)
    store.data.campaignAgents = store.data.campaignAgents.filter((link) => link.campaignId !== campaign.id)
    if (store.data.autoDialer?.campaigns[campaign.id]) delete store.data.autoDialer.campaigns[campaign.id]
    for (const state of store.data.agentStates) if (state.currentCampaignId === campaign.id) state.currentCampaignId = null
    changed(...LIFECYCLE_SCOPES, 'numbers', 'agents')
    return { archived: false }
  })

  api.register('POST', '/campaigns/:id/start', ({ path }) => {
    guard()
    const campaign = getCampaign(path.id)
    if (campaign.status !== 'draft' && campaign.status !== 'paused') throw new DemoApiError(400, CAMPAIGN_ERRORS.startStatus)
    if (!numbersOf(campaign.id).some((lead) => lead.status === 'PENDING')) throw new DemoApiError(400, CAMPAIGN_ERRORS.noPending)
    if (agentLinks(campaign.id).length === 0) throw new DemoApiError(400, CAMPAIGN_ERRORS.noAgents)
    campaign.status = 'active'
    campaign.startedAt ??= nowIso()
    touch(campaign)
    syncAutoRuntime(campaign)
    changed(...LIFECYCLE_SCOPES)
    return withStats(campaign)
  })

  api.register('POST', '/campaigns/:id/pause', ({ path }) => {
    guard()
    const campaign = getCampaign(path.id)
    if (campaign.status !== 'active') throw new DemoApiError(400, CAMPAIGN_ERRORS.pauseStatus)
    campaign.status = 'paused'
    touch(campaign)
    syncAutoRuntime(campaign)
    changed(...LIFECYCLE_SCOPES)
    return withStats(campaign)
  })

  api.register('POST', '/campaigns/:id/stop', ({ path }) => {
    guard()
    const campaign = getCampaign(path.id)
    if (campaign.status === 'completed' || campaign.status === 'archived') throw new DemoApiError(400, CAMPAIGN_ERRORS.stopStatus)
    campaign.status = 'completed'
    campaign.completedAt = nowIso()
    touch(campaign)
    syncAutoRuntime(campaign)
    changed(...LIFECYCLE_SCOPES)
    return withStats(campaign)
  })

  /* ---------------------------------------------------------------- numbers */

  api.register('GET', '/campaigns/:id/numbers', ({ path, params }) => {
    guard()
    const campaign = getCampaign(path.id)
    const group = params.status && params.status !== 'all' ? params.status : null
    const statuses = group ? (NUMBER_GROUPS[group] ?? [group as NumberStatus]) : null
    const q = lc((params.q ?? '').trim())
    const qDigits = q.replace(/\D/g, '')
    return numbersOf(campaign.id)
      .filter((lead) => (statuses ? statuses.includes(lead.status) : true))
      .filter((lead) => {
        if (!q) return true
        if (qDigits.length >= 2 && lead.phoneNumber.replace(/\D/g, '').includes(qDigits)) return true
        return lc(textOf(lead.customerName)).includes(q)
      })
  })

  api.register('POST', '/campaigns/:id/numbers/import', ({ path, body }) => {
    guard()
    const campaign = getCampaign(path.id)
    assertOpen(campaign)
    const input = (body ?? {}) as { rows?: unknown; allowDuplicates?: unknown }
    const rows = Array.isArray(input.rows) ? (input.rows as Record<string, string>[]) : []
    if (rows.length === 0) throw new DemoApiError(400, CAMPAIGN_ERRORS.noRows)
    if (rows.length > MAX_IMPORT_ROWS) throw new DemoApiError(400, CAMPAIGN_ERRORS.tooManyRows)
    const allowDuplicates = input.allowDuplicates === true
    const counts = new Map<string, number>()
    for (const lead of numbersOf(campaign.id)) counts.set(lead.phoneNumber, Math.max(counts.get(lead.phoneNumber) ?? 0, lead.instanceNumber))
    const result: ImportResult = { inserted: 0, skipped: 0, duplicates: 0, dncMarked: 0, invalid: 0 }
    for (const raw of rows) {
      if (!raw || typeof raw !== 'object') {
        result.invalid++
        continue
      }
      const row: Record<string, string> = {}
      for (const [k, v] of Object.entries(raw)) row[k.trim().toLowerCase()] = String(v ?? '').trim()
      const phone = normalizePhone(phoneFrom(row))
      if (!phone) {
        result.invalid++
        continue
      }
      const existing = counts.get(phone) ?? 0
      if (existing > 0 && !allowDuplicates) {
        result.skipped++
        continue
      }
      const dnc = isOnDnc(phone)
      insertLead(campaign.id, phone, nameFrom(row), row, existing + 1, dnc ? 'DNC' : 'PENDING')
      counts.set(phone, existing + 1)
      if (existing > 0) result.duplicates++
      else result.inserted++
      if (dnc) result.dncMarked++
    }
    touch(campaign)
    changed('numbers', 'campaigns', 'metrics', 'dialer')
    return result
  })

  api.register('POST', '/campaigns/:id/numbers', ({ path, body }) => {
    guard()
    const campaign = getCampaign(path.id)
    assertOpen(campaign)
    const input = (body ?? {}) as { phoneNumber?: unknown; customerName?: unknown }
    const phone = normalizePhone(String(input.phoneNumber ?? ''))
    if (!phone) throw DemoApiError.validation({ phoneNumber: CAMPAIGN_ERRORS.invalidPhone })
    if (numbersOf(campaign.id).some((lead) => lead.phoneNumber === phone)) {
      throw DemoApiError.validation({ phoneNumber: CAMPAIGN_ERRORS.duplicateNumber })
    }
    const name = String(input.customerName ?? '').trim().slice(0, 100)
    const lead = insertLead(campaign.id, phone, name, name ? { name } : {}, 1, isOnDnc(phone) ? 'DNC' : 'PENDING')
    touch(campaign)
    changed('numbers', 'campaigns', 'metrics', 'dialer')
    return lead
  })

  api.register('DELETE', '/campaigns/:id/numbers', ({ path }) => {
    guard()
    const campaign = getCampaign(path.id)
    if (campaign.status === 'active') throw new DemoApiError(409, CAMPAIGN_ERRORS.clearActive)
    const before = store.data.numbers.length
    store.data.numbers = store.data.numbers.filter((lead) => lead.campaignId !== campaign.id || lead.status === 'DIALING')
    const deleted = before - store.data.numbers.length
    touch(campaign)
    changed('numbers', 'campaigns', 'metrics', 'dialer')
    return { deleted }
  })

  api.register('DELETE', '/campaigns/:id/numbers/:numberId', ({ path }) => {
    guard()
    const campaign = getCampaign(path.id)
    const lead = store.data.numbers.find((n) => n.id === path.numberId && n.campaignId === campaign.id)
    if (!lead) throw notFound('Number not found.')
    if (lead.status === 'DIALING' || lead.status === 'CONNECTED') throw conflict(CAMPAIGN_ERRORS.numberDialing)
    store.data.numbers = store.data.numbers.filter((n) => n.id !== lead.id)
    touch(campaign)
    changed('numbers', 'campaigns', 'metrics', 'dialer')
    return undefined
  })

  api.register('GET', '/campaigns/:id/duplicates', ({ path }) => {
    guard()
    const campaign = getCampaign(path.id)
    const byPhone = new Map<string, number>()
    for (const lead of numbersOf(campaign.id)) byPhone.set(lead.phoneNumber, (byPhone.get(lead.phoneNumber) ?? 0) + 1)
    return [...byPhone.entries()]
      .filter(([, instances]) => instances > 1)
      .map(([phoneNumber, instances]) => ({ phoneNumber, instances }))
      .sort((a, b) => b.instances - a.instances || a.phoneNumber.localeCompare(b.phoneNumber))
  })

  /* ----------------------------------------------------------------- agents */

  api.register('GET', '/campaigns/:id/agents', ({ path }) => {
    guard()
    const campaign = getCampaign(path.id)
    const ids = new Set(agentLinks(campaign.id).map((link) => link.agentId))
    return store.data.users.filter((user) => ids.has(user.id)) satisfies User[]
  })

  api.register('GET', '/campaigns/:id/assignable-agents', ({ path }) => {
    guard()
    getCampaign(path.id)
    return store.data.users.filter((user) => user.role === 'operator' && user.isActive)
  })

  api.register('PUT', '/campaigns/:id/agents', ({ path, body }) => {
    guard()
    const campaign = getCampaign(path.id)
    const raw = (body ?? {}) as { agentIds?: unknown }
    if (!Array.isArray(raw.agentIds)) throw DemoApiError.validation({ agentIds: 'A list of agents is required.' })
    const ids = [...new Set(raw.agentIds.map(String))]
    const valid = new Set(store.data.users.filter((u) => u.role === 'operator' && u.isActive).map((u) => u.id))
    const current = agentLinks(campaign.id)
    // Already-assigned agents may stay even if they were since deactivated.
    for (const id of ids) {
      if (!valid.has(id) && !current.some((link) => link.agentId === id)) throw DemoApiError.validation({ agentIds: CAMPAIGN_ERRORS.badAgent })
    }
    const now = nowIso()
    store.data.campaignAgents = [
      ...store.data.campaignAgents.filter((link) => link.campaignId !== campaign.id),
      ...ids.map((agentId) => current.find((link) => link.agentId === agentId) ?? { campaignId: campaign.id, agentId, assignedAt: now }),
    ]
    touch(campaign)
    changed('campaigns', 'me', 'agents', 'dialer', 'users')
    const set = new Set(ids)
    return store.data.users.filter((user) => set.has(user.id))
  })
}
