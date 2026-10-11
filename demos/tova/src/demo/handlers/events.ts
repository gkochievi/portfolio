/**
 * Owner: group events (see PLAN.md). Endpoints:
 *   GET /admin/dashboard, GET /admin/events, POST /admin/events, GET /admin/events/:eventId,
 *   PATCH /admin/events/:eventId, DELETE /admin/events/:eventId
 *
 * Import store/bus from '../store', guards from '../guards', selectors from
 * '../selectors'. Never import from '@/demo' (circular).
 */
import { DemoApiError, type MockApi } from '@portfolio/demo-kit'

import type { DashboardSummary, Difficulty, EventSummary, GameEvent, SpeedLevel } from '@/types'
import { requireEditor, requireStaff } from '../guards'
import { activeEvent, eventStatus } from '../selectors'
import { bus, nowIso, store } from '../store'

/** Dashboard payload: the shared contract plus the live event's latest round (display only). */
export type DashboardData = DashboardSummary & { lastPlayAt: string | null }

/** Defaults for a new event, as in the source's create handler (board size per the plan). */
const DEFAULTS = {
  durationSeconds: 60,
  maxGood: 4000,
  maxBad: 2000,
  difficulty: 'normal' as Difficulty,
  speedLevel: 1 as SpeedLevel,
  leaderboardSize: 10,
}

export const EVENT_LIMITS = {
  durationMin: 10,
  durationMax: 600,
  capMax: 100_000,
  boardMin: 1,
  boardMax: 100,
  nameMax: 120,
}

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard']

/** The fields a PATCH may touch (the source's whitelist). */
const PATCHABLE = [
  'name',
  'startsAt',
  'endsAt',
  'durationSeconds',
  'maxGood',
  'maxBad',
  'difficulty',
  'speedLevel',
  'leaderboardSize',
  'published',
  'awardsVisible',
  'leaderboardVisible',
] as const satisfies readonly (keyof GameEvent)[]

type FieldErrors = Record<string, string>

export function summarize(event: GameEvent, now: number = Date.now()): EventSummary {
  const db = store.data
  return {
    ...event,
    status: eventStatus(event, now),
    itemCount: db.items.filter((item) => item.eventId === event.id).length,
    prizeCount: db.prizes.filter((prize) => prize.eventId === event.id).length,
    triviaCount: db.questions.filter((question) => question.eventId === event.id).length,
    playCount: db.plays.filter((play) => play.eventId === event.id).length,
  }
}

function findEvent(eventId: string): GameEvent {
  const event = store.data.events.find((candidate) => candidate.id === eventId)
  if (!event) throw new DemoApiError(404, 'events:errors.notFound')
  return event
}

const asRecord = (body: unknown): Record<string, unknown> =>
  body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {}

function parseInteger(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) ? n : null
}

function parseDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

/** Validate a (partial) event input against the merged result; collects field errors as i18n keys. */
function validate(input: Record<string, unknown>, base: GameEvent | null): Partial<GameEvent> {
  const errors: FieldErrors = {}
  const out: Partial<GameEvent> = {}
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key)

  if (has('name') || !base) {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name) errors.name = 'events:errors.nameRequired'
    else if (name.length > EVENT_LIMITS.nameMax) errors.name = 'events:errors.nameTooLong'
    else out.name = name
  }
  if (has('durationSeconds')) {
    const n = parseInteger(input.durationSeconds)
    if (n === null || n < EVENT_LIMITS.durationMin || n > EVENT_LIMITS.durationMax) errors.durationSeconds = 'events:errors.duration'
    else out.durationSeconds = n
  }
  for (const key of ['startsAt', 'endsAt'] as const) {
    if (has(key) || !base) {
      const iso = parseDate(input[key])
      if (!iso) errors[key] = 'events:errors.dateInvalid'
      else out[key] = iso
    }
  }
  for (const key of ['maxGood', 'maxBad'] as const) {
    if (has(key)) {
      const n = parseInteger(input[key])
      if (n === null || n <= 0 || n > EVENT_LIMITS.capMax) errors[key] = 'events:errors.capPositive'
      else out[key] = n
    }
  }
  if (has('difficulty')) {
    if (!DIFFICULTIES.includes(input.difficulty as Difficulty)) errors.difficulty = 'events:errors.difficulty'
    else out.difficulty = input.difficulty as Difficulty
  }
  if (has('speedLevel')) {
    const n = parseInteger(input.speedLevel)
    if (n !== 1 && n !== 2 && n !== 3) errors.speedLevel = 'events:errors.speedLevel'
    else out.speedLevel = n
  }
  if (has('leaderboardSize')) {
    const n = parseInteger(input.leaderboardSize)
    if (n === null || n < EVENT_LIMITS.boardMin || n > EVENT_LIMITS.boardMax) errors.leaderboardSize = 'events:errors.boardSize'
    else out.leaderboardSize = n
  }
  for (const key of ['published', 'awardsVisible', 'leaderboardVisible'] as const) {
    if (has(key)) {
      if (typeof input[key] !== 'boolean') errors[key] = 'common:errors.validation'
      else out[key] = input[key] as boolean
    }
  }

  const startsAt = out.startsAt ?? base?.startsAt
  const endsAt = out.endsAt ?? base?.endsAt
  if (startsAt && endsAt && !errors.startsAt && !errors.endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    errors.endsAt = 'events:errors.endBeforeStart'
  }

  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)
  return out
}

