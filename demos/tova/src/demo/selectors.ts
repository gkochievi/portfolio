/**
 * Owner: data agent. Pure folds over the store shared by several groups.
 * Group-specific folds (stats, player detail, trivia state) live in the
 * group's own handler file.
 */
import type { DemoDb, EventStatus, GameEvent, LeaderRow, User } from '@/types'

const ms = (iso: string): number => Date.parse(iso)

export function eventStatus(event: GameEvent, now: number = Date.now()): EventStatus {
  if (!event.published) return 'hold'
  if (now < ms(event.startsAt)) return 'upcoming'
  if (now > ms(event.endsAt)) return 'closed'
  return 'open'
}

/** Published and now within the window (the one /play runs). */
export function activeEvent(db: DemoDb, now: number = Date.now()): GameEvent | null {
  return db.events.find((event) => eventStatus(event, now) === 'open') ?? null
}

/** Active, else the latest published event that has started. */
export function currentEvent(db: DemoDb, now: number = Date.now()): GameEvent | null {
  const active = activeEvent(db, now)
  if (active) return active
  return (
    db.events
      .filter((event) => event.published && ms(event.startsAt) <= now)
      .sort((a, b) => ms(b.startsAt) - ms(a.startsAt))[0] ?? null
  )
}

/** The next published event that has not started. */
export function upcomingEvent(db: DemoDb, now: number = Date.now()): GameEvent | null {
  return (
    db.events
      .filter((event) => event.published && ms(event.startsAt) > now)
      .sort((a, b) => ms(a.startsAt) - ms(b.startsAt))[0] ?? null
  )
}

export const fullName = (user: Pick<User, 'firstName' | 'lastName'>): string =>
  `${user.firstName} ${user.lastName}`.trim()

export function bestScore(db: DemoDb, userId: string, eventId: string): number {
  let best = 0
  for (const play of db.plays) {
    if (play.userId === userId && play.eventId === eventId && play.score > best) best = play.score
  }
  return best
}

export function bonusPoints(db: DemoDb, userId: string, eventId: string): number {
  const questionPoints = new Map(
    db.questions.filter((question) => question.eventId === eventId).map((question) => [question.id, question.points]),
  )
  let bonus = 0
  for (const answer of db.answers) {
    if (answer.userId === userId && answer.correct) bonus += questionPoints.get(answer.questionId) ?? 0
  }
  return bonus
}

/**
 * Standings for one event: best single round + correct trivia points per
 * player, disabled and staff accounts excluded, top `event.leaderboardSize`.
 * `userId` is filled in; handlers blank it for non-staff viewers.
 */
export function leaderboard(db: DemoDb, event: GameEvent, viewerId: string | null = null): LeaderRow[] {
  const players = new Map(db.users.filter((user) => user.role === 'PLAYER' && !user.disabled).map((user) => [user.id, user]))
  const best = new Map<string, number>()
  for (const play of db.plays) {
    if (play.eventId !== event.id || !players.has(play.userId)) continue
    best.set(play.userId, Math.max(best.get(play.userId) ?? 0, play.score))
  }
  return [...best.entries()]
    .map(([userId, top]) => {
      const user = players.get(userId)!
      return { userId, name: fullName(user), company: user.company, score: top + bonusPoints(db, userId, event.id) }
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, event.leaderboardSize)
    .map((row, index) => ({ ...row, rank: index + 1, isMe: row.userId === viewerId }))
}
