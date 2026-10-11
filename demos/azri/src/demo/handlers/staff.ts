/**
 * Branch staff: own scores and the Send survey SMS form.
 *
 * Owner: feature group staff. Endpoints (see PLAN.md):
 *   GET  /api/console/me/overview?days   -> MyOverview
 *   GET  /api/console/me/responses?page  -> Page<ResponseRow>
 *   GET  /api/console/send/options       -> SendOptions
 *   POST /api/console/send               SendSurveyRequest -> LinkRow
 *   GET  /api/console/me/links?page      -> Page<LinkRow>
 *
 * An agent is always scoped to their own staffId, branchId and tenantId,
 * whatever params arrive.
 */
import { DemoApiError } from '@portfolio/demo-kit'

import type { AzriAccount, LinkRow, Page, ResponseRow, SmsMessage, Staff, SurveyLink } from '@/types'
import type { MyOverview, SendOptions, SendSurveyRequest } from '@/features/staff/types'
import { FAKE_PHONE_RE, maskPhone, shortLink, smsBody } from '@/features/staff/sms'
import {
  computeKpis,
  distributionOf,
  linksInScope,
  MS_DAY,
  mean,
  paginate,
  questionStats,
  ratingsOf,
  responsesInScope,
  toLinkRow,
  toResponseRow,
  trendSeries,
} from '../analytics'
import { api, bus, clock, generateToken, requireRole, store } from '../core'
import { scheduleSmsDelivery } from '../simulators/staff'

/** The staff record behind an agent account (403 if the account has none). */
function agentStaff(me: AzriAccount): Staff {
  const staff = store.data.staff.find((s) => s.id === me.staffId)
  if (!staff) throw new DemoApiError(403, 'This account is not linked to a staff member.')
  return staff
}

function parseDays(raw: string | undefined): number {
  const days = Number(raw)
  return [7, 30, 90].includes(days) ? days : 30
}

/* ------------------------------------------------------------ my overview */

api.register('GET', '/console/me/overview', ({ params }): MyOverview => {
  const staff = agentStaff(requireRole('agent'))
  const { branches, tenants, campaigns } = store.data
  const branch = branches.find((b) => b.id === staff.branchId)
  const tenant = tenants.find((t) => t.id === staff.tenantId)
  if (!branch || !tenant) throw new DemoApiError(500, 'Staff record is incomplete.')

  const days = parseDays(params.days)
  const now = clock.now()
  const mine = { staffId: staff.id, days }
  const myLinks = linksInScope(mine, now)
  const myResponses = responsesInScope(mine, now)

  // His campaign: the one in his tenant he has sent the most links for (all time).
  const counts = new Map<string, number>()
  for (const link of store.data.links) {
    if (link.staffId === staff.id) counts.set(link.campaignId, (counts.get(link.campaignId) ?? 0) + 1)
  }
  const tenantCampaigns = campaigns.filter((c) => c.tenantId === tenant.id)
  const campaign =
    [...tenantCampaigns].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))[0] ?? null

  // Rank among the branch's staff by average rating in the window.
  const branchStaff = store.data.staff.filter((s) => s.branchId === branch.id)
  const ranked = branchStaff
    .map((s) => ({ id: s.id, avg: mean(ratingsOf(responsesInScope({ staffId: s.id, days }, now))) }))
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1))
  const position = ranked.findIndex((r) => r.id === staff.id) + 1

  return {
    staff,
    branch,
    tenant,
    days,
    kpis: computeKpis(myLinks, myResponses, now),
    responseCount: myResponses.length,
    trend: trendSeries(myResponses, days, now),
    distribution: distributionOf(myResponses),
    campaign,
    questions: campaign ? questionStats(campaign.id, myResponses) : [],
    myAvg: mean(ratingsOf(myResponses)),
    branchAvg: mean(ratingsOf(responsesInScope({ branchId: branch.id, days }, now))),
    tenantAvg: mean(ratingsOf(responsesInScope({ tenantId: tenant.id, days }, now))),
    rank: { position: position || branchStaff.length, of: branchStaff.length },
  }
})

/* ----------------------------------------------------------- my responses */

api.register('GET', '/console/me/responses', ({ params }): Page<ResponseRow> => {
  const staff = agentStaff(requireRole('agent'))
  let responses = responsesInScope({ staffId: staff.id })
  if (params.hasComment === 'true') responses = responses.filter((r) => r.comment.trim().length > 0)
  return paginate(responses.map(toResponseRow), params, 8)
})

/* ----------------------------------------------------------- send options */

api.register('GET', '/console/send/options', (): SendOptions => {
  const me = requireRole('admin', 'agent')
  const { tenants, campaigns, branches, staff, recipients } = store.data
  if (me.role === 'agent') {
    const self = agentStaff(me)
    return {
      tenants: tenants.filter((t) => t.id === self.tenantId),
      campaigns: campaigns.filter((c) => c.tenantId === self.tenantId),
      branches: branches.filter((b) => b.id === self.branchId),
      staff: [self],
      recipients,
      locked: true,
    }
  }
  return { tenants, campaigns, branches, staff, recipients, locked: false }
})

