/**
 * Seed builder. `buildSeed(now)` is deterministic for a
 * given `now` (createRandom('dareke')) and generates every timestamp relative
 * to it, so each reset lands on today: ~440 calls over the last 30 days with
 * ~90 of them today, 753 leads whose statuses follow from that call history,
 * live calls for the fake agents on the wall, the DNC list and the feed.
 *
 * Ids: users `u_*`, statuses `st_*`, dispositions `disp_1..9`, campaigns
 * `cmp_1..7`, leads `num_1..`, calls `call_1..` (chronological), DNC `dnc_1..`,
 * state logs `log_1..`, feed events `evt_1..`. `store.nextId(prefix)` continues
 * past them.
 */
import { createRandom, type Random } from '@portfolio/demo-kit'

import type {
  AgentCurrentState,
  AgentStateLog,
  AutoDialerCampaignState,
  CallEvent,
  CallEventType,
  CallMode,
  CallOutcome,
  CallRecord,
  Campaign,
  CampaignAgent,
  CampaignNumber,
  DemoData,
  DncEntry,
  DncSource,
  LText,
  Localized,
  User,
} from '@/types'
import {
  AGENT_STATUSES,
  CAMPAIGN_DEFS,
  CAR_MODELS,
  CITIES,
  DISPOSITIONS,
  DNC_REASONS,
  FIBRE_PLANS,
  FIRST_NAMES,
  FLAT_INTERESTS,
  L,
  LOAN_TYPES,
  MOBILE_PLANS,
  NOTES,
  SURNAMES,
  USER_DEFS,
  WINE_TIERS,
  type CampaignDef,
} from './reference'

export { AGENT_STATUSES, CAMPAIGN_DEFS, DISPOSITIONS, USER_DEFS } from './reference'

