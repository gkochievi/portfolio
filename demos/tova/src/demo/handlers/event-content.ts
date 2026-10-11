/**
 * Owner: group event-content (see PLAN.md). Endpoints:
 *   GET|POST /admin/events/:eventId/items, PATCH|DELETE /admin/items/:itemId, POST /admin/uploads,
 *   GET|POST /admin/events/:eventId/trivia, PATCH|DELETE /admin/trivia/:questionId,
 *   GET|POST /admin/events/:eventId/prizes, PATCH|DELETE /admin/prizes/:prizeId
 *
 * GETs are staff, writes are editor. Every write calls `store.notify()` and
 * emits `event:changed`. Errors are i18n keys in the `content` namespace.
 */
import { DemoApiError, type MockApi } from '@portfolio/demo-kit'

import type { GameEvent, Item, ItemType, Prize, TriviaQuestion } from '@/types'
import { requireEditor, requireStaff } from '../guards'
import { bus, nowIso, store } from '../store'

const ITEM_TYPES: readonly ItemType[] = ['GOOD', 'MINOR', 'MAJOR']

/** Placeholder art handed out by POST /admin/uploads, in rotation. */
const UPLOAD_PLACEHOLDERS = [1, 2, 3, 4].map((n) => `media/uploads/upload-${n}.svg`)
let uploadCursor = 0

type Body = Record<string, unknown>
type Errors = Record<string, string>

const asBody = (body: unknown): Body => (body && typeof body === 'object' ? (body as Body) : {})
const has = (body: Body, key: string) => Object.prototype.hasOwnProperty.call(body, key)
const str = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value))
const nullableStr = (value: unknown): string | null => {
  const s = str(value).trim()
  return s ? s : null
}
const int = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') return Number(value)
  return Number.NaN
}
const isIntIn = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max

function fail(errors: Errors): void {
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
}

function findEvent(eventId: string): GameEvent {
  const event = store.data.events.find((e) => e.id === eventId)
  if (!event) throw new DemoApiError(404, 'content:errors.eventNotFound')
  return event
}

function touched(eventId: string | null): void {
  store.notify()
  if (eventId) bus.emit('event:changed', { eventId })
}

const byOrder = <T extends { sortOrder: number; createdAt: string }>(a: T, b: T) =>
  a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)

const nextOrder = (rows: { sortOrder: number }[]) => rows.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1

/* ------------------------------------------------------------------ items */

type ItemFields = Pick<Item, 'name' | 'type' | 'points' | 'brandName' | 'imageUrl' | 'weight' | 'active' | 'sortOrder'>

function readItem(body: Body, base: ItemFields): ItemFields {
  const next: ItemFields = {
    name: has(body, 'name') ? str(body.name).trim() : base.name,
    type: has(body, 'type') ? (str(body.type) as ItemType) : base.type,
    points: has(body, 'points') ? int(body.points) : base.points,
    brandName: has(body, 'brandName') ? nullableStr(body.brandName) : base.brandName,
    imageUrl: has(body, 'imageUrl') ? nullableStr(body.imageUrl) : base.imageUrl,
    weight: has(body, 'weight') ? int(body.weight) : base.weight,
    active: has(body, 'active') ? Boolean(body.active) : base.active,
    sortOrder: has(body, 'sortOrder') ? int(body.sortOrder) : base.sortOrder,
  }
  const errors: Errors = {}
  if (!next.name) errors.name = 'content:errors.nameRequired'
  else if (next.name.length > 80) errors.name = 'content:errors.nameTooLong'
  if (!ITEM_TYPES.includes(next.type)) errors.type = 'content:errors.typeInvalid'
  if (!isIntIn(next.points, -100000, 100000)) errors.points = 'content:errors.pointsRange'
  if (next.brandName && next.brandName.length > 120) errors.brandName = 'content:errors.brandTooLong'
  if (!isIntIn(next.weight, 1, 100)) errors.weight = 'content:errors.weightRange'
  if (!isIntIn(next.sortOrder, 0, 10000)) errors.sortOrder = 'content:errors.sortOrderRange'
  fail(errors)
  return next
}

/* ----------------------------------------------------------------- trivia */

