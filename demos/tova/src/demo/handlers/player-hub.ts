/**
 * Owner: group player-hub (see PLAN.md). Endpoints:
 *   GET /me/card, GET /trivia/state, POST /trivia/answer, GET /prizes (public)
 *
 * Import store/bus from '../store', guards from '../guards', selectors from
 * '../selectors'. Never import from '@/demo' (circular).
 */
import { DemoApiError, type MockApi } from '@portfolio/demo-kit'

import { isStaffRole } from '@/lib/roles'
import type { DemoDb, MyCard, PrizesResponse, TriviaAnswer, TriviaAnswerResult, TriviaState } from '@/types'
import { currentUser, requireUser, toSessionUser } from '../guards'
import { activeEvent, bestScore, bonusPoints, currentEvent } from '../selectors'
import { bus, nowIso, store } from '../store'

const HISTORY_LIMIT = 100

let answerSeq = 0
const answerId = (): string => `ans_${Date.now().toString(36)}${(answerSeq++).toString(36)}`

/** Active questions of an event, in admin order. */
function activeQuestions(db: DemoDb, eventId: string) {
  return db.questions
    .filter((question) => question.eventId === eventId && question.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

function triviaState(db: DemoDb, userId: string): TriviaState {
  const event = activeEvent(db)
  if (!event) return { totalCount: 0, answeredCount: 0, earnedPoints: 0, remaining: [] }
  const questions = activeQuestions(db, event.id)
  const mine = new Map(db.answers.filter((answer) => answer.userId === userId).map((answer) => [answer.questionId, answer]))
  let answeredCount = 0
  let earnedPoints = 0
  const remaining: TriviaState['remaining'] = []
  for (const question of questions) {
    const answer = mine.get(question.id)
    if (answer) {
      answeredCount += 1
      if (answer.correct) earnedPoints += question.points
    } else {
      // Never send correctIndex to a player.
      remaining.push({
        id: question.id,
        question: question.question,
        options: [...question.options],
        points: question.points,
        seconds: question.seconds,
      })
    }
  }
  return { totalCount: questions.length, answeredCount, earnedPoints, remaining }
}

function parseAnswer(body: unknown): { questionId: string; selectedIndex: number } {
  const value = (body ?? {}) as Record<string, unknown>
  const questionId = typeof value.questionId === 'string' ? value.questionId : ''
  const selectedIndex = value.selectedIndex
  if (!questionId || typeof selectedIndex !== 'number' || !Number.isInteger(selectedIndex) || selectedIndex < -1) {
    throw new DemoApiError(400, 'hub:errors.invalidAnswer')
  }
  return { questionId, selectedIndex }
}

export function registerPlayerHub(api: MockApi): void {
  api.register('GET', '/me/card', (): MyCard => {
    const user = requireUser()
    const db = store.data
    const event = currentEvent(db)
    const plays = db.plays
      .filter((play) => play.userId === user.id && (event ? play.eventId === event.id : true))
      .sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt))
    const best = event ? bestScore(db, user.id, event.id) : plays.reduce((max, play) => Math.max(max, play.score), 0)
    const bonus = event ? bonusPoints(db, user.id, event.id) : 0
    return {
      user: toSessionUser(user),
      event,
      best,
      bonus,
      total: best + bonus,
      rounds: plays.length,
      history: plays.slice(0, HISTORY_LIMIT).map((play) => ({ id: play.id, score: play.score, playedAt: play.playedAt })),
      boardHidden: !!event && !isStaffRole(user.role) && !event.leaderboardVisible,
    }
  })

  api.register('GET', '/trivia/state', (): TriviaState => {
    const user = requireUser()
    return triviaState(store.data, user.id)
  })

  api.register('POST', '/trivia/answer', ({ body }): TriviaAnswerResult => {
    const user = requireUser()
    const { questionId, selectedIndex } = parseAnswer(body)
    const db = store.data
    const event = activeEvent(db)
    if (!event) throw new DemoApiError(400, 'hub:errors.noActiveEvent')
    const question = db.questions.find((q) => q.id === questionId && q.eventId === event.id && q.active)
    if (!question) throw new DemoApiError(404, 'hub:errors.questionNotFound')
    if (db.answers.some((answer) => answer.userId === user.id && answer.questionId === question.id)) {
      throw new DemoApiError(409, 'hub:errors.alreadyAnswered')
    }
    if (selectedIndex >= question.options.length) throw new DemoApiError(400, 'hub:errors.invalidAnswer')

    const timedOut = selectedIndex === -1
    const correct = !timedOut && selectedIndex === question.correctIndex
    const answer: TriviaAnswer = {
      id: answerId(),
      userId: user.id,
      questionId: question.id,
      selectedIndex,
      correct,
      answeredAt: nowIso(),
    }
    db.answers.push(answer)
    store.notify()
    bus.emit('trivia:answered', { userId: user.id, questionId: question.id, correct })
    return { correct, timedOut, pointsAwarded: correct ? question.points : 0 }
  })

  api.register(
    'GET',
    '/prizes',
    (): PrizesResponse => {
      const db = store.data
      const viewer = currentUser()
      const staff = !!viewer && !viewer.disabled && isStaffRole(viewer.role)
      const event = currentEvent(db)
      const visible = !!event && (event.awardsVisible || staff)
      const prizes =
        event && visible
          ? db.prizes.filter((prize) => prize.eventId === event.id).sort((a, b) => a.sortOrder - b.sortOrder)
          : []
      return { event, visible, prizes }
    },
    { requiresAuth: false },
  )
}
