/**
 * Admin campaigns and SMS dispatch log.
 *
 * Owner: feature group campaigns. Endpoints (see PLAN.md):
 *   GET /api/console/campaigns?tenantId&days                 -> CampaignSummary[]
 *   GET /api/console/campaigns/:campaignId?days               -> CampaignDetail
 *   GET /api/console/links?status&tenantId&campaignId&branchId&q&page&pageSize -> LinksPage
 */
import { notFound } from '@portfolio/demo-kit'

import type {
  BranchBreakdown,
  CampaignDetail,
  CampaignSummary,
  LinkCounts,
  LinksPage,
} from '@/features/campaigns/types'
import type { LinkRow } from '@/types'
import {
  computeKpis,
  distributionOf,
  effectiveStatus,
  linksInScope,
  mean,
  paginate,
  parseScope,
  questionStats,
  ratingsOf,
  responsesInScope,
  toLinkRow,
  toResponseRow,
  trendSeries,
} from '../analytics'
import { api, clock, requireRole, store } from '../core'

const SPARK_DAYS = 14

/* ------------------------------------------------------------ campaigns */

api.register('GET', '/console/campaigns', ({ params }): CampaignSummary[] => {
  requireRole('admin')
  const scope = parseScope(params)
  const now = clock.now()
  const { campaigns, tenants, questions } = store.data
  return campaigns
    .filter((campaign) => !scope.tenantId || campaign.tenantId === scope.tenantId)
    .flatMap((campaign) => {
      const tenant = tenants.find((t) => t.id === campaign.tenantId)
      if (!tenant) return []
      const links = linksInScope({ campaignId: campaign.id, days: scope.days }, now)
      const responses = responsesInScope({ campaignId: campaign.id, days: scope.days }, now)
      const sparkResponses = responsesInScope({ campaignId: campaign.id, days: SPARK_DAYS }, now)
      return [
        {
          campaign,
          tenant,
          questionCount: questions.filter((q) => q.campaignId === campaign.id).length,
          kpis: computeKpis(links, responses, now),
          trend: trendSeries(sparkResponses, SPARK_DAYS, now),
        },
      ]
    })
})

api.register('GET', '/console/campaigns/:campaignId', ({ path, params }): CampaignDetail => {
  requireRole('admin')
  const campaign = store.data.campaigns.find((c) => c.id === path.campaignId)
  if (!campaign) throw notFound('Campaign not found.')
  const tenant = store.data.tenants.find((t) => t.id === campaign.tenantId)
  if (!tenant) throw notFound('Campaign not found.')

  const now = clock.now()
  const days = parseScope(params).days ?? 30
  const links = linksInScope({ campaignId: campaign.id, days }, now)
  const responses = responsesInScope({ campaignId: campaign.id, days }, now)

  const byBranch: BranchBreakdown[] = store.data.branches
    .filter((branch) => branch.tenantId === campaign.tenantId)
    .map((branch) => {
      const branchLinks = links.filter((l) => l.branchId === branch.id)
      return {
        branchId: branch.id,
        name: branch.name,
        sent: branchLinks.length,
        completed: branchLinks.filter((l) => effectiveStatus(l, now) === 'completed').length,
        avgRating: mean(ratingsOf(responses.filter((r) => r.branchId === branch.id))),
      }
    })
    .filter((row) => row.sent > 0 || row.avgRating !== null)
    .sort((a, b) => b.sent - a.sent)

  // "First" = in persona order (Mariam first, as in the inbox), newest link per persona.
  const personaOrder = new Map(store.data.recipients.map((r, i) => [r.id, i]))
  const sample = store.data.links
    .filter(
      (l) => l.campaignId === campaign.id && l.recipientId !== null && effectiveStatus(l, now) === 'pending',
    )
    .sort(
      (a, b) =>
        (personaOrder.get(a.recipientId ?? '') ?? 99) - (personaOrder.get(b.recipientId ?? '') ?? 99) ||
        b.sentAt.localeCompare(a.sentAt),
    )[0]

  return {
    campaign,
    tenant,
    questions: questionStats(campaign.id, responses),
    kpis: computeKpis(links, responses, now),
    trend: trendSeries(responses, days, now),
    distribution: distributionOf(responses),
    byBranch,
    latestComments: responses
      .filter((r) => r.comment.trim().length > 0)
      .slice(0, 8)
      .map(toResponseRow),
    sampleLinkId: sample?.id ?? null,
  }
})

/* ------------------------------------------------------- dispatch log */

const STATUSES = new Set(['pending', 'completed', 'expired'])

/** Lower-case letters and digits only, so "451", "5•• 451" and "+995 5" all match a masked phone. */
const squash = (value: string) => value.toLowerCase().replace(/[^0-9a-z]/g, '')

function matchesQuery(row: LinkRow, q: string): boolean {
  const needle = squash(q)
  if (!needle) return true
  if (row.id.toLowerCase().includes(needle)) return true
  const digits = needle.replace(/[^0-9]/g, '')
  if (digits && digits === needle && squash(row.phoneMasked).includes(digits)) return true
  return false
}

api.register('GET', '/console/links', ({ params }): LinksPage => {
  requireRole('admin')
  const now = clock.now()
  const q = params.q?.trim() ?? ''
  const rows = store.data.links
    .filter(
      (link) =>
        (!params.tenantId || link.tenantId === params.tenantId) &&
        (!params.campaignId || link.campaignId === params.campaignId) &&
        (!params.branchId || link.branchId === params.branchId) &&
        new Date(link.sentAt).getTime() <= now.getTime(),
    )
    .map((link) => toLinkRow(link, now))
    .filter((row) => matchesQuery(row, q))
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))

  const counts: LinkCounts = { all: rows.length, pending: 0, completed: 0, expired: 0 }
  for (const row of rows) counts[row.status] += 1

  const status = params.status && STATUSES.has(params.status) ? params.status : null
  const filtered = status ? rows.filter((row) => row.status === status) : rows
  return { ...paginate(filtered, params, 20), counts }
})