function changed(eventId: string): void {
  store.notify()
  bus.emit('event:changed', { eventId })
}

export function registerEvents(api: MockApi): void {
  api.register('GET', '/admin/dashboard', (): DashboardData => {
    requireStaff()
    const db = store.data
    const now = Date.now()
    const live = activeEvent(db, now)
    let lastPlayAt: string | null = null
    if (live) {
      for (const play of db.plays) {
        if (play.eventId === live.id && (!lastPlayAt || play.playedAt > lastPlayAt)) lastPlayAt = play.playedAt
      }
    }
    return {
      players: db.users.filter((user) => user.role === 'PLAYER').length,
      plays: db.plays.length,
      activeEvent: live ? summarize(live, now) : null,
      lastPlayAt,
    }
  })

  api.register('GET', '/admin/events', (): EventSummary[] => {
    requireStaff()
    const now = Date.now()
    return store.data.events
      .map((event) => summarize(event, now))
      .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
  })

  api.register('POST', '/admin/events', ({ body }): EventSummary => {
    requireEditor()
    const input = asRecord(body)
    const parsed = validate(
      { durationSeconds: DEFAULTS.durationSeconds, ...input },
      null,
    )
    const now = nowIso()
    const event: GameEvent = {
      id: store.nextId('evt_'),
      name: parsed.name ?? '',
      startsAt: parsed.startsAt ?? now,
      endsAt: parsed.endsAt ?? now,
      durationSeconds: parsed.durationSeconds ?? DEFAULTS.durationSeconds,
      maxGood: DEFAULTS.maxGood,
      maxBad: DEFAULTS.maxBad,
      difficulty: DEFAULTS.difficulty,
      speedLevel: DEFAULTS.speedLevel,
      leaderboardSize: DEFAULTS.leaderboardSize,
      published: false,
      awardsVisible: false,
      leaderboardVisible: false,
      notifiedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    store.data.events.push(event)
    changed(event.id)
    return summarize(event)
  })

  api.register('GET', '/admin/events/:eventId', ({ path }): EventSummary => {
    requireStaff()
    return summarize(findEvent(path.eventId))
  })

  api.register('PATCH', '/admin/events/:eventId', ({ path, body }): EventSummary => {
    requireEditor()
    const event = findEvent(path.eventId)
    const input = asRecord(body)
    const whitelisted: Record<string, unknown> = {}
    for (const key of PATCHABLE) if (key in input) whitelisted[key] = input[key]
    const patch = validate(whitelisted, event)
    Object.assign(event, patch, { updatedAt: nowIso() })
    changed(event.id)
    return summarize(event)
  })

  api.register('DELETE', '/admin/events/:eventId', ({ path }): { ok: true } => {
    requireEditor()
    const event = findEvent(path.eventId)
    const db = store.data
    const questionIds = new Set(db.questions.filter((q) => q.eventId === event.id).map((q) => q.id))
    db.items = db.items.filter((item) => item.eventId !== event.id)
    db.prizes = db.prizes.filter((prize) => prize.eventId !== event.id)
    db.questions = db.questions.filter((q) => q.eventId !== event.id)
    db.answers = db.answers.filter((answer) => !questionIds.has(answer.questionId))
    for (const play of db.plays) if (play.eventId === event.id) play.eventId = null
    db.events = db.events.filter((candidate) => candidate.id !== event.id)
    changed(event.id)
    return { ok: true }
  })
}
