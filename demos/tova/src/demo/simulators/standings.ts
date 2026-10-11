/**
 * Owner: group standings. Ghost players on the live board: every 15-25 s
 * (demo-kit `every`, which pauses while the tab is hidden) one seeded ghost
 * plays a round of the active event; push a Play, `store.notify()`, emit
 * `bus.emit('play:created', {..., ghost: true})`. Uses `createRandom`, not
 * Math.random. Returns the stop function.
 */
import { createRandom, every, type Random } from '@portfolio/demo-kit'

import type { CatchTally, GameEvent, Item } from '@/types'
import { GHOST_IDS } from '../seed'
import { activeEvent } from '../selectors'
import { bus, nowIso, store } from '../store'

const FIRST_DELAY_S = 8
const MIN_GAP_S = 15
const MAX_GAP_S = 25
const MULT = { 1: 1, 2: 1.5, 3: 2 } as const
type Level = keyof typeof MULT

/** Spread `count` catches at `level` over `items`, weighted by spawn weight. */
function spread(random: Random, tallies: Map<string, CatchTally>, items: Item[], count: number, level: Level): void {
  if (items.length === 0) return
  const pairs = items.map((item) => [item, Math.max(1, item.weight)] as const)
  for (let index = 0; index < count; index += 1) {
    const item = random.weighted(pairs)
    const tally = tallies.get(item.id) ?? { name: item.name, type: item.type, l1: 0, l2: 0, l3: 0 }
    if (level === 1) tally.l1 += 1
    else if (level === 2) tally.l2 += 1
    else tally.l3 += 1
    tallies.set(item.id, tally)
  }
}

/** A round worth roughly 550-1200 (never above `maxGood`) whose breakdown adds up exactly to the score. */
export function ghostRound(random: Random, event: GameEvent, items: Item[]): { score: number; breakdown: CatchTally[] } | null {
  const goods = items.filter((item) => item.type === 'GOOD')
  if (goods.length === 0) return null
  const minors = items.filter((item) => item.type === 'MINOR')
  const majors = items.filter((item) => item.type === 'MAJOR')
  const cap = Math.max(0, event.maxGood)
  const tallies = new Map<string, CatchTally>()

  // Hazards first: a few small knocks, a rare storm cloud.
  let penalty = 0
  if (minors.length > 0) {
    const hits = random.int(0, 3)
    for (let index = 0; index < hits; index += 1) {
      const level = random.weighted<Level>([
        [1, 6],
        [2, 2],
        [3, 1],
      ])
      penalty += 10 * MULT[level]
      spread(random, tallies, minors, 1, level)
    }
  }
  const target = random.int(575, 1200)
  if (majors.length > 0 && target + penalty + 500 <= cap && random.chance(0.12)) {
    penalty += 500
    spread(random, tallies, majors, 1, 1)
  }

  // Sponsor coins: 50 / 75 / 100 per catch = 2 / 3 / 4 units of 25.
  const good = Math.min(cap, target + penalty)
  const units = Math.floor(good / 25)
  let l3 = random.int(0, Math.floor(units / 40))
  let l2 = random.int(0, Math.floor(units / 12))
  let rest = units - 4 * l3 - 3 * l2
  if (rest < 0) {
    l3 = 0
    l2 = 0
    rest = units
  }
  if (rest % 2 === 1) {
    if (l2 > 0) {
      l2 -= 1
      rest += 3
    } else if (rest >= 3) {
      l2 += 1
      rest -= 3
    } else {
      rest -= 1
    }
  }
  const l1 = Math.floor(rest / 2)
  spread(random, tallies, goods, l1, 1)
  spread(random, tallies, goods, l2, 2)
  spread(random, tallies, goods, l3, 3)

  const caught = 50 * l1 + 75 * l2 + 100 * l3
  const score = Math.max(-event.maxBad, Math.min(event.maxGood, caught - penalty))
  return { score, breakdown: [...tallies.values()] }
}

export function startStandingsSimulator(): () => void {
  const random = createRandom('tova-ghosts')
  let wait = FIRST_DELAY_S
  let serial = 0

  const playOnce = () => {
    const event = activeEvent(store.data)
    if (!event) return
    const ghosts = store.data.users.filter((user) => (GHOST_IDS as readonly string[]).includes(user.id) && !user.disabled)
    if (ghosts.length === 0) return
    const ghost = random.pick(ghosts)
    const items = store.data.items.filter((item) => item.eventId === event.id && item.active)
    const round = ghostRound(random, event, items)
    if (!round) return
    serial += 1
    const play = {
      id: `ply_ghost_${serial}_${random.uuid().slice(0, 8)}`,
      userId: ghost.id,
      eventId: event.id,
      score: round.score,
      duration: event.durationSeconds,
      breakdown: round.breakdown,
      playedAt: nowIso(),
    }
    store.data.plays.push(play)
    store.notify()
    bus.emit('play:created', { playId: play.id, userId: ghost.id, eventId: event.id, score: play.score, ghost: true })
  }

  // A 1 s heartbeat (paused while the tab is hidden) counts down to the next ghost round.
  const stop = every(1000, () => {
    wait -= 1
    if (wait > 0) return
    wait = random.int(MIN_GAP_S, MAX_GAP_S)
    playOnce()
  })
  // A reset restores the seed; give the visitor a moment before the next ghost lands.
  const offReset = bus.on('demo:reset', () => {
    wait = FIRST_DELAY_S
  })
  return () => {
    stop()
    offReset()
  }
}
