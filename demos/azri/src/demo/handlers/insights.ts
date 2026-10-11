/**
 * Admin results console: overview and responses.
 *
 * Owner: feature group insights. Endpoints (see PLAN.md):
 *   GET /api/console/overview?tenantId&branchId&staffId&campaignId&days -> Overview
 *   GET /api/console/responses?tenantId&branchId&staffId&campaignId&days&rating&hasComment&q&page&pageSize -> Page<ResponseRow>
 *   GET /api/console/responses/:responseId -> ResponseDetail
 */
import Fuse from 'fuse.js'
import { notFound } from '@portfolio/demo-kit'

import type { BreakdownRow, Overview } from '@/features/insights/types'
import type { ResponseRow, SurveyLink, SurveyResponse } from '@/types'
import {
  computeKpis,
  distributionOf,
  linksInScope,
  MS_DAY,
  paginate,
  parseScope,
  questionStats,
  ratingsOf,
  mean,
  responsesInScope,
  toResponseDetail,
  toResponseRow,
  trendSeries,
  type Scope,
} from '../analytics'
import { api, clock, requireRole, store } from '../core'

const ALLOWED_DAYS = [7, 30, 90]

/** Scope with the window clamped to 7 / 30 / 90 days (default 30). */
function consoleScope(params: Record<string, string>): Scope & { days: number } {
  const scope = parseScope(params)
  const days = scope.days && ALLOWED_DAYS.includes(scope.days) ? scope.days : 30
  return { ...scope, days }
}

function breakdownRow(
  id: string,
  name: BreakdownRow['name'],
  tenantId: string,
  links: SurveyLink[],
  responses: SurveyResponse[],
  now: Date,
): BreakdownRow {
  const kpis = computeKpis(links, responses, now)
  return {
    id,
    name,
    tenantId,
    sent: links.length,
    responses: responses.length,
    avgRating: mean(ratingsOf(responses)),
    responseRate: kpis.responseRate,
  }
}

api.register('GET', '/console/overview', ({ params }) => {
  requireRole('admin')
  const scope = consoleScope(params)
  const now = clock.now()
  const prevNow = new Date(now.getTime() - scope.days * MS_DAY)

  const links = linksInScope(scope, now)
  const responses = responsesInScope(scope, now)
  const prevLinks = linksInScope(scope, prevNow)
  const prevResponses = responsesInScope(scope, prevNow).filter((r) => new Date(r.submittedAt) <= prevNow)

  const { tenants, branches } = store.data
  let breakdown: Overview['breakdown']
  if (scope.tenantId) {
    const rows = branches
      .filter((b) => b.tenantId === scope.tenantId && (!scope.branchId || b.id === scope.branchId))
      .map((b) =>
        breakdownRow(
          b.id,
          b.name,
          b.tenantId,
          links.filter((l) => l.branchId === b.id),
          responses.filter((r) => r.branchId === b.id),
          now,
        ),
      )
    breakdown = { level: 'branch', rows }
  } else {
    const rows = tenants.map((t) =>
      breakdownRow(
        t.id,
        t.name,
        t.id,
        links.filter((l) => l.tenantId === t.id),
        responses.filter((r) => r.tenantId === t.id),
        now,
      ),
    )
    breakdown = { level: 'tenant', rows }
  }
  breakdown.rows.sort((a, b) => b.responses - a.responses)

  const overview: Overview = {
    days: scope.days,
    kpis: computeKpis(links, responses, now),
    previous: computeKpis(prevLinks, prevResponses, prevNow),
    responses: responses.length,
    previousResponses: prevResponses.length,
    trend: trendSeries(responses, scope.days, now),
    distribution: distributionOf(responses),
    breakdown,
    questions: scope.campaignId ? questionStats(scope.campaignId, responses) : [],
    latestComments: responses
      .filter((r) => r.comment.trim())
      .slice(0, 8)
      .map(toResponseRow),
  }
  return overview
})

api.register('GET', '/console/responses', ({ params }) => {
  requireRole('admin')
  const scope = consoleScope(params)
  let rows: ResponseRow[] = responsesInScope(scope).map(toResponseRow)

  const rating = Number(params.rating)
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
    rows = rows.filter((row) => row.avgRating != null && Math.round(row.avgRating) === rating)
  }
  if (params.hasComment === 'true') rows = rows.filter((row) => row.comment.trim().length > 0)

  const q = (params.q ?? '').trim()
  if (q) {
    const fuse = new Fuse(rows, {
      keys: ['comment', 'staffName.en', 'staffName.ka', 'branchName.en', 'branchName.ka', 'surveyId'],
      threshold: 0.34,
      ignoreLocation: true,
      minMatchCharLength: 2,
    })
    const hits = new Set(fuse.search(q).map((hit) => hit.item.id))
    // Keep newest-first order rather than relevance, so live rows stay on top.
    rows = rows.filter((row) => hits.has(row.id))
  }

  return paginate(rows, params, 20)
})

api.register('GET', '/console/responses/:responseId', ({ path }) => {
  requireRole('admin')
  const response = store.data.responses.find((r) => r.id === path.responseId)
  if (!response) throw notFound()
  return toResponseDetail(response)
})