type TriviaFields = Pick<TriviaQuestion, 'question' | 'options' | 'correctIndex' | 'points' | 'seconds' | 'active' | 'sortOrder'>

function readTrivia(body: Body, base: TriviaFields): TriviaFields {
  const options = has(body, 'options')
    ? (Array.isArray(body.options) ? body.options : []).map((o) => str(o).trim())
    : base.options
  const next: TriviaFields = {
    question: has(body, 'question') ? str(body.question).trim() : base.question,
    options,
    correctIndex: has(body, 'correctIndex') ? int(body.correctIndex) : base.correctIndex,
    points: has(body, 'points') ? int(body.points) : base.points,
    seconds: has(body, 'seconds') ? int(body.seconds) : base.seconds,
    active: has(body, 'active') ? Boolean(body.active) : base.active,
    sortOrder: has(body, 'sortOrder') ? int(body.sortOrder) : base.sortOrder,
  }
  const errors: Errors = {}
  if (!next.question) errors.question = 'content:errors.questionRequired'
  else if (next.question.length > 300) errors.question = 'content:errors.questionTooLong'
  if (options.length < 2 || options.length > 4 || options.some((o) => !o)) errors.options = 'content:errors.optionsMin'
  else if (options.some((o) => o.length > 120)) errors.options = 'content:errors.optionTooLong'
  if (!isIntIn(next.correctIndex, 0, Math.max(0, options.length - 1))) errors.correctIndex = 'content:errors.correctInvalid'
  if (!isIntIn(next.points, 1, 10000)) errors.points = 'content:errors.triviaPointsRange'
  if (!isIntIn(next.seconds, 5, 120)) errors.seconds = 'content:errors.secondsRange'
  if (!isIntIn(next.sortOrder, 0, 10000)) errors.sortOrder = 'content:errors.sortOrderRange'
  fail(errors)
  return next
}

/* ----------------------------------------------------------------- prizes */

type PrizeFields = Pick<Prize, 'label' | 'description' | 'imageUrl' | 'sortOrder'>

function readPrize(body: Body, base: PrizeFields): PrizeFields {
  const next: PrizeFields = {
    label: has(body, 'label') ? str(body.label).trim() : base.label,
    description: has(body, 'description') ? nullableStr(body.description) : base.description,
    imageUrl: has(body, 'imageUrl') ? nullableStr(body.imageUrl) : base.imageUrl,
    sortOrder: has(body, 'sortOrder') ? int(body.sortOrder) : base.sortOrder,
  }
  const errors: Errors = {}
  if (!next.label) errors.label = 'content:errors.labelRequired'
  else if (next.label.length > 120) errors.label = 'content:errors.labelTooLong'
  if (next.description && next.description.length > 500) errors.description = 'content:errors.descriptionTooLong'
  if (!isIntIn(next.sortOrder, 0, 10000)) errors.sortOrder = 'content:errors.sortOrderRange'
  fail(errors)
  return next
}

/* --------------------------------------------------------------- register */

