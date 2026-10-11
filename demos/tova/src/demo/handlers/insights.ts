/**
 * Owner: group insights (see PLAN.md). Endpoints:
 *   GET /admin/stats (staff)
 *
 * A pure fold over the store, recomputed on every request so a visitor's own
 * rounds and the ghost players' rounds show up immediately.
 *
 * Import store/bus from '../store', guards from '../guards', selectors from
 * '../selectors'. Never import from '@/demo' (circular).
 */
import type { MockApi } from '@portfolio/demo-kit'

import { isStaffRole } from '@/lib/roles'
import type { CatchTally, DayCount, DemoDb, ItemType, Stats, User } from '@/types'
import { requireStaff } from '../guards'
import { eventStatus, fullName } from '../selectors'
import { store } from '../store'

const ITEM_TYPES: readonly ItemType[] = ['GOOD', 'MINOR', 'MAJOR']
const DAYS = 30

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar day, `YYYY-MM-DD`, so "today" matches the viewer's clock. */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** One bucket per day for the last `DAYS` days (today included), ascending and zero-filled. */
function bucketDays(dates: Date[], now: Date): DayCount[] {
  const days: DayCount[] = []
  const index = new Map<string, DayCount>()
  for (let offset = DAYS - 1; offset >= 0; offset -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
    const bucket = { date: localDayKey(day), count: 0 }
    days.push(bucket)
    index.set(bucket.date, bucket)
  }
  for (const date of dates) {
    const bucket = index.get(localDayKey(date))
    if (bucket) bucket.count += 1
  }
  return days
}

const isItemType = (value: unknown): value is ItemType => ITEM_TYPES.includes(value as ItemType)