/* ------------------------------------------------------------------- send */

api.register('POST', '/console/send', ({ body }): LinkRow => {
  const me = requireRole('admin', 'agent')
  const input = (body ?? {}) as Partial<SendSurveyRequest>
  const { campaigns, branches, staff: allStaff, recipients, tenants } = store.data

  let branchId = input.branchId ?? ''
  let staffId = input.staffId ?? ''
  if (me.role === 'agent') {
    const self = agentStaff(me)
    branchId = self.branchId
    staffId = self.id
  }

  const errors: Record<string, string> = {}
  const campaign = campaigns.find((c) => c.id === input.campaignId)
  const branch = branches.find((b) => b.id === branchId)
  const member = allStaff.find((s) => s.id === staffId)

  if (!campaign) errors.campaignId = 'Choose a campaign.'
  if (!branch) errors.branchId = 'Choose a branch.'
  if (!member) errors.staffId = 'Choose a staff member.'
  if (campaign && branch && campaign.tenantId !== branch.tenantId) {
    errors.campaignId = 'This campaign belongs to another business.'
  }
  if (member && branch && member.branchId !== branch.id) errors.staffId = 'This staff member works at another branch.'

  const recipientId = input.recipientId?.trim() || undefined
  const phone = input.phone?.replace(/\D/g, '') || undefined
  const recipient = recipientId ? recipients.find((r) => r.id === recipientId) : undefined
  if (recipientId && phone) errors.recipientId = 'Give either a demo persona or a phone number, not both.'
  else if (!recipientId && !phone) errors.recipientId = 'Choose a demo persona or enter a phone number.'
  else if (recipientId && !recipient) errors.recipientId = 'Unknown demo persona.'
  else if (phone && !FAKE_PHONE_RE.test(phone)) errors.phone = 'Use the demo pattern 5XX 00 00 XX.'

  const now = clock.now()
  let interactionAt = now
  if (input.interactionAt) {
    const parsed = new Date(input.interactionAt)
    if (Number.isNaN(parsed.getTime())) errors.interactionAt = 'Enter a valid date and time.'
    else if (parsed.getTime() > now.getTime() + 5 * 60_000) errors.interactionAt = 'The interaction cannot be in the future.'
    else if (parsed.getTime() < now.getTime() - 30 * MS_DAY) errors.interactionAt = 'The interaction must be within the last 30 days.'
    else interactionAt = parsed
  }

  if (Object.keys(errors).length || !campaign || !branch || !member) throw DemoApiError.validation(errors)
  const tenant = tenants.find((t) => t.id === campaign.tenantId)
  if (!tenant) throw new DemoApiError(500, 'Campaign has no business.')

  const token = generateToken()
  const link: SurveyLink = {
    id: token,
    campaignId: campaign.id,
    tenantId: tenant.id,
    branchId: branch.id,
    staffId: member.id,
    recipientId: recipient?.id ?? null,
    phoneMasked: recipient ? recipient.phoneMasked : maskPhone(phone ?? ''),
    interactionAt: interactionAt.toISOString(),
    sentAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + campaign.linkTtlDays * MS_DAY).toISOString(),
    status: 'pending',
    completedAt: null,
    responseId: null,
    sentBy: member.id,
  }
  store.data.links.unshift(link)
  bus.emit('link:updated', { surveyId: token, status: 'pending' })

  if (recipient) {
    scheduleSmsDelivery(() => {
      // The link may have vanished if the demo was reset meanwhile.
      if (!store.data.links.some((l) => l.id === token)) return
      const message: SmsMessage = {
        id: store.nextId('sms_'),
        recipientId: recipient.id,
        tenantId: tenant.id,
        sender: tenant.smsSender,
        body: smsBody(tenant, branch, token),
        shortLink: shortLink(token),
        href: `/?id=${token}`,
        surveyId: token,
        kind: 'survey',
        receivedAt: clock.now().toISOString(),
      }
      store.data.messages.unshift(message)
      bus.emit('sms:received', { messageId: message.id, recipientId: recipient.id, tenantId: tenant.id })
    }, 1200)
  }

  return toLinkRow(link, now)
})

/* --------------------------------------------------------------- my links */

api.register('GET', '/console/me/links', ({ params }): Page<LinkRow> => {
  const me = requireRole('admin', 'agent')
  const self = me.role === 'agent' ? agentStaff(me) : null
  const now = clock.now()
  const links = store.data.links
    .filter((l) => (self ? l.sentBy === self.id : l.sentBy !== 'system'))
    .filter((l) => new Date(l.sentAt).getTime() <= now.getTime())
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  return paginate(
    links.map((l) => toLinkRow(l, now)),
    params,
    8,
  )
})
