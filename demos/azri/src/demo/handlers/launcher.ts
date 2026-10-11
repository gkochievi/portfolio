/**
 * SMS inbox launcher and API playground.
 *
 * Owner: feature group launcher. Endpoints (see PLAN.md):
 *   GET  /api/inbox/recipients                       -> RecipientSummary[]
 *   GET  /api/inbox/recipients/:recipientId/messages -> InboxMessage[]
 *   GET  /api/inbox/branches                         -> BranchSample[] (try-every-branch strip)
 *   GET  /api/playground/routes                      -> PlaygroundRoute[] (api.routes())
 *   GET  /api/playground/clock                       -> { offsetMs, now }
 *   POST /api/playground/clock  { days }             -> { offsetMs, now } (time travel; days 0 resets)
 */
import { DemoApiError, notFound } from '@portfolio/demo-kit'

import type {
  BranchSample,
  ClockState,
  InboxLinkStatus,
  InboxMessage,
  PlaygroundRoute,
  RecipientSummary,
  TenantBrandingLite,
} from '@/features/launcher/types'
import type { SmsMessage, SurveyLink, Tenant } from '@/types'

import { effectiveStatus, MS_DAY } from '../analytics'
import { api, bus, clock, store } from '../core'
import { accounts, SAMPLE_TOKENS } from '../seed'

/** Furthest the playground lets the demo clock travel. */
const MAX_DAYS = 60

/* ----------------------------------------------------------------- joins */

function linkFor(message: SmsMessage): SurveyLink | undefined {
  if (!message.surveyId) return undefined
  return store.data.links.find((link) => link.id === message.surveyId)
}

/** Live status: `missing` without an id, `unknown` when the token is not in the store. */
function statusOf(message: SmsMessage, now: Date): InboxLinkStatus {
  if (message.kind === 'missing' || !message.surveyId) return 'missing'
  const link = linkFor(message)
  if (!link) return 'unknown'
  return effectiveStatus(link, now)
}

function brandingLite(tenant: Tenant): TenantBrandingLite {
  return {
    id: tenant.id,
    name: tenant.name,
    monogram: tenant.monogram,
    smsSender: tenant.smsSender,
    primary: tenant.primary,
    onPrimary: tenant.onPrimary,
    tint: tenant.tint,
    primaryDark: tenant.primaryDark,
  }
}

function toInboxMessage(message: SmsMessage, now: Date): InboxMessage {
  const tenant = store.data.tenants.find((item) => item.id === message.tenantId)
  const link = linkFor(message)
  const campaign = link ? store.data.campaigns.find((item) => item.id === link.campaignId) : undefined
  return {
    ...message,
    linkStatus: statusOf(message, now),
    tenant: tenant
      ? brandingLite(tenant)
      : {
          id: message.tenantId,
          name: { en: message.sender, ka: message.sender },
          monogram: message.sender.slice(0, 2),
          smsSender: message.sender,
          primary: '#7A2A68',
          onPrimary: '#FFFFFF',
          tint: '#F3E6EF',
          primaryDark: '#E3A6D3',
        },
    campaignId: campaign?.id ?? null,
    campaignTitle: campaign?.title ?? null,
    expiresAt: link?.expiresAt ?? null,
    completedAt: link?.completedAt ?? null,
  }
}

/** Messages already delivered by demo time, newest first. */
function deliveredMessages(now: Date): SmsMessage[] {
  return store.data.messages
    .filter((message) => new Date(message.receivedAt).getTime() <= now.getTime() + 60_000)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
}

function clockState(): ClockState {
  return { offsetMs: clock.offsetMs(), now: clock.now().toISOString() }
}

/* ----------------------------------------------------------------- inbox */

api.register('GET', '/inbox/recipients', (): RecipientSummary[] => {
  const now = clock.now()
  const messages = deliveredMessages(now)
  return store.data.recipients.map((recipient) => {
    const counts = { pending: 0, completed: 0, expired: 0, total: 0 }
    for (const message of messages) {
      if (message.recipientId !== recipient.id) continue
      counts.total += 1
      const status = statusOf(message, now)
      if (status === 'pending' || status === 'completed' || status === 'expired') counts[status] += 1
    }
    return {
      id: recipient.id,
      name: recipient.name,
      phoneMasked: recipient.phoneMasked,
      avatarColor: recipient.avatarColor,
      accountId: accounts.find((account) => account.recipientId === recipient.id)?.id ?? null,
      counts,
    }
  })
})

