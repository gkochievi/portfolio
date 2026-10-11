/**
 * Respondent microsite API (neutral paths; envelope semantics of the source).
 *
 * Owner: feature group survey. Endpoints (see PLAN.md):
 *   POST /api/surveys/validate   { survey_id, lang? } -> ApiEnvelope<ValidateData>
 *   POST /api/surveys/questions  { survey_id, lang? } -> ApiEnvelope<QuestionsData>
 *   POST /api/surveys/responses  SubmitRequest       -> ApiEnvelope<{ responseId }>
 *
 * Like the upstream CRM, a business failure (unknown, used or expired link)
 * is an HTTP 200 envelope with `success: false` and one of SURVEY_MESSAGES;
 * the page branches on the message text. Malformed input is a 400.
 * Copy is resolved to plain strings for `body.lang`.
 */
import { DemoApiError } from '@portfolio/demo-kit'

import { effectiveStatus, tenantBranding } from '@/demo/analytics'
import type {
  Answer,
  ApiEnvelope,
  Lang,
  LocalizedText,
  QuestionsData,
  SurveyLink,
  SurveyQuestionWire,
  SurveyResponse,
  ValidateData,
} from '@/types'
import { SURVEY_MESSAGES } from '@/types'
import { api, bus, clock, store } from '../core'

type Body = Record<string, unknown> | undefined

const text = (value: LocalizedText | undefined, lang: Lang): string => (value ? (lang === 'ka' ? value.ka : value.en) : '')

function langOf(body: Body): Lang {
  return body?.lang === 'ka' ? 'ka' : 'en'
}

/** The token from the body, or a 400 like a form serializer would give. */
function surveyIdOf(body: Body): string {
  const raw = body?.survey_id
  const id = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : ''
  if (!id) throw DemoApiError.validation({ survey_id: 'This field is required.' })
  return id
}

type Lookup = { ok: true; link: SurveyLink } | { ok: false; envelope: ApiEnvelope<never> }

/** Find the link and refuse unknown, spent and expired ones with the canonical envelope. */
function lookup(surveyId: string): Lookup {
  const link = store.data.links.find((item) => item.id.toUpperCase() === surveyId.toUpperCase())
  if (!link) return { ok: false, envelope: { success: false, message: SURVEY_MESSAGES.notFound, meta: undefined } }
  const status = effectiveStatus(link, clock.now())
  if (status === 'completed') {
    return { ok: false, envelope: { success: false, message: SURVEY_MESSAGES.completed, meta: { tenantId: link.tenantId, status } } }
  }
  if (status === 'expired') {
    return { ok: false, envelope: { success: false, message: SURVEY_MESSAGES.expired, meta: { tenantId: link.tenantId, status } } }
  }
  return { ok: true, link }
}

function questionsFor(campaignId: string, lang: Lang): SurveyQuestionWire[] {
  return store.data.questions
    .filter((question) => question.campaignId === campaignId)
    .sort((a, b) => a.order - b.order)
    .map((question) => ({ id: question.id, question_text: text(question.text, lang) }))
}

/* ---------------------------------------------------------------- validate */

api.register('POST', '/surveys/validate', ({ body }): ApiEnvelope<ValidateData> => {
  const input = body as Body
  const surveyId = surveyIdOf(input)
  const lang = langOf(input)
  const found = lookup(surveyId)
  if (!found.ok) return found.envelope
  const { link } = found

  const campaign = store.data.campaigns.find((item) => item.id === link.campaignId)
  const tenant = store.data.tenants.find((item) => item.id === link.tenantId)
  if (!campaign || !tenant) return { success: false, message: SURVEY_MESSAGES.notFound }
  const branch = store.data.branches.find((item) => item.id === link.branchId)
  const staff = store.data.staff.find((item) => item.id === link.staffId)

  return {
    success: true,
    data: {
      campaign: { title: text(campaign.title, lang), description: text(campaign.description, lang) },
      questions: questionsFor(campaign.id, lang),
      tenant: tenantBranding(tenant, lang),
      context: {
        touchpoint: text(campaign.touchpoint, lang),
        branch: text(branch?.name, lang),
        staff: text(staff?.name, lang),
        interactionAt: link.interactionAt,
        expiresAt: link.expiresAt,
      },
    },
  }
})

/* --------------------------------------------------------------- questions */

api.register('POST', '/surveys/questions', ({ body }): ApiEnvelope<QuestionsData> => {
  const input = body as Body
  const surveyId = surveyIdOf(input)
  const found = lookup(surveyId)
  if (!found.ok) return found.envelope
  return { success: true, data: { questions: questionsFor(found.link.campaignId, langOf(input)) } }
})

/* --------------------------------------------------------------- responses */

const GEORGIAN = /[Ⴀ-ჿᲐ-Ჿ]/

function parseAnswers(raw: unknown): Answer[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) throw DemoApiError.validation({ responses: 'Expected a list of answers.' })
  return raw.map((item, index) => {
    const entry = (item ?? {}) as Record<string, unknown>
    const id = Number(entry.id)
    if (!Number.isInteger(id)) throw DemoApiError.validation({ [`responses.${index}.id`]: 'A valid question id is required.' })
    const rate = entry.question_rate
    if (rate === null || rate === undefined) return { id, question_rate: null }
    if (typeof rate !== 'number' || !Number.isInteger(rate) || rate < 1 || rate > 5) {
      throw DemoApiError.validation({ [`responses.${index}.question_rate`]: 'Ensure this value is an integer from 1 to 5, or null.' })
    }
    return { id, question_rate: rate }
  })
}

api.register('POST', '/surveys/responses', ({ body }): ApiEnvelope<{ responseId: string }> => {
  const input = body as Body
  const surveyId = surveyIdOf(input)
  const answers = parseAnswers(input?.responses)
  const comment = typeof input?.comment === 'string' ? input.comment.trim() : ''
  if (comment.length > 2000) throw DemoApiError.validation({ comment: 'Ensure this field has no more than 2000 characters.' })

  const found = lookup(surveyId)
  if (!found.ok) return found.envelope
  const { link } = found

  // One answer per campaign question, in order; anything not sent is a skip (null).
  const byId = new Map(answers.map((answer) => [answer.id, answer.question_rate]))
  const campaignAnswers: Answer[] = store.data.questions
    .filter((question) => question.campaignId === link.campaignId)
    .sort((a, b) => a.order - b.order)
    .map((question) => ({ id: question.id, question_rate: byId.get(question.id) ?? null }))

  const now = clock.now().toISOString()
  const response: SurveyResponse = {
    id: store.nextId('rsp_'),
    surveyId: link.id,
    campaignId: link.campaignId,
    tenantId: link.tenantId,
    branchId: link.branchId,
    staffId: link.staffId,
    answers: campaignAnswers,
    comment,
    commentLang: comment ? (GEORGIAN.test(comment) ? 'ka' : 'en') : langOf(input),
    submittedAt: now,
    source: 'session',
  }

  store.data.responses.unshift(response)
  link.status = 'completed'
  link.completedAt = now
  link.responseId = response.id
  store.notify()

  bus.emit('response:created', { responseId: response.id, surveyId: link.id, campaignId: link.campaignId, source: 'session' })
  bus.emit('link:updated', { surveyId: link.id, status: 'completed' })

  return { success: true, data: { responseId: response.id } }
})
