/**
 * Pure selectors over the store that several handler modules share (insights,
 * campaigns, staff, launcher, survey). Import from here instead of
 * re-implementing KPI maths per group, so every screen agrees on the numbers.
 *
 * Owner: architect (seed agent may extend; do not change semantics).
 */
import { format } from 'date-fns'

import type {
  Distribution,
  KpiSet,
  Lang,
  LinkRow,
  LinkStatus,
  LocalizedText,
  Page,
  QuestionStat,
  ResponseDetail,
  ResponseRow,
  SurveyLink,
  SurveyResponse,
  Tenant,
  TenantBranding,
  TrendPoint,
} from '@/types'
import { clock, store } from './core'

export const MS_DAY = 86_400_000

const EMPTY_TEXT: LocalizedText = { en: '', ka: '' }

/* ------------------------------------------------------------------ scope */

export interface Scope {
  tenantId?: string
  branchId?: string
  staffId?: string
  campaignId?: string
  /** Look-back window in days; undefined = all time. */
  days?: number
}

/** Read a Scope from a handler's `req.params` (all strings). */
export function parseScope(params: Record<string, string>): Scope {
  const scope: Scope = {}
  if (params.tenantId) scope.tenantId = params.tenantId
  if (params.branchId) scope.branchId = params.branchId
  if (params.staffId) scope.staffId = params.staffId
  if (params.campaignId) scope.campaignId = params.campaignId
  const days = Number(params.days)
  if (Number.isFinite(days) && days > 0) scope.days = days
  return scope
}

interface Scoped {
  tenantId: string
  branchId: string
  staffId: string
  campaignId: string
}

export function matchesScope(item: Scoped, scope: Scope): boolean {
  return (
    (!scope.tenantId || item.tenantId === scope.tenantId) &&
    (!scope.branchId || item.branchId === scope.branchId) &&
    (!scope.staffId || item.staffId === scope.staffId) &&
    (!scope.campaignId || item.campaignId === scope.campaignId)
  )
}

/** Start of the look-back window (midnight `days - 1` days ago), or null for all time. */
export function windowStart(days: number | undefined, now: Date = clock.now()): Date | null {
  if (!days) return null
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return new Date(start.getTime() - (days - 1) * MS_DAY)
}

/** A pending link whose expiry has passed (demo clock) counts as expired. */
export function effectiveStatus(link: SurveyLink, now: Date = clock.now()): LinkStatus {
  if (link.status === 'pending' && new Date(link.expiresAt).getTime() <= now.getTime()) return 'expired'
  return link.status
}

/** Links SENT inside the scope and window. */
export function linksInScope(scope: Scope, now: Date = clock.now()): SurveyLink[] {
  const start = windowStart(scope.days, now)
  return store.data.links.filter(
    (link) =>
      matchesScope(link, scope) &&
      (!start || new Date(link.sentAt) >= start) &&
      new Date(link.sentAt).getTime() <= now.getTime(),
  )
}

