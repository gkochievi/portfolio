/**
 * Other customers answering in the background: completes a random background pending link every 40-70 s (emits response:created + link:updated).
 *
 * Owner: feature group insights. Uses every() from @portfolio/demo-kit (pauses while the tab is
 * hidden) and createRandom() for determinism. Never touches a persona's link (recipientId set).
 */
import { createRandom, every } from '@portfolio/demo-kit'

import type { Answer, SurveyResponse } from '@/types'
import { effectiveStatus, mean } from '../analytics'
import { bus, clock, store } from '../core'
import { commentBand, commentPools } from '../seed'

const TICK_MS = 5_000

export function startInsightsSimulator(): () => void {
  const random = createRandom('azri-insights-sim')
  const nextDelay = () => random.int(40, 70) * 1000
  let elapsed = 0
  let due = nextDelay()

  const completeOne = () => {
    const now = clock.now()
    const candidates = store.data.links.filter(
      (link) => link.recipientId === null && effectiveStatus(link, now) === 'pending',
    )
    if (!candidates.length) return
    const link = random.pick(candidates)
    const tenant = store.data.tenants.find((t) => t.id === link.tenantId)
    const questions = store.data.questions
      .filter((q) => q.campaignId === link.campaignId)
      .sort((a, b) => a.order - b.order)
    if (!questions.length) return

    // Positive skew, with the odd skipped question.
    const answers: Answer[] = questions.map((q) => ({
      id: q.id,
      question_rate: random.chance(0.08)
        ? null
        : random.weighted([
            [5, 46],
            [4, 31],
            [3, 13],
            [2, 6],
            [1, 4],
          ] as const),
    }))
    if (answers.every((a) => a.question_rate == null)) answers[0] = { id: questions[0].id, question_rate: 4 }
    const avg = mean(answers.flatMap((a) => (a.question_rate == null ? [] : [a.question_rate]))) ?? 4

    let comment = ''
    let commentLang: SurveyResponse['commentLang'] = 'ka'
    if (random.chance(0.3)) {
      const pool = commentPools[commentBand(avg)].filter(
        (c) => c.industry === 'any' || c.industry === tenant?.industry,
      )
      if (pool.length) {
        const pick = random.pick(pool)
        comment = pick.text
        commentLang = pick.lang
      }
    }

    const submittedAt = now.toISOString()
    const response: SurveyResponse = {
      id: store.nextId('rsp_'),
      surveyId: link.id,
      campaignId: link.campaignId,
      tenantId: link.tenantId,
      branchId: link.branchId,
      staffId: link.staffId,
      answers,
      comment,
      commentLang,
      submittedAt,
      source: 'simulated',
    }
    store.data.responses.unshift(response)
    link.status = 'completed'
    link.completedAt = submittedAt
    link.responseId = response.id

    bus.emit('response:created', {
      responseId: response.id,
      surveyId: link.id,
      campaignId: link.campaignId,
      source: 'simulated',
    })
    bus.emit('link:updated', { surveyId: link.id, status: 'completed' })
  }

  const stop = every(TICK_MS, () => {
    elapsed += TICK_MS
    if (elapsed < due) return
    elapsed = 0
    due = nextDelay()
    completeOne()
  })
  return stop
}