/** Q.850 cause texts the CDR drawer shows next to the code. */
export const HANGUP_CAUSE_TEXT: Record<number, string> = {
  1: 'Unallocated (unassigned) number',
  16: 'Normal call clearing',
  17: 'User busy',
  18: 'No user responding',
  19: 'No answer from user (user alerted)',
  21: 'Call rejected',
  34: 'No circuit/channel available',
  41: 'Temporary failure',
}

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const iso = (ms: number): string => new Date(ms).toISOString()
const pad = (n: number): string => String(n).padStart(2, '0')
const ddmmyyyy = (ms: number): string => {
  const d = new Date(ms)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

/** Local midnight `daysAgo` days before `now`, plus h:m. */
function localDay(now: number, daysAgo: number, h = 0, m = 0): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

const isWeekday = (ms: number): boolean => {
  const day = new Date(ms).getDay()
  return day !== 0 && day !== 6
}

/** The window today's calls are spread over: 10:00 to now, or the 9 hours before now outside working time. */
export function todayWindow(now: number): { start: number; end: number } {
  const ten = localDay(now, 0, 10)
  const seven = localDay(now, 0, 19)
  const inHours = isWeekday(now) && now >= ten + HOUR && now <= seven
  return { start: inHours ? ten : now - 9 * HOUR, end: now - 15 * MIN }
}

/* ------------------------------------------------------------- generation */

/** The parts of a campaign the call generator reads (the static def or the dated row). */
type CampaignLike = Omit<Campaign, 'createdAt' | 'updatedAt' | 'startedAt' | 'completedAt'>

interface Person {
  phone: string
  name: Localized | null
}

interface Ctx {
  rnd: Random
  now: number
  users: Map<string, User>
  calls: CallRecord[]
  dnc: Array<Omit<DncEntry, 'id'>>
  dncPhones: Set<string>
}

const DISP = new Map(DISPOSITIONS.map((d) => [d.code, d]))

const MANUAL_OUTCOMES: ReadonlyArray<readonly [CallOutcome, number]> = [
  ['ANSWERED', 66],
  ['NO_ANSWER', 23],
  ['BUSY', 9],
  ['FAILED', 2],
]
const AUTO_OUTCOMES: ReadonlyArray<readonly [CallOutcome, number]> = [
  ['ANSWERED', 63],
  ['NO_ANSWER', 22],
  ['BUSY', 9],
  ['FAILED', 2],
  ['ABANDONED', 4],
]
const ANSWERED_CODES: ReadonlyArray<readonly [string, number]> = [
  ['SALE', 15],
  ['INTERESTED', 12],
  ['CALLBACK_LATER', 8],
  ['NOT_INTERESTED', 43],
  ['VOICEMAIL', 12],
  ['WRONG_NUMBER', 6],
  ['DNC', 4],
]

function buildPeople(rnd: Random, count: number): Person[] {
  const phones = new Set<string>()
  const names = new Set<string>()
  const people: Person[] = []
  while (people.length < count) {
    const phone = `+9955000${String(rnd.int(0, 99_999)).padStart(5, '0')}`
    if (phones.has(phone)) continue
    phones.add(phone)
    let first = rnd.pick(FIRST_NAMES)
    let last = rnd.pick(SURNAMES)
    for (let tries = 0; tries < 6 && names.has(`${first[0]} ${last[0]}`); tries += 1) {
      first = rnd.pick(FIRST_NAMES)
      last = rnd.pick(SURNAMES)
    }
    names.add(`${first[0]} ${last[0]}`)
    people.push({ phone, name: rnd.chance(0.04) ? null : L(`${first[0]} ${last[0]}`, `${first[1]} ${last[1]}`) })
  }
  return people
}

function customDataFor(slug: string, rnd: Random, now: number): Record<string, LText> {
  switch (slug) {
    case 'mobile_upgrade':
      return {
        city: rnd.pick(CITIES),
        currentPlan: rnd.pick(MOBILE_PLANS),
        monthlySpend: `${rnd.int(12, 65)} ₾`,
        contractEnds: ddmmyyyy(now + rnd.int(5, 120) * DAY),
      }
    case 'csat_survey':
      return { loanType: rnd.pick(LOAN_TYPES), lastPayment: ddmmyyyy(now - rnd.int(1, 60) * DAY), city: rnd.pick(CITIES) }
    case 'fibre_winback':
      return { previousPlan: rnd.pick(FIBRE_PLANS), leftOn: ddmmyyyy(now - rnd.int(10, 180) * DAY), city: rnd.pick(CITIES) }
    case 'car_renewal':
      return { carModel: rnd.pick(CAR_MODELS), policyExpires: ddmmyyyy(now + rnd.int(1, 30) * DAY) }
    case 'viewing_appointments':
      return { interest: rnd.pick(FLAT_INTERESTS), budget: `$${rnd.int(55, 240)} 000` }
    case 'wine_club':
      return { membershipTier: rnd.pick(WINE_TIERS), lastOrder: ddmmyyyy(now - rnd.int(100, 400) * DAY) }
    case 'delivery_confirm':
      return { orderNo: `SP-${rnd.int(24_000, 24_999)}`, deliveryDate: ddmmyyyy(now - rnd.int(20, 30) * DAY) }
    default:
      return {}
  }
}

/** A callback 1-4 weekdays after `from`, 11:00-17:30 on a quarter hour. */
function callbackSlot(rnd: Random, from: number): number {
  const d = new Date(from)
  d.setDate(d.getDate() + rnd.int(1, 4))
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  d.setHours(rnd.int(11, 17), rnd.pick([0, 15, 30, 45]), 0, 0)
  return d.getTime()
}

function addDnc(ctx: Ctx, phone: string, source: DncSource, addedById: string | null, at: number, reason?: string): void {
  if (ctx.dncPhones.has(phone)) return
  ctx.dncPhones.add(phone)
  ctx.dnc.push({
    phoneNumber: phone,
    reason: reason ?? (source === 'DISPOSITION' ? 'Customer asked not to be called again' : ctx.rnd.pick(DNC_REASONS)),
    source,
    addedById,
    createdAt: iso(at),
  })
}

/** Apply a finished call to its lead, the same way the runtime does (domain.applyDisposition / endCall). */
function settleLead(ctx: Ctx, campaign: CampaignLike, lead: CampaignNumber, call: CallRecord, endedAt: number, callbackAt: number | null): void {
  const disp = call.dispositionCode ? DISP.get(call.dispositionCode) : undefined
  if (call.dispositionCode) lead.lastDispositionCode = call.dispositionCode
  if (disp?.addToDnc) {
    lead.status = 'DNC'
    lead.nextAttemptAt = null
    addDnc(ctx, lead.phoneNumber, 'DISPOSITION', call.agentId, endedAt)
  } else if (disp?.scheduleCallback && callbackAt !== null) {
    lead.status = 'CALLBACK_SCHEDULED'
    lead.nextAttemptAt = iso(callbackAt)
  } else if (disp?.isFinal) {
    lead.status = 'COMPLETED'
    lead.nextAttemptAt = null
  } else if (lead.attempts >= campaign.maxAttempts) {
    lead.status = 'FAILED'
    lead.nextAttemptAt = null
  } else {
    lead.status = call.outcome === 'BUSY' || call.dispositionCode === 'BUSY' ? 'BUSY' : 'NO_ANSWER'
    lead.nextAttemptAt = iso(endedAt + campaign.retryDelayMinutes * MIN)
  }
}

interface CallOptions {
  agentId: string | null
  outcome?: CallOutcome
  code?: string | null
  ring?: number
  talk?: number
  hold?: number
  callbackAt?: number
}

/** A finished call at `t`, with plausible durations, cause and disposition. */
function placeCall(ctx: Ctx, campaign: CampaignLike, lead: CampaignNumber, t: number, options: CallOptions): CallRecord {
  const { rnd } = ctx
  const mode: CallMode = campaign.dialingMode === 'AUTO' ? 'AUTO' : 'MANUAL'
  const outcome = options.outcome ?? rnd.weighted(mode === 'AUTO' ? AUTO_OUTCOMES : MANUAL_OUTCOMES)
  const ring =
    options.ring ??
    (outcome === 'ANSWERED'
      ? rnd.int(4, 22)
      : outcome === 'NO_ANSWER'
        ? rnd.int(28, 45)
        : outcome === 'BUSY'
          ? rnd.int(1, 4)
          : outcome === 'FAILED'
            ? rnd.int(0, 2)
            : rnd.int(5, 15))
  const talk = outcome === 'ANSWERED' ? (options.talk ?? (rnd.chance(0.25) ? rnd.int(180, 420) : rnd.int(40, 180))) : 0
  const hold = outcome === 'ANSWERED' ? (options.hold ?? (rnd.chance(0.15) ? rnd.int(10, Math.min(90, talk - 20)) : 0)) : 0
  const abandonWait = outcome === 'ABANDONED' ? rnd.int(3, 12) : 0
  // An AUTO call reaches an agent only once a person answers.
  const agentId = mode === 'AUTO' && outcome !== 'ANSWERED' ? null : options.agentId
  const answeredAt = outcome === 'ANSWERED' || outcome === 'ABANDONED' ? t + ring * SEC : null
  const total = ring + talk + abandonWait
  const endedAt = t + total * SEC

  let code: string | null
  if (options.code !== undefined) code = options.code
  else if (outcome === 'ANSWERED') code = rnd.weighted(ANSWERED_CODES)
  else if (agentId && outcome === 'NO_ANSWER') code = 'NO_ANSWER'
  else if (agentId && outcome === 'BUSY') code = 'BUSY'
  else code = null

  const disp = code ? DISP.get(code) : undefined
  const notes = code ? NOTES[code] : undefined
  const note = notes && rnd.chance(0.55) ? rnd.pick(notes) : null
  const callbackAt = disp?.scheduleCallback ? (options.callbackAt ?? callbackSlot(rnd, endedAt)) : null
  const cause = outcome === 'ANSWERED' || outcome === 'ABANDONED' ? 16 : outcome === 'NO_ANSWER' ? 19 : outcome === 'BUSY' ? 17 : 34

  const call: CallRecord = {
    id: '',
    campaignId: campaign.id,
    campaignNumberId: lead.id,
    agentId,
    callerId: campaign.callerId,
    destinationNumber: lead.phoneNumber,
    customerName: lead.customerName,
    mode,
    outcome,
    callInitiatedAt: iso(t),
    callAnsweredAt: answeredAt === null ? null : iso(answeredAt),
    callEndedAt: iso(endedAt),
    ringDuration: ring,
    talkDuration: talk,
    holdDuration: hold,
    totalDuration: total,
    dispositionCode: code,
    dispositionNote: note,
    hangupCause: cause,
    hangupCauseText: HANGUP_CAUSE_TEXT[cause] ?? null,
    hangupBy: outcome === 'ANSWERED' ? (rnd.chance(0.5) ? 'AGENT' : 'CUSTOMER') : outcome === 'ABANDONED' ? 'CUSTOMER' : 'SYSTEM',
    recordingUrl: null,
    recordingDuration: null,
    callbackScheduledAt: callbackAt === null ? null : iso(callbackAt),
    callbackNote: callbackAt === null ? null : note,
  }
  ctx.calls.push(call)
  lead.attempts += 1
  lead.lastAttemptAt = iso(t)
  settleLead(ctx, campaign, lead, call, endedAt, callbackAt)
  return call
}

/** A call still in progress at `now` (backs a fake agent's "On call" tile). */
function liveCall(ctx: Ctx, campaign: CampaignLike, lead: CampaignNumber, agentId: string, initiated: number, answered: number | null): CallRecord {
  const call: CallRecord = {
    id: '',
    campaignId: campaign.id,
    campaignNumberId: lead.id,
    agentId,
    callerId: campaign.callerId,
    destinationNumber: lead.phoneNumber,
    customerName: lead.customerName,
    mode: campaign.dialingMode === 'AUTO' ? 'AUTO' : 'MANUAL',
    outcome: 'IN_PROGRESS',
    callInitiatedAt: iso(initiated),
    callAnsweredAt: answered === null ? null : iso(answered),
    callEndedAt: null,
    ringDuration: answered === null ? 0 : Math.round((answered - initiated) / SEC),
    talkDuration: 0,
    holdDuration: 0,
    totalDuration: 0,
    dispositionCode: null,
    dispositionNote: null,
    hangupCause: null,
    hangupCauseText: null,
    hangupBy: null,
    recordingUrl: null,
    recordingDuration: null,
    callbackScheduledAt: null,
    callbackNote: null,
  }
  ctx.calls.push(call)
  lead.attempts += 1
  lead.lastAttemptAt = iso(initiated)
  lead.nextAttemptAt = null
  lead.status = answered === null ? 'DIALING' : 'CONNECTED'
  return call
}

function pastTimes(rnd: Random, now: number, fromDaysAgo: number, toDaysAgo: number, count: number): number[] {
  const days: number[] = []
  for (let ago = Math.max(1, toDaysAgo); ago <= fromDaysAgo; ago += 1) if (isWeekday(localDay(now, ago, 12))) days.push(ago)
  if (days.length === 0) return []
  const times: number[] = []
  for (let i = 0; i < count; i += 1) {
    times.push(localDay(now, rnd.pick(days), 10) + rnd.int(0, 9 * 60 - 10) * MIN + rnd.int(0, 59) * SEC)
  }
  return times.sort((a, b) => a - b)
}

function windowTimes(rnd: Random, start: number, end: number, count: number): number[] {
  const times: number[] = []
  for (let i = 0; i < count; i += 1) times.push(start + Math.floor(rnd.next() * Math.max(1, end - start)))
  return times.sort((a, b) => a - b)
}

/** Run a campaign's call history slot by slot, picking leads the way the dialer would. */
function simulate(
  ctx: Ctx,
  def: CampaignDef,
  leads: CampaignNumber[],
  times: number[],
  state: { freshUsed: number; cursor: number },
  freshCap: number,
  preferFresh: boolean,
  agentFor: (t: number, auto: boolean) => string | null,
): void {
  const { rnd } = ctx
  const campaign = def.campaign
  const due = (lead: CampaignNumber, t: number) => lead.nextAttemptAt !== null && Date.parse(lead.nextAttemptAt) <= t

  const nextFresh = (): CampaignNumber | null => {
    while (state.freshUsed < freshCap && state.cursor < leads.length) {
      const lead = leads[state.cursor]
      state.cursor += 1
      if (!lead || lead.status !== 'PENDING' || lead.instanceNumber > 1) continue
      if (ctx.dncPhones.has(lead.phoneNumber)) {
        lead.status = 'DNC' // the dialer's DNC skip
        continue
      }
      state.freshUsed += 1
      return lead
    }
    return null
  }

  for (const t of times) {
    const callbacks = leads.filter((lead) => lead.status === 'CALLBACK_SCHEDULED' && due(lead, t))
    const retries = leads.filter(
      (lead) => (lead.status === 'NO_ANSWER' || lead.status === 'BUSY') && lead.attempts < campaign.maxAttempts && due(lead, t),
    )
    let lead: CampaignNumber | null = null
    if (callbacks.length > 0 && rnd.chance(0.7)) lead = callbacks[0] ?? null
    if (!lead && retries.length > 0 && (state.freshUsed >= freshCap || (!preferFresh && rnd.chance(0.35)))) lead = retries[0] ?? null
    if (!lead) lead = nextFresh()
    if (!lead) lead = retries[0] ?? callbacks[0] ?? null
    if (!lead) continue
    placeCall(ctx, campaign, lead, t, { agentId: agentFor(t, campaign.dialingMode === 'AUTO') })
  }
}

/* --------------------------------------------------------------- buildSeed */

export function buildSeed(now: number = Date.now()): DemoData {
  const rnd = createRandom('dareke')

  /* users */
  const users: User[] = USER_DEFS.map((def) => ({
    id: def.id,
    username: def.username,
    displayName: def.name,
    email: `${def.id.slice(2)}@dareke.example`,
    role: def.role,
    sipExtension: def.ext,
    isActive: def.active,
    createdAt: iso(localDay(now, def.createdDaysAgo, 9, 30)),
    lastLoginAt: def.active ? iso(now - rnd.int(25, 280) * MIN) : iso(localDay(now, 41, 9, 12)),
  }))
  const userById = new Map(users.map((user) => [user.id, user]))

  const ctx: Ctx = { rnd, now, users: userById, calls: [], dnc: [], dncPhones: new Set() }

  /* campaigns + agents */
  const campaigns: Campaign[] = CAMPAIGN_DEFS.map((def) => ({
    ...def.campaign,
    createdAt: iso(localDay(now, def.createdDaysAgo, 10, 30)),
    updatedAt: iso(localDay(now, def.updatedDaysAgo, 17, 10)),
    startedAt: def.startedDaysAgo === null ? null : iso(localDay(now, def.startedDaysAgo, 9, 55)),
    completedAt: def.completedDaysAgo === null ? null : iso(localDay(now, def.completedDaysAgo, 18, 40)),
  }))
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]))

  const campaignAgents: CampaignAgent[] = []
  for (const def of CAMPAIGN_DEFS) {
    const created = localDay(now, def.createdDaysAgo, 10, 30)
    def.agents.forEach((agentId, index) => {
      const joined = Date.parse(userById.get(agentId)?.createdAt ?? iso(created))
      campaignAgents.push({ campaignId: def.campaign.id, agentId, assignedAt: iso(Math.max(created, joined) + HOUR + index * 2 * MIN) })
    })
  }

  /* leads */
  const people = buildPeople(rnd, 640)
  const numbers: CampaignNumber[] = []
  const leadsByCampaign = new Map<string, CampaignNumber[]>()
  let numberSeq = 0
  for (const def of CAMPAIGN_DEFS) {
    const created = localDay(now, def.createdDaysAgo, 10, 30)
    const picked = rnd.shuffle(people).slice(0, def.leads)
    const leads = picked.map((person, index): CampaignNumber => {
      numberSeq += 1
      const batch = index < Math.round(def.leads * 0.85) ? 2 * HOUR : 20 * HOUR
      return {
        id: `num_${numberSeq}`,
        campaignId: def.campaign.id,
        phoneNumber: person.phone,
        customerName: person.name,
        customData: customDataFor(def.slug, rnd, now),
        status: 'PENDING',
        attempts: 0,
        lastAttemptAt: null,
        nextAttemptAt: null,
        lastDispositionCode: null,
        instanceNumber: 1,
        createdAt: iso(created + batch + index * SEC),
      }
    })
    if (def.campaign.id === 'cmp_1') {
      // Three intentional duplicates, imported later with "Allow duplicates".
      for (const index of [5, 17, 40]) {
        const original = leads[index]
        if (!original) continue
        numberSeq += 1
        leads.push({
          ...original,
          id: `num_${numberSeq}`,
          customData: { ...original.customData },
          instanceNumber: 2,
          createdAt: iso(created + 3 * DAY + index * SEC),
        })
      }
    }
    leadsByCampaign.set(def.campaign.id, leads)
    numbers.push(...leads)
  }

  /* call history, oldest campaigns first so their DNC hits are skipped later */
  const cursors = new Map<string, { freshUsed: number; cursor: number }>()
  const agentPicker = (def: CampaignDef, mariamWeight: number) => (t: number, auto: boolean): string | null => {
    const pool = def.agents.filter((id) => {
      const user = userById.get(id)
      if (!user || Date.parse(user.createdAt) > t) return false
      return !auto || user.sipExtension !== null
    })
    if (pool.length === 0) return null
    return rnd.weighted(pool.map((id) => [id, id === 'u_mariam' ? mariamWeight : 1] as const))
  }
  const today = todayWindow(now)
  for (const id of ['cmp_7', 'cmp_6', 'cmp_4', 'cmp_1', 'cmp_2', 'cmp_3']) {
    const def = CAMPAIGN_DEFS.find((candidate) => candidate.campaign.id === id)
    const leads = leadsByCampaign.get(id)
    if (!def || !leads) continue
    const finished = def.campaign.status === 'completed' || def.campaign.status === 'archived'
    const freshCap = finished ? def.leads : def.campaign.status === 'active' ? def.leads - 90 : Math.round(def.leads * 0.45)
    const state = { freshUsed: 0, cursor: 0 }
    cursors.set(id, state)
    if (def.history) {
      const times = pastTimes(rnd, now, def.history.fromDaysAgo, def.history.toDaysAgo, def.history.calls)
      simulate(ctx, def, leads, times, state, freshCap, finished, agentPicker(def, 1))
    }
    if (def.todayCalls > 0) {
      const times = windowTimes(rnd, today.start, today.end, def.todayCalls)
      simulate(ctx, def, leads, times, state, freshCap, false, agentPicker(def, 3))
    }
    if (finished) {
      // A stopped campaign leaves nothing open.
      for (const lead of leads) {
        if (lead.status === 'CALLBACK_SCHEDULED') lead.status = 'COMPLETED'
        else if (lead.status === 'NO_ANSWER' || lead.status === 'BUSY' || (lead.status === 'PENDING' && lead.attempts > 0)) lead.status = 'FAILED'
        else if (lead.status === 'PENDING') lead.status = 'FAILED'
        lead.nextAttemptAt = null
      }
    }
  }

  /* the last few minutes: live calls and fresh endings the wall and feed show at boot */
  const fresh = (campaignId: string): CampaignNumber => {
    const leads = leadsByCampaign.get(campaignId) ?? []
    const lead = leads.find((candidate) => candidate.status === 'PENDING' && candidate.instanceNumber === 1 && !ctx.dncPhones.has(candidate.phoneNumber))
    if (!lead) throw new Error(`seed: ${campaignId} ran out of fresh leads`)
    return lead
  }
  const cmp = (id: string): Campaign => {
    const campaign = campaignById.get(id)
    if (!campaign) throw new Error(`seed: unknown campaign ${id}`)
    return campaign
  }
  placeCall(ctx, cmp('cmp_1'), fresh('cmp_1'), now - 17 * MIN, { agentId: 'u_mariam', outcome: 'ANSWERED', code: 'SALE', ring: 7, talk: 384, hold: 0 })
  placeCall(ctx, cmp('cmp_1'), fresh('cmp_1'), now - 430 * SEC, { agentId: 'u_elene', outcome: 'ANSWERED', code: 'CALLBACK_LATER', ring: 9, talk: 95, hold: 0 })
  placeCall(ctx, cmp('cmp_2'), fresh('cmp_2'), now - 220 * SEC, { agentId: 'u_davit', outcome: 'ANSWERED', code: 'NOT_INTERESTED', ring: 6, talk: 205, hold: 0 })
  placeCall(ctx, cmp('cmp_3'), fresh('cmp_3'), now - 125 * SEC, { agentId: null, outcome: 'NO_ANSWER', ring: 38 })
  placeCall(ctx, cmp('cmp_2'), fresh('cmp_2'), now - 72 * SEC, { agentId: null, outcome: 'BUSY', ring: 2 })
  const liveGiorgi = liveCall(ctx, cmp('cmp_1'), fresh('cmp_1'), 'u_giorgi', now - 108 * SEC, now - 102 * SEC)
  const liveSalome = liveCall(ctx, cmp('cmp_3'), fresh('cmp_3'), 'u_salome', now - 3 * SEC, null)
  const liveIrakli = liveCall(ctx, cmp('cmp_2'), fresh('cmp_2'), 'u_irakli', now - 55 * SEC, now - 48 * SEC)
  const liveLuka = liveCall(ctx, cmp('cmp_3'), fresh('cmp_3'), 'u_luka', now - 198 * SEC, now - 190 * SEC)

  /* callbacks due today in the MANUAL campaign: two already due, two later today */
  const cmp1Leads = leadsByCampaign.get('cmp_1') ?? []
  const callbackLeads = cmp1Leads
    .filter((lead) => lead.status === 'CALLBACK_SCHEDULED' && lead.lastAttemptAt !== null && Date.parse(lead.lastAttemptAt) < now - 3 * HOUR)
    .slice(0, 4)
  const callbackOffsets = [-50 * MIN, -12 * MIN, 75 * MIN, 150 * MIN]
  callbackLeads.forEach((lead, index) => {
    const at = iso(now + (callbackOffsets[index] ?? 0))
    lead.nextAttemptAt = at
    const scheduling = [...ctx.calls].reverse().find((call) => call.campaignNumberId === lead.id && call.callbackScheduledAt !== null)
    if (scheduling) scheduling.callbackScheduledAt = at
  })

  /* DNC: two PENDING leads each in cmp_1 / cmp_2 (the DNC skip), then manual, imported and customer-request entries */
  for (const campaignId of ['cmp_1', 'cmp_2']) {
    const pending = (leadsByCampaign.get(campaignId) ?? []).filter(
      (lead) => lead.status === 'PENDING' && lead.instanceNumber === 1 && !ctx.dncPhones.has(lead.phoneNumber),
    )
    const [first, second] = pending
    if (first) addDnc(ctx, first.phoneNumber, 'CUSTOMER_REQUEST', rnd.pick(['u_giorgi', 'u_irakli', 'u_ana']), now - rnd.int(2, 6) * DAY)
    if (second) addDnc(ctx, second.phoneNumber, 'MANUAL', 'u_tamar', now - rnd.int(1, 4) * DAY)
  }
  const usedPhones = new Set(numbers.map((lead) => lead.phoneNumber))
  while (ctx.dnc.length < 25) {
    const phone = `+9955000${String(rnd.int(0, 99_999)).padStart(5, '0')}`
    if (usedPhones.has(phone) || ctx.dncPhones.has(phone)) continue
    const source = rnd.weighted<DncSource>([
      ['IMPORT', 4],
      ['MANUAL', 3],
      ['CUSTOMER_REQUEST', 3],
    ])
    const addedBy = source === 'CUSTOMER_REQUEST' ? rnd.pick(['u_mariam', 'u_giorgi', 'u_salome', 'u_davit', 'u_luka']) : 'u_tamar'
    addDnc(ctx, phone, source, addedBy, now - rnd.int(5, 90) * DAY - rnd.int(0, 8 * 60) * MIN)
  }
  const dnc: DncEntry[] = ctx.dnc
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((entry, index) => ({ id: `dnc_${index + 1}`, ...entry }))

  /* calls: chronological ids */
  const calls = ctx.calls.sort((a, b) => Date.parse(a.callInitiatedAt) - Date.parse(b.callInitiatedAt))
  calls.forEach((call, index) => {
    call.id = `call_${index + 1}`
  })

  /* agent states, one open log each */
  const stateDefs: Array<[string, string, string | null, number, CallRecord | null]> = [
    ['u_mariam', 'st_available', 'cmp_1', 4 * MIN, null],
    ['u_giorgi', 'st_on_call', 'cmp_1', 108 * SEC, liveGiorgi],
    ['u_salome', 'st_on_call', 'cmp_3', 3 * SEC, liveSalome],
    ['u_irakli', 'st_on_call', 'cmp_2', 55 * SEC, liveIrakli],
    ['u_luka', 'st_on_call', 'cmp_3', 198 * SEC, liveLuka],
    ['u_davit', 'st_wrap_up', 'cmp_2', 8 * SEC, null],
    ['u_ana', 'st_break', 'cmp_3', 12 * MIN, null],
    ['u_elene', 'st_available', 'cmp_1', 5 * MIN, null],
    ['u_beka', 'st_offline', null, 41 * DAY, null],
  ]
  const previous: Record<string, string> = { st_available: 'st_wrap_up', st_on_call: 'st_available', st_wrap_up: 'st_on_call', st_break: 'st_available', st_offline: 'st_available' }
  const agentStates: AgentCurrentState[] = []
  const agentStateLogs: AgentStateLog[] = []
  stateDefs.forEach(([agentId, statusId, campaignId, since, call], index) => {
    const stateSince = iso(now - since)
    agentStates.push({
      agentId,
      statusId,
      stateSince,
      currentCallId: call?.id ?? null,
      currentCampaignId: campaignId,
      callPhase: call ? (call.callAnsweredAt ? 'answered' : 'ringing') : null,
    })
    agentStateLogs.push({
      id: `log_${index + 1}`,
      agentId,
      statusId,
      previousStatusId: previous[statusId] ?? null,
      startedAt: stateSince,
      endedAt: null,
      campaignId,
      callRecordId: call?.id ?? null,
    })
  })

  /* the live feed: the newest 30 events of today's calls */
  const nameOf = (id: string | null) => (id ? (userById.get(id)?.displayName ?? null) : null)
  const raw: Array<Omit<CallEvent, 'id'>> = []
  const push = (call: CallRecord, event: CallEventType, at: number, withCause: boolean) => {
    if (at > now) return
    raw.push({
      callId: call.id,
      agentId: call.agentId,
      agentName: nameOf(call.agentId),
      phoneNumber: call.destinationNumber,
      customerName: call.customerName,
      campaignId: call.campaignId,
      event,
      cause: withCause ? call.hangupCause : null,
      causeText: withCause ? call.hangupCauseText : null,
      timestamp: iso(at),
    })
  }
  for (const call of calls) {
    const started = Date.parse(call.callInitiatedAt)
    if (started < now - 3 * HOUR) continue
    push(call, 'ringing', started, false)
    const answered = call.callAnsweredAt ? Date.parse(call.callAnsweredAt) : null
    const ended = call.callEndedAt ? Date.parse(call.callEndedAt) : null
    if (call.outcome === 'ANSWERED' || call.outcome === 'IN_PROGRESS') {
      if (answered !== null) push(call, 'answered', answered, false)
      if (answered !== null && call.holdDuration > 0) {
        push(call, 'hold', answered + 20 * SEC, false)
        push(call, 'unhold', answered + (20 + call.holdDuration) * SEC, false)
      }
      if (ended !== null) push(call, 'ended', ended, true)
    } else if (ended !== null) {
      const event: CallEventType =
        call.outcome === 'NO_ANSWER' ? 'no_answer' : call.outcome === 'BUSY' ? 'busy' : call.outcome === 'ABANDONED' ? 'abandoned' : 'ended'
      push(call, event, ended, true)
    }
  }
  const callEvents: CallEvent[] = raw
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .map((event, index) => ({ id: `evt_${index + 1}`, ...event }))
    .reverse()
    .slice(0, 30)

  /* auto-dialer runtime */
  const dayStart = localDay(now, 0)
  const autoState = (campaignId: string, isRunning: boolean): AutoDialerCampaignState => {
    const campaign = cmp(campaignId)
    const available = agentStates.filter((state) => {
      const user = userById.get(state.agentId)
      return (
        state.statusId === 'st_available' &&
        state.currentCampaignId === campaignId &&
        !state.currentCallId &&
        user?.isActive === true &&
        user.sipExtension !== null &&
        campaignAgents.some((link) => link.campaignId === campaignId && link.agentId === state.agentId)
      )
    }).length
    const todays = calls.filter((call) => call.campaignId === campaignId && call.mode === 'AUTO' && Date.parse(call.callInitiatedAt) >= dayStart)
    const abandoned = todays.filter((call) => call.outcome === 'ABANDONED').length
    const reached = todays.filter((call) => call.outcome === 'ANSWERED' || call.outcome === 'ABANDONED').length
    const last = todays[todays.length - 1]
    return {
      campaignId,
      isRunning,
      availableAgents: available,
      dialRatio: campaign.dialRatio,
      target: Math.floor(available * campaign.dialRatio),
      inFlight: numbers.filter((lead) => lead.campaignId === campaignId && (lead.status === 'DIALING' || lead.status === 'CONNECTED')).length,
      maxConcurrentCalls: campaign.maxConcurrentCalls,
      dialIntervalMs: campaign.dialIntervalMs,
      consecutiveErrors: 0,
      backoffUntil: null,
      lastDialAt: isRunning && last ? last.callInitiatedAt : null,
      dialedThisSession: 0,
      abandonRate: reached === 0 ? 0 : Math.round((abandoned / reached) * 1000) / 10,
    }
  }

  return {
    users,
    agentStatuses: AGENT_STATUSES.map((status) => ({ ...status, displayName: { ...status.displayName } })),
    dispositions: DISPOSITIONS.map((disposition) => ({ ...disposition })),
    campaigns,
    campaignAgents,
    numbers,
    calls,
    dnc,
    agentStates,
    agentStateLogs,
    callEvents,
    settings: {
      dialer: { baseDialRatio: 1.2, maxDialRatio: 2.5, minDialRatio: 1, targetAbandonRate: 3 },
      wrapup: { defaultWrapupTime: 30, maxWrapupTime: 120 },
      workingHours: { startTime: '10:00', endTime: '19:00', workingDays: [1, 2, 3, 4, 5] },
    },
    systemConfig: {
      app: {
        port: 3000,
        host: '0.0.0.0',
        jwtExpiresIn: '8h',
        corsOrigin: 'https://dialer.demo.local',
        recordingsPath: '/var/spool/recordings',
        dialerMockMode: true,
      },
      client: {
        apiUrl: 'https://dialer.demo.local/api',
        wsUrl: 'wss://dialer.demo.local/ws',
        webrtcEnabled: true,
        sipWssUrl: 'wss://pbx.demo.local:8089/ws',
        sipDomain: 'pbx.demo.local',
        iceServers: 'stun:stun.demo.local:3478',
        useMockData: true,
      },
      pbx: { host: 'pbx.demo.local', port: 5038, username: 'demo_ami', secretSet: true, trunk: 'demo_trunk', context: 'from-internal', enabled: true },
      ldap: {
        url: 'ldap://dc.demo.local:389',
        bindDn: 'CN=svc-dareke,OU=Service,DC=ezo,DC=demo,DC=local',
        bindPasswordSet: true,
        baseDn: 'DC=ezo,DC=demo,DC=local',
        userSearchFilter: '(sAMAccountName={{username}})',
        enabled: false,
      },
      updatedAt: iso(localDay(now, 6, 15, 20)),
      updatedById: 'u_nino',
    },
    autoDialer: {
      enabled: true,
      campaigns: {
        cmp_2: autoState('cmp_2', true),
        cmp_3: autoState('cmp_3', true),
        cmp_4: autoState('cmp_4', false),
      },
    },
  }
}