export function computeStats(db: DemoDb, now: Date = new Date()): Stats {
  const nowMs = now.getTime()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime()

  const events = [...db.events].sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
  const plays = db.plays
  const userById = new Map(db.users.map((user) => [user.id, user]))
  const eventById = new Map(events.map((event) => [event.id, event]))

  // Staff and suspended accounts never appear in a player-facing record.
  const isHidden = (user: User | undefined): boolean => !user || user.disabled || isStaffRole(user.role)

  const playerUsers = db.users.filter((user) => user.role === 'PLAYER')
  const staff = db.users.filter((user) => isStaffRole(user.role)).length

  const totalPoints = plays.reduce((sum, play) => sum + play.score, 0)
  const maxScore = plays.reduce((max, play) => Math.max(max, play.score), 0)
  const activePlayers = new Set(plays.map((play) => play.userId)).size

  const questionById = new Map(db.questions.map((question) => [question.id, question]))
  const triviaByEvent = new Map<string, number>()
  let triviaCorrect = 0
  let triviaBonus = 0
  for (const answer of db.answers) {
    const question = questionById.get(answer.questionId)
    if (question) triviaByEvent.set(question.eventId, (triviaByEvent.get(question.eventId) ?? 0) + 1)
    if (answer.correct) {
      triviaCorrect += 1
      triviaBonus += question?.points ?? 0
    }
  }

  const visiblePlays = plays.filter((play) => !isHidden(userById.get(play.userId)))

  // Records: one row per round, best first.
  const topScores = [...visiblePlays]
    .sort((a, b) => b.score - a.score || Date.parse(a.playedAt) - Date.parse(b.playedAt))
    .slice(0, 10)
    .map((play) => {
      const user = userById.get(play.userId) as User
      return {
        name: fullName(user),
        company: user.company,
        score: play.score,
        event: play.eventId ? (eventById.get(play.eventId)?.name ?? null) : null,
        playedAt: play.playedAt,
      }
    })

  // Most active players by round count.
  const byUser = new Map<string, { plays: number; best: number }>()
  for (const play of visiblePlays) {
    const current = byUser.get(play.userId) ?? { plays: 0, best: 0 }
    current.plays += 1
    current.best = Math.max(current.best, play.score)
    byUser.set(play.userId, current)
  }
  const topPlayers = [...byUser.entries()]
    .sort((a, b) => b[1].plays - a[1].plays || b[1].best - a[1].best)
    .slice(0, 10)
    .map(([userId, value]) => {
      const user = userById.get(userId) as User
      return { name: fullName(user), company: user.company, plays: value.plays, best: value.best }
    })

  const perEvent = events.map((event) => {
    const eventPlays = plays.filter((play) => play.eventId === event.id)
    const eventTotal = eventPlays.reduce((sum, play) => sum + play.score, 0)
    const top = eventPlays
      .filter((play) => !isHidden(userById.get(play.userId)))
      .sort((a, b) => b.score - a.score)[0]
    const topUser = top ? userById.get(top.userId) : undefined
    const start = Date.parse(event.startsAt)
    const end = Date.parse(event.endsAt)
    return {
      id: event.id,
      name: event.name,
      status: eventStatus(event, nowMs),
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      players: new Set(eventPlays.map((play) => play.userId)).size,
      plays: eventPlays.length,
      avgScore: eventPlays.length ? Math.round(eventTotal / eventPlays.length) : 0,
      topScore: eventPlays.reduce((max, play) => Math.max(max, play.score), 0),
      topPlayer: topUser ? fullName(topUser) : null,
      newUsers: playerUsers.filter((user) => {
        const created = Date.parse(user.createdAt)
        return created >= start && created <= end
      }).length,
      triviaAnswers: triviaByEvent.get(event.id) ?? 0,
    }
  })

  // Catch breakdown across every round (l1 = plain, l2 = x1.5, l3 = x2).
  const typeTotals = new Map<ItemType, { l1: number; l2: number; l3: number }>()
  const nameTotals = new Map<string, { type: ItemType; total: number }>()
  let totalCaught = 0
  for (const play of plays) {
    const rows: CatchTally[] = Array.isArray(play.breakdown) ? play.breakdown : []
    for (const row of rows) {
      if (!row || !isItemType(row.type)) continue
      const l1 = Number(row.l1) || 0
      const l2 = Number(row.l2) || 0
      const l3 = Number(row.l3) || 0
      const sum = l1 + l2 + l3
      const t = typeTotals.get(row.type) ?? { l1: 0, l2: 0, l3: 0 }
      t.l1 += l1
      t.l2 += l2
      t.l3 += l3
      typeTotals.set(row.type, t)
      const name = String(row.name ?? '')
      if (name) {
        const n = nameTotals.get(name) ?? { type: row.type, total: 0 }
        n.total += sum
        nameTotals.set(name, n)
      }
      totalCaught += sum
    }
  }
  const byType = ITEM_TYPES.map((type) => {
    const v = typeTotals.get(type) ?? { l1: 0, l2: 0, l3: 0 }
    return { type, total: v.l1 + v.l2 + v.l3, ...v }
  })
  const top = [...nameTotals.entries()]
    .map(([name, v]) => ({ name, type: v.type, total: v.total }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 12)

  return {
    generatedAt: now.toISOString(),
    totals: {
      players: playerUsers.length,
      activePlayers,
      disabledPlayers: playerUsers.filter((user) => user.disabled).length,
      staff,
      events: events.length,
      publishedEvents: events.filter((event) => event.published).length,
      plays: plays.length,
      totalPoints,
      avgScore: plays.length ? Math.round(totalPoints / plays.length) : 0,
      maxScore,
      avgPlaysPerPlayer: activePlayers ? Math.round((plays.length / activePlayers) * 10) / 10 : 0,
      triviaAnswers: db.answers.length,
      triviaCorrect,
      triviaBonus,
    },
    thisMonth: {
      newPlayers: playerUsers.filter((user) => Date.parse(user.createdAt) >= monthStart).length,
      plays: plays.filter((play) => Date.parse(play.playedAt) >= monthStart).length,
      activeEvents: events.filter((event) => Date.parse(event.startsAt) <= monthEnd && Date.parse(event.endsAt) >= monthStart)
        .length,
    },
    registrationsByDay: bucketDays(
      playerUsers.map((user) => new Date(user.createdAt)),
      now,
    ),
    playsByDay: bucketDays(
      plays.map((play) => new Date(play.playedAt)),
      now,
    ),
    topScores,
    topPlayers,
    perEvent,
    catches: { totalCaught, byType, top },
  }
}

export function registerInsights(api: MockApi): void {
  api.register('GET', '/admin/stats', (): Stats => {
    requireStaff()
    return computeStats(store.data)
  })
}
