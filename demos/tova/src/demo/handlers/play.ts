/**
 * Owner: group play (see PLAN.md). Endpoints:
 *   GET /play/config, POST /play/score
 *
 * Import store/bus from '../store', guards from '../guards', selectors from
 * '../selectors'. Never import from '@/demo' (circular).
 */
import { DemoApiError, type MockApi } from '@portfolio/demo-kit'

import type { CatchTally, ItemDef, ItemType, Play, PlayConfig, ScoreResult, ScoreSubmit } from '@/types'
import { requireUser } from '../guards'
import { activeEvent, bestScore, eventStatus, upcomingEvent } from '../selectors'
import { bus, nowIso, store } from '../store'

/** Used when the active event has no active items: 5 sponsors + 3 hazards. */
export const DEFAULT_ITEMS: ItemDef[] = [
  { id: 'def_kvamli', name: 'Kvamli Coffee', type: 'GOOD', points: 50, imageUrl: 'media/items/kvamli-coffee.svg', weight: 5 },
  { id: 'def_mzevali', name: 'Mzevali Tea', type: 'GOOD', points: 50, imageUrl: 'media/items/mzevali-tea.svg', weight: 5 },
  { id: 'def_arsiani', name: 'Arsiani Bakery', type: 'GOOD', points: 50, imageUrl: 'media/items/arsiani-bakery.svg', weight: 5 },
  { id: 'def_tetri', name: 'Tetri Kalami', type: 'GOOD', points: 50, imageUrl: 'media/items/tetri-kalami.svg', weight: 5 },
  { id: 'def_lurji', name: 'Lurji Velo', type: 'GOOD', points: 50, imageUrl: 'media/items/lurji-velo.svg', weight: 5 },
  { id: 'def_icicle', name: 'Icicle', type: 'MINOR', points: -10, imageUrl: null, weight: 3 },
  { id: 'def_pinecone', name: 'Pinecone', type: 'MINOR', points: -10, imageUrl: null, weight: 3 },
  { id: 'def_storm', name: 'Storm cloud', type: 'MAJOR', points: -500, imageUrl: null, weight: 1 },
]

const ITEM_TYPES: readonly ItemType[] = ['GOOD', 'MINOR', 'MAJOR']

const count = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? Math.min(10_000, Math.floor(n)) : 0
}

/** Keep only well-formed tally rows; merge duplicates by name + type. */
function cleanBreakdown(raw: unknown): CatchTally[] {
  if (!Array.isArray(raw)) return []
  const merged = new Map<string, CatchTally>()
  for (const row of raw as Partial<CatchTally>[]) {
    if (!row || typeof row.name !== 'string' || !row.name.trim()) continue
    if (!ITEM_TYPES.includes(row.type as ItemType)) continue
    const key = `${row.type}|${row.name}`
    const tally = merged.get(key) ?? { name: row.name.slice(0, 80), type: row.type as ItemType, l1: 0, l2: 0, l3: 0 }
    tally.l1 += count(row.l1)
    tally.l2 += count(row.l2)
    tally.l3 += count(row.l3)
    merged.set(key, tally)
  }
  return [...merged.values()].filter((t) => t.l1 + t.l2 + t.l3 > 0)
}

export function registerPlay(api: MockApi): void {
  api.register('GET', '/play/config', (): PlayConfig => {
    const user = requireUser()
    const db = store.data
    const now = Date.now()
    const event = activeEvent(db, now)
    let items: ItemDef[] = []
    if (event) {
      items = db.items
        .filter((item) => item.eventId === event.id && item.active)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
        .map(({ id, name, type, points, imageUrl, weight }) => ({ id, name, type, points, imageUrl, weight }))
      if (items.length === 0) items = DEFAULT_ITEMS.map((item) => ({ ...item }))
    }
    return {
      event: event ? { ...event } : null,
      items,
      best: event ? bestScore(db, user.id, event.id) : 0,
      upcoming: upcomingEvent(db, now),
    }
  })

  api.register('POST', '/play/score', ({ body }): ScoreResult => {
    const user = requireUser()
    const input = (body ?? {}) as Partial<ScoreSubmit>
    const db = store.data
    const event = typeof input.eventId === 'string' ? db.events.find((e) => e.id === input.eventId) : undefined
    if (!event || eventStatus(event) !== 'open') throw new DemoApiError(400, 'play:errors.eventClosed')

    const rawScore = typeof input.score === 'number' && Number.isFinite(input.score) ? Math.round(input.score) : NaN
    if (Number.isNaN(rawScore)) throw new DemoApiError(400, 'play:errors.invalidScore')
    // Fairness clamp: a round can never beat the planned budget.
    const score = Math.min(event.maxGood, Math.max(-event.maxBad, rawScore))
    const rawDuration = typeof input.duration === 'number' && Number.isFinite(input.duration) ? input.duration : event.durationSeconds
    const duration = Math.max(1, Math.min(event.durationSeconds, Math.round(rawDuration)))

    const previous = db.plays.some((p) => p.userId === user.id && p.eventId === event.id)
      ? bestScore(db, user.id, event.id)
      : null

    const play: Play = {
      id: store.nextId('play_'),
      userId: user.id,
      eventId: event.id,
      score,
      duration,
      breakdown: cleanBreakdown(input.breakdown),
      playedAt: nowIso(),
    }
    db.plays.push(play)
    store.notify()
    bus.emit('play:created', { playId: play.id, userId: user.id, eventId: event.id, score, ghost: false })

    return {
      play: { ...play, breakdown: play.breakdown ? play.breakdown.map((t) => ({ ...t })) : null },
      score,
      best: bestScore(db, user.id, event.id),
      isNewBest: score > 0 && (previous === null || score > previous),
    }
  })
}