api.register('GET', '/inbox/recipients/:recipientId/messages', ({ path }): InboxMessage[] => {
  const recipient = store.data.recipients.find((item) => item.id === path.recipientId)
  if (!recipient) throw notFound()
  const now = clock.now()
  return deliveredMessages(now)
    .filter((message) => message.recipientId === recipient.id)
    .map((message) => toInboxMessage(message, now))
})

api.register('GET', '/inbox/branches', (): BranchSample[] => {
  const now = clock.now()
  const messages = deliveredMessages(now)
  const personaLinks = messages
    .filter((message) => message.kind === 'survey' && message.surveyId)
    .map((message) => ({ message, link: linkFor(message) }))
    .filter((pair): pair is { message: SmsMessage; link: SurveyLink } => Boolean(pair.link))

  const sample = (kind: BranchSample['kind'], message: SmsMessage | undefined): BranchSample => ({
    kind,
    surveyId: message?.surveyId ?? null,
    href: message?.href ?? '',
    tenantId: message?.tenantId ?? null,
    recipientId: message?.recipientId ?? null,
  })

  const byStatus = (status: 'pending' | 'completed' | 'expired', preferred: string) => {
    const matching = personaLinks.filter(({ link }) => effectiveStatus(link, now) === status)
    return (matching.find(({ link }) => link.id === preferred) ?? matching[0])?.message
  }

  // Valid: the first still-pending persona link; once time travel has spent
  // them all, fall back to a background link so the chip keeps working.
  const valid = byStatus('pending', SAMPLE_TOKENS.valid)
  let validSample = sample('valid', valid)
  if (!valid) {
    const background = store.data.links.find(
      (link) => link.recipientId === null && effectiveStatus(link, now) === 'pending',
    )
    if (background) {
      validSample = {
        kind: 'valid',
        surveyId: background.id,
        href: `/?id=${background.id}`,
        tenantId: background.tenantId,
        recipientId: null,
      }
    }
  }

  return [
    validSample,
    sample('completed', byStatus('completed', SAMPLE_TOKENS.completed)),
    sample('expired', byStatus('expired', SAMPLE_TOKENS.expired)),
    sample(
      'unknown',
      messages.find((message) => message.kind === 'unknown' && message.surveyId && !linkFor(message)),
    ),
    sample(
      'missing',
      messages.find((message) => message.kind === 'missing'),
    ),
  ]
})

/* ------------------------------------------------------------ playground */

api.register('GET', '/playground/routes', (): PlaygroundRoute[] =>
  api.routes().map((route) => ({
    method: route.method,
    path: `/api${route.pattern}`,
    requiresAuth: route.requiresAuth,
  })),
)

api.register('GET', '/playground/clock', (): ClockState => clockState())

api.register('POST', '/playground/clock', ({ body }): ClockState => {
  const input = (body ?? {}) as { days?: unknown }
  const days = typeof input.days === 'string' && input.days.trim() !== '' ? Number(input.days) : input.days
  if (typeof days !== 'number' || !Number.isFinite(days)) {
    throw DemoApiError.validation({ days: 'A number of days is required.' })
  }
  if (days < 0 || days > MAX_DAYS) {
    throw DemoApiError.validation({ days: `Ensure this value is between 0 and ${MAX_DAYS}.` })
  }

  const previous = clock.offsetMs()
  const offsetMs = Math.round(days * MS_DAY)

  // Travelling back: links that only expired because the clock moved past
  // their expiry (never answered, expiry now in the future again) are pending again.
  if (offsetMs < previous) {
    const target = new Date(Date.now() + offsetMs)
    for (const link of store.data.links) {
      if (link.status === 'expired' && !link.completedAt && new Date(link.expiresAt).getTime() > target.getTime()) {
        link.status = 'pending'
        bus.emit('link:updated', { surveyId: link.id, status: 'pending' })
      }
    }
  }

  clock.setOffset(offsetMs)
  return clockState()
})