/** Responses SUBMITTED inside the scope and window, newest first. */
export function responsesInScope(scope: Scope, now: Date = clock.now()): SurveyResponse[] {
  const start = windowStart(scope.days, now)
  return store.data.responses
    .filter((response) => matchesScope(response, scope) && (!start || new Date(response.submittedAt) >= start))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

/* ------------------------------------------------------------------ maths */

export function ratingsOf(responses: SurveyResponse[]): number[] {
  const out: number[] = []
  for (const response of responses) {
    for (const answer of response.answers) if (answer.question_rate != null) out.push(answer.question_rate)
  }
  return out
}

export function mean(values: number[]): number | null {
  if (!values.length) return null
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100
}

/** Mean of a single response's answered ratings. */
export function responseAverage(response: SurveyResponse): number | null {
  return mean(ratingsOf([response]))
}

export function distributionOf(responses: SurveyResponse[]): Distribution {
  const counts: Distribution = [0, 0, 0, 0, 0]
  for (const rate of ratingsOf(responses)) if (rate >= 1 && rate <= 5) counts[rate - 1] += 1
  return counts
}

export function computeKpis(links: SurveyLink[], responses: SurveyResponse[], now: Date = clock.now()): KpiSet {
  const ratings = ratingsOf(responses)
  const statuses = links.map((link) => effectiveStatus(link, now))
  const completed = statuses.filter((s) => s === 'completed').length
  const today = format(now, 'yyyy-MM-dd')
  return {
    csat: ratings.length ? Math.round((ratings.filter((r) => r >= 4).length / ratings.length) * 1000) / 10 : 0,
    avgRating: mean(ratings) ?? 0,
    responseRate: links.length ? Math.round((completed / links.length) * 1000) / 10 : 0,
    responsesToday: responses.filter((r) => format(new Date(r.submittedAt), 'yyyy-MM-dd') === today).length,
    sent: links.length,
    completed,
    expired: statuses.filter((s) => s === 'expired').length,
    pending: statuses.filter((s) => s === 'pending').length,
  }
}

/** One point per calendar day for the last `days` days (oldest first), zero-filled. */
export function trendSeries(responses: SurveyResponse[], days: number, now: Date = clock.now()): TrendPoint[] {
  const buckets = new Map<string, SurveyResponse[]>()
  for (const response of responses) {
    const key = format(new Date(response.submittedAt), 'yyyy-MM-dd')
    const bucket = buckets.get(key)
    if (bucket) bucket.push(response)
    else buckets.set(key, [response])
  }
  const points: TrendPoint[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = format(new Date(now.getTime() - i * MS_DAY), 'yyyy-MM-dd')
    const bucket = buckets.get(date) ?? []
    points.push({ date, responses: bucket.length, avgRating: mean(ratingsOf(bucket)) })
  }
  return points
}

/** Per-question mean and 1-5 histogram for one campaign's questions. */
export function questionStats(campaignId: string, responses: SurveyResponse[]): QuestionStat[] {
  const questions = store.data.questions
    .filter((q) => q.campaignId === campaignId)
    .sort((a, b) => a.order - b.order)
  return questions.map((question) => {
    const distribution: Distribution = [0, 0, 0, 0, 0]
    const rates: number[] = []
    let skipped = 0
    for (const response of responses) {
      if (response.campaignId !== campaignId) continue
      const answer = response.answers.find((a) => a.id === question.id)
      if (!answer || answer.question_rate == null) {
        skipped += 1
        continue
      }
      rates.push(answer.question_rate)
      distribution[answer.question_rate - 1] += 1
    }
    return { questionId: question.id, text: question.text, avg: mean(rates), answered: rates.length, skipped, distribution }
  })
}

/* ------------------------------------------------------------------ joins */

const find = <T extends { id: string }>(items: T[], id: string | null | undefined): T | undefined =>
  id ? items.find((item) => item.id === id) : undefined

export function toResponseRow(response: SurveyResponse): ResponseRow {
  const { tenants, campaigns, branches, staff, links, recipients, questions } = store.data
  const link = find(links, response.surveyId)
  const recipient = find(recipients, link?.recipientId)
  return {
    id: response.id,
    surveyId: response.surveyId,
    tenantId: response.tenantId,
    tenantName: find(tenants, response.tenantId)?.name ?? EMPTY_TEXT,
    campaignTitle: find(campaigns, response.campaignId)?.title ?? EMPTY_TEXT,
    branchName: find(branches, response.branchId)?.name ?? EMPTY_TEXT,
    staffName: find(staff, response.staffId)?.name ?? EMPTY_TEXT,
    phoneMasked: recipient?.phoneMasked ?? link?.phoneMasked ?? '',
    recipientName: recipient?.name ?? null,
    avgRating: responseAverage(response),
    answeredCount: response.answers.filter((a) => a.question_rate != null).length,
    questionCount: questions.filter((q) => q.campaignId === response.campaignId).length,
    comment: response.comment,
    commentLang: response.commentLang,
    submittedAt: response.submittedAt,
    source: response.source,
  }
}

export function toResponseDetail(response: SurveyResponse): ResponseDetail {
  const link = find(store.data.links, response.surveyId)
  const questions = store.data.questions
    .filter((q) => q.campaignId === response.campaignId)
    .sort((a, b) => a.order - b.order)
  return {
    ...toResponseRow(response),
    answers: questions.map((q) => ({
      questionId: q.id,
      text: q.text,
      rate: response.answers.find((a) => a.id === q.id)?.question_rate ?? null,
    })),
    link: {
      sentAt: link?.sentAt ?? response.submittedAt,
      expiresAt: link?.expiresAt ?? response.submittedAt,
      completedAt: link?.completedAt ?? response.submittedAt,
      interactionAt: link?.interactionAt ?? response.submittedAt,
      sentBy: link?.sentBy ?? 'system',
    },
  }
}

export function toLinkRow(link: SurveyLink, now: Date = clock.now()): LinkRow {
  const { tenants, campaigns, branches, staff, recipients } = store.data
  return {
    ...link,
    status: effectiveStatus(link, now),
    tenantName: find(tenants, link.tenantId)?.name ?? EMPTY_TEXT,
    campaignTitle: find(campaigns, link.campaignId)?.title ?? EMPTY_TEXT,
    branchName: find(branches, link.branchId)?.name ?? EMPTY_TEXT,
    staffName: find(staff, link.staffId)?.name ?? EMPTY_TEXT,
    recipientName: find(recipients, link.recipientId)?.name ?? null,
  }
}

/** White-label branding for the microsite, with the name in `lang`. */
export function tenantBranding(tenant: Tenant, lang: Lang): TenantBranding {
  return {
    id: tenant.id,
    name: lang === 'ka' ? tenant.name.ka : tenant.name.en,
    monogram: tenant.monogram,
    copyrightName: tenant.copyrightName,
    smsSender: tenant.smsSender,
    primary: tenant.primary,
    onPrimary: tenant.onPrimary,
    tint: tenant.tint,
    primaryDark: tenant.primaryDark,
  }
}

/** `?page=1&pageSize=25` pagination (1-based). */
export function paginate<T>(items: T[], params: Record<string, string>, defaultSize = 25): Page<T> {
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || defaultSize))
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(pages, Math.max(1, Number(params.page) || 1))
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize }
}
