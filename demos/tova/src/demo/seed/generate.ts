/**
 * Owner: data agent. Deterministic generators for rounds, trivia answers and
 * signup times (one `createRandom('tova-seed')` stream, so every load is identical).
 *
 * Every round's catch tally adds up to its score exactly: sponsor coins are
 * worth 50 / 75 / 100 (normal, x1.5, x2), small hazards 10 / 15 / 20 and the
 * storm cloud 500, so the staff drill-down always reconciles.
 */
import { createRandom } from '@portfolio/demo-kit'

import type { CatchTally, GameEvent, Item, Play, TriviaAnswer, User } from '@/types'
import { eventById, itemsFor, LIVE_EVENT_ID, QUESTIONS } from './content'
import { FIXED_SIGNUPS, NEVER_PLAYED, PLAYER_PROFILES, playerPhone } from './people'
import { ANCHOR_MS, MINUTE, iso, onDay, onDayMs } from './time'

const random = createRandom('tova-seed')

const LEVEL_MULT = { 1: 1, 2: 1.5, 3: 2 } as const
type Level = keyof typeof LEVEL_MULT

const round5 = (value: number): number => Math.round(value / 5) * 5

/* ------------------------------------------------------------ breakdowns */

/** A catch tally whose signed total equals `score` (a multiple of 5). */
function exactBreakdown(score: number, items: Item[], maxGood: number): CatchTally[] {
  const goods = items.filter((item) => item.type === 'GOOD')
  const minors = items.filter((item) => item.type === 'MINOR')
  const majors = items.filter((item) => item.type === 'MAJOR')
  const hits: { item: Item; level: Level }[] = []
  let penalty = 0
  const hit = (item: Item, level: Level) => {
    hits.push({ item, level })
    penalty += Math.abs(item.points) * LEVEL_MULT[level]
  }

  // A low round that clipped the storm cloud.
  const storm = majors[0]
  if (storm && score < 400 && score + 500 + 100 <= maxGood && random.chance(0.35)) hit(storm, 1)
  if (minors.length > 0) {
    const extra = random.weighted<number>([[0, 3], [1, 4], [2, 3], [3, 1]])
    for (let index = 0; index < extra; index += 1) {
      hit(random.pick(minors), random.weighted<Level>([[1, 8], [2, 2]]))
    }
    // Coins come in 25-point units: settle the remainder with small hazards.
    const need = (25 - ((score + penalty) % 25)) % 25
    const fixes: Record<number, Level[]> = { 0: [], 5: [2, 2], 10: [1], 15: [2], 20: [1, 1] }
    for (const level of fixes[need] ?? []) hit(random.pick(minors), level)
  }

  let units = Math.max(0, (score + penalty) / 25)
  if (!Number.isInteger(units)) units = Math.round(units)
  let l3 = random.int(0, Math.floor(units / 40))
  let l2 = random.int(0, Math.floor(units / 12))
  let rest = units - 4 * l3 - 3 * l2
  while (rest < 0) {
    if (l2 > 0) {
      l2 -= 1
      rest += 3
    } else {
      l3 -= 1
      rest += 4
    }
  }
  if (rest % 2 === 1) {
    if (rest >= 3) {
      l2 += 1
      rest -= 3
    } else if (l2 > 0) {
      l2 -= 1
      rest += 3
    } else {
      rest += 1
    }
  }
  const l1 = rest / 2

  const tallies = new Map<string, CatchTally>()
  const bump = (item: Item, level: Level) => {
    const tally = tallies.get(item.id) ?? { name: item.name, type: item.type, l1: 0, l2: 0, l3: 0 }
    if (level === 1) tally.l1 += 1
    else if (level === 2) tally.l2 += 1
    else tally.l3 += 1
    tallies.set(item.id, tally)
  }
  const spread = (count: number, level: Level) => {
    for (let index = 0; index < count; index += 1) bump(random.pick(goods), level)
  }
  spread(l1, 1)
  spread(l2, 2)
  spread(l3, 3)
  for (const { item, level } of hits) bump(item, level)

  const order = new Map(items.map((item, index) => [item.id, index]))
  return [...tallies.entries()]
    .sort(([a], [b]) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    .map(([, tally]) => tally)
}

/** The source's session distribution, weighted to 500-950, kept under the cap. */
function rollScore(event: GameEvent): number {
  const roll = random.next()
  let score: number
  if (roll < 0.07) score = random.int(40, 150)
  else if (roll < 0.32) score = random.int(150, 500)
  else if (roll < 0.76) score = random.int(500, 950)
  else if (roll < 0.95) score = random.int(950, 1300)
  else score = random.int(1300, 1600)
  return round5(Math.min(score, event.maxGood - 150))
}

/* ----------------------------------------------------------------- plays */

type Draft = Omit<Play, 'id'>

const drafts: Draft[] = []

function addPlay(userId: string, event: GameEvent, score: number, playedMs: number, breakdown?: CatchTally[] | null): void {
  drafts.push({
    userId,
    eventId: event.id,
    score,
    duration: event.durationSeconds - random.weighted<number>([[0, 6], [1, 2], [2, 1]]),
    breakdown: breakdown === undefined ? exactBreakdown(score, itemsFor(event.id), event.maxGood) : breakdown,
    playedAt: iso(playedMs),
  })
}

/** Narinji Expo: who played, their best round and how many rounds (40 in all). */
const LIVE_ROSTER: { userId: string; best: number; rounds: number }[] = [
  { userId: 'usr_p05', best: 1185, rounds: 4 },
  { userId: 'usr_p19', best: 1090, rounds: 3 },
  { userId: 'usr_p14', best: 1240, rounds: 2 }, // suspended: never on the board
  { userId: 'usr_p08', best: 965, rounds: 3 },
  { userId: 'usr_p24', best: 905, rounds: 2 },
  { userId: 'usr_p01', best: 870, rounds: 3 },
  { userId: 'usr_p16', best: 745, rounds: 2 },
  { userId: 'usr_p13', best: 720, rounds: 2 },
  { userId: 'usr_g2', best: 700, rounds: 2 },
  { userId: 'usr_p12', best: 680, rounds: 3 },
  { userId: 'usr_g1', best: 655, rounds: 2 },
  { userId: 'usr_g3', best: 610, rounds: 2 },
  { userId: 'usr_p09', best: 590, rounds: 2 },
  { userId: 'usr_p22', best: 545, rounds: 2 },
  { userId: 'usr_p23', best: 480, rounds: 2 },
  { userId: 'usr_p15', best: 410, rounds: 3 },
  { userId: 'usr_p06', best: 300, rounds: 1 },
]

function buildLivePlays(): void {
  const live = eventById(LIVE_EVENT_ID)
  for (const { userId, best, rounds } of LIVE_ROSTER) {
    // One visit to the stand: yesterday afternoon or this morning (Tbilisi).
    const today = random.chance(0.35)
    let at = today ? onDayMs(0, 6, 30) + random.int(0, 150) * MINUTE : onDayMs(-1, 10, 5) + random.int(0, 305) * MINUTE
    const bestIndex = random.int(0, rounds - 1)
    const zeroIndex = userId === 'usr_p15' ? (bestIndex === 0 ? 1 : 0) : -1
    for (let index = 0; index < rounds; index += 1) {
      if (index > 0) at += random.int(3, 9) * MINUTE
      if (index === zeroIndex) {
        // The round that ended on nothing: a storm cloud wiped out every coin.
        addPlay(userId, live, 0, at, [
          { name: 'Kvamli Coffee', type: 'GOOD', l1: 3, l2: 0, l3: 0 },
          { name: 'Mzevali Tea', type: 'GOOD', l1: 0, l2: 1, l3: 0 },
          { name: 'Tetri Kalami', type: 'GOOD', l1: 2, l2: 0, l3: 0 },
          { name: 'Lurji Velo', type: 'GOOD', l1: 2, l2: 1, l3: 0 },
          { name: 'Storm cloud', type: 'MAJOR', l1: 1, l2: 0, l3: 0 },
        ])
        continue
      }
      const score = index === bestIndex ? best : Math.max(60, round5(best - random.int(30, 420)))
      addPlay(userId, live, score, at)
    }
  }
  // The demo player: signed up two hours ago, three rounds since.
  addPlay('usr_saba', live, 640, onDayMs(0, 8, 12))
  addPlay('usr_saba', live, 780, onDayMs(0, 8, 31))
  addPlay('usr_saba', live, 715, onDayMs(0, 9, 20))
}

/** Visitors who only came to earlier fairs, weighted up so they show in the history. */
const REGULARS = new Set(['usr_p07', 'usr_p10', 'usr_p17', 'usr_p18', 'usr_p20'])
/** First-time visitors: registered at Narinji Expo, no earlier rounds. */
const FIRST_TIMERS = new Set(['usr_g3', 'usr_p06', 'usr_p16', 'usr_p19', 'usr_p23'])

const PAST_WINDOWS: { eventId: string; days: number[]; count: number }[] = [
  { eventId: 'evt_kutaisi', days: [-26, -25], count: 12 },
  { eventId: 'evt_batumi', days: [-19, -18, -17], count: 18 },
  { eventId: 'evt_pilpili', days: [-12, -11, -10, -9], count: 30 },
  { eventId: 'evt_velo', days: [-5, -4], count: 19 },
]

function buildPastPlays(): void {
  const pool = PLAYER_PROFILES.filter((profile) => profile.id !== 'usr_saba' && !NEVER_PLAYED.has(profile.id) && !FIRST_TIMERS.has(profile.id)).map(
    (profile) => [profile.id, REGULARS.has(profile.id) ? 3 : 1] as const,
  )
  for (const window of PAST_WINDOWS) {
    const event = eventById(window.eventId)
    for (let index = 0; index < window.count; index += 1) {
      const userId = random.weighted(pool)
      const at = onDayMs(random.pick(window.days), 7, 15) + random.int(0, 515) * MINUTE
      addPlay(userId, event, rollScore(event), at)
    }
  }
}

buildPastPlays()
buildLivePlays()

drafts.sort((a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt))

// The two oldest rounds predate the per-item tally.
for (const draft of drafts.slice(0, 2)) draft.breakdown = null

export const PLAYS: Play[] = drafts.map((draft, index) => ({ id: `ply_${String(index + 1).padStart(3, '0')}`, ...draft }))

/* -------------------------------------------------------- trivia answers */

const firstPlayMs = (userId: string, eventId: string): number | null => {
  const first = PLAYS.find((play) => play.userId === userId && play.eventId === eventId)
  return first ? Date.parse(first.playedAt) : null
}

function buildAnswers(): TriviaAnswer[] {
  // First decide who answered what and when, then deal the outcomes from a
  // shuffled deck so 62% are right (and a few ran out the clock).
  const slots: { userId: string; questionId: string; atMs: number }[] = []

  // Narinji Expo: most visitors try a few questions right after a round.
  const liveQuestions = QUESTIONS.filter((question) => question.eventId === LIVE_EVENT_ID && question.active)
  for (const { userId } of LIVE_ROSTER) {
    if (!random.chance(0.9)) continue
    const start = firstPlayMs(userId, LIVE_EVENT_ID)
    if (start === null) continue
    const count = random.weighted<number>([[1, 1], [2, 2], [3, 2], [4, 3], [5, 3], [6, 3]])
    let at = start + random.int(4, 30) * MINUTE
    for (const question of random.shuffle(liveQuestions).slice(0, count)) {
      if (at > ANCHOR_MS - 2 * MINUTE) break
      slots.push({ userId, questionId: question.id, atMs: at })
      at += random.int(1, 3) * MINUTE
    }
  }

  // Pilpili Food Week: the one question still switched on.
  const pilpiliPlayers = [...new Set(PLAYS.filter((play) => play.eventId === 'evt_pilpili').map((play) => play.userId))]
  for (const userId of pilpiliPlayers) {
    if (!random.chance(0.8)) continue
    slots.push({ userId, questionId: 'trv_p1', atMs: firstPlayMs(userId, 'evt_pilpili')! + random.int(3, 40) * MINUTE })
  }

  const right = Math.round(slots.length * 0.62)
  const timeouts = Math.min(3, slots.length - right)
  const deck = random.shuffle(
    slots.map((_, index): boolean | 'timeout' => (index < right ? true : index < right + timeouts ? 'timeout' : false)),
  )

  const out: Omit<TriviaAnswer, 'id'>[] = []
  const answer = (userId: string, questionId: string, outcome: boolean | 'timeout', atMs: number) => {
    const question = QUESTIONS.find((candidate) => candidate.id === questionId)!
    const wrong = question.options.map((_, index) => index).filter((index) => index !== question.correctIndex)
    const selectedIndex = outcome === 'timeout' ? -1 : outcome ? question.correctIndex : random.pick(wrong)
    out.push({ userId, questionId, selectedIndex, correct: outcome === true, answeredAt: iso(atMs) })
  }
  slots.forEach((slot, index) => answer(slot.userId, slot.questionId, deck[index] ?? false, slot.atMs))

  // The demo player: one right (+20), one wrong, four still to try.
  answer('usr_saba', 'trv_n1', false, onDayMs(0, 8, 40))
  answer('usr_saba', 'trv_n2', true, onDayMs(0, 8, 42))

  return out
    .sort((a, b) => Date.parse(a.answeredAt) - Date.parse(b.answeredAt))
    .map((row, index) => ({ id: `ans_${String(index + 1).padStart(3, '0')}`, ...row }))
}

export const ANSWERS: TriviaAnswer[] = buildAnswers()

/* ----------------------------------------------------------------- users */

/** Players: each signed up at the stand a few minutes before their first round. */
export const PLAYERS: User[] = PLAYER_PROFILES.map((profile, index) => {
  const first = PLAYS.find((play) => play.userId === profile.id)
  const createdAt =
    FIXED_SIGNUPS[profile.id] ??
    (first ? iso(Date.parse(first.playedAt) - random.int(4, 55) * MINUTE) : onDay(-2, 12, 0))
  return {
    ...profile,
    username: null,
    phone: playerPhone(index),
    role: 'PLAYER',
    isAdmin: false,
    guest: false,
    createdAt,
  }
})