export function registerEventContent(api: MockApi): void {
  // Items
  api.register('GET', '/admin/events/:eventId/items', ({ path }) => {
    requireStaff()
    findEvent(path.eventId)
    return store.data.items.filter((item) => item.eventId === path.eventId).sort(byOrder)
  })

  api.register('POST', '/admin/events/:eventId/items', ({ path, body }) => {
    requireEditor()
    const event = findEvent(path.eventId)
    const siblings = store.data.items.filter((item) => item.eventId === event.id)
    const fields = readItem(asBody(body), {
      name: '',
      type: 'GOOD',
      points: 10,
      brandName: null,
      imageUrl: null,
      weight: 5,
      active: true,
      sortOrder: nextOrder(siblings),
    })
    const now = nowIso()
    const item: Item = { id: store.nextId('itm_'), eventId: event.id, ...fields, createdAt: now, updatedAt: now }
    store.data.items.push(item)
    touched(event.id)
    return item
  })

  api.register('PATCH', '/admin/items/:itemId', ({ path, body }) => {
    requireEditor()
    const item = store.data.items.find((i) => i.id === path.itemId)
    if (!item) throw new DemoApiError(404, 'content:errors.itemNotFound')
    Object.assign(item, readItem(asBody(body), item), { updatedAt: nowIso() })
    touched(item.eventId)
    return item
  })

  api.register('DELETE', '/admin/items/:itemId', ({ path }) => {
    requireEditor()
    const index = store.data.items.findIndex((i) => i.id === path.itemId)
    if (index < 0) throw new DemoApiError(404, 'content:errors.itemNotFound')
    const [removed] = store.data.items.splice(index, 1)
    touched(removed.eventId)
    return { ok: true }
  })

  // Uploads: no file is read and nothing leaves the browser.
  api.register('POST', '/admin/uploads', () => {
    requireEditor()
    const url = UPLOAD_PLACEHOLDERS[uploadCursor % UPLOAD_PLACEHOLDERS.length]
    uploadCursor += 1
    return { url }
  })

  // Trivia
  api.register('GET', '/admin/events/:eventId/trivia', ({ path }) => {
    requireStaff()
    findEvent(path.eventId)
    return store.data.questions.filter((q) => q.eventId === path.eventId).sort(byOrder)
  })

  api.register('POST', '/admin/events/:eventId/trivia', ({ path, body }) => {
    requireEditor()
    const event = findEvent(path.eventId)
    const siblings = store.data.questions.filter((q) => q.eventId === event.id)
    const fields = readTrivia(asBody(body), {
      question: '',
      options: [],
      correctIndex: 0,
      points: 20,
      seconds: 20,
      active: true,
      sortOrder: nextOrder(siblings),
    })
    const now = nowIso()
    const question: TriviaQuestion = { id: store.nextId('trv_'), eventId: event.id, ...fields, createdAt: now, updatedAt: now }
    store.data.questions.push(question)
    touched(event.id)
    return question
  })

  api.register('PATCH', '/admin/trivia/:questionId', ({ path, body }) => {
    requireEditor()
    const question = store.data.questions.find((q) => q.id === path.questionId)
    if (!question) throw new DemoApiError(404, 'content:errors.questionNotFound')
    Object.assign(question, readTrivia(asBody(body), question), { updatedAt: nowIso() })
    touched(question.eventId)
    return question
  })

  api.register('DELETE', '/admin/trivia/:questionId', ({ path }) => {
    requireEditor()
    const index = store.data.questions.findIndex((q) => q.id === path.questionId)
    if (index < 0) throw new DemoApiError(404, 'content:errors.questionNotFound')
    const [removed] = store.data.questions.splice(index, 1)
    store.data.answers = store.data.answers.filter((a) => a.questionId !== removed.id)
    touched(removed.eventId)
    return { ok: true }
  })

  // Prizes
  api.register('GET', '/admin/events/:eventId/prizes', ({ path }) => {
    requireStaff()
    findEvent(path.eventId)
    return store.data.prizes.filter((p) => p.eventId === path.eventId).sort(byOrder)
  })

  api.register('POST', '/admin/events/:eventId/prizes', ({ path, body }) => {
    requireEditor()
    const event = findEvent(path.eventId)
    const siblings = store.data.prizes.filter((p) => p.eventId === event.id)
    const fields = readPrize(asBody(body), { label: '', description: null, imageUrl: null, sortOrder: nextOrder(siblings) })
    const prize: Prize = { id: store.nextId('prz_'), eventId: event.id, ...fields, createdAt: nowIso() }
    store.data.prizes.push(prize)
    touched(event.id)
    return prize
  })

  api.register('PATCH', '/admin/prizes/:prizeId', ({ path, body }) => {
    requireEditor()
    const prize = store.data.prizes.find((p) => p.id === path.prizeId)
    if (!prize) throw new DemoApiError(404, 'content:errors.prizeNotFound')
    Object.assign(prize, readPrize(asBody(body), prize))
    touched(prize.eventId)
    return prize
  })

  api.register('DELETE', '/admin/prizes/:prizeId', ({ path }) => {
    requireEditor()
    const index = store.data.prizes.findIndex((p) => p.id === path.prizeId)
    if (index < 0) throw new DemoApiError(404, 'content:errors.prizeNotFound')
    const [removed] = store.data.prizes.splice(index, 1)
    touched(removed.eventId)
    return { ok: true }
  })
}
