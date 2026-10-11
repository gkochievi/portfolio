/**
 * Handlers for the admin-integrations feature group: FAQ flow, channel
 * integrations (Meta channels, Telegram Business, TikTok), page comments and
 * the AI link. Admin only (supervisors get 403). Writes mutate `store.data`,
 * broadcast the matching event and append an activity row.
 *
 * Validation errors carry a machine code as the message of each field error
 * (the UI translates them); other errors put the code in `fieldErrors.code`.
 */
import { DemoApiError, notFound } from '@portfolio/demo-kit'

import { validateFaqTree } from '@/features/admin-integrations/faqValidation'
import type { AiLinkView, AiReason, FaqState, IntegrationsView, MetaChannel, MetaTestResult, SimpleTestResult, TikTokCheckResult } from '@/features/admin-integrations/types'
import { META_CHANNELS } from '@/features/admin-integrations/types'
import type { ChannelFeatures, FaqTree, MetaIntegration, PageComment, TelegramIntegration, TenantIntegrations, TikTokIntegration } from '@/types'

import { api } from '../api'
import { broadcast } from '../bus'
import { nowIso } from '../clock'
import { currentTenantId, findTenant, requireRole, tenantSettings } from '../context'
import { aiOutageActive, logActivity } from '../engine'
import { store } from '../store'

type Raw = Record<string, unknown>

const CHANNEL_LABEL: Record<string, string> = {
  facebook_messenger: 'Facebook Messenger',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram Business',
  tiktok: 'TikTok',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TELEGRAM_TOKEN = /^\d{6,12}:[A-Za-z0-9_-]{20,}$/
const TELEGRAM_HANDSHAKE_MS = 10_000
const TIKTOK_POPUP_MS = 4_000

/* ------------------------------------------------------------------ helpers */

function guard(): string {
  requireRole('admin')
  return currentTenantId()
}

const asRaw = (body: unknown): Raw => (body && typeof body === 'object' ? (body as Raw) : {})
const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

function codeError(status: number, message: string, code: string): DemoApiError {
  return new DemoApiError(status, message, { code })
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

function integrationsOf(tenantId: string): TenantIntegrations {
  const row = store.data.integrations.find((item) => item.tenantId === tenantId)
  if (!row) throw notFound('Integrations not found.')
  return row
}

function requireFeature(tenantId: string, key: keyof ChannelFeatures): void {
  if (!findTenant(tenantId).features[key]) throw codeError(403, 'This channel is disabled by the platform.', 'disabled_by_platform')
}

function parseChannel(raw: string | undefined): MetaChannel {
  if (!raw || !META_CHANNELS.includes(raw as MetaChannel)) throw notFound('Unknown channel.')
  return raw as MetaChannel
}

function metaRow(tenantId: string, channel: MetaChannel): MetaIntegration {
  const row = integrationsOf(tenantId).meta.find((item) => item.channel === channel)
  if (!row) throw notFound('Channel not found.')
  return row
}

function emitIntegrations(tenantId: string): void {
  broadcast('integration:update', integrationsOf(tenantId))
}

function preview(secret: string): string {
  return `${secret.slice(0, 3)}••••${secret.slice(-4)}`
}

function audit(action: 'admin_save_integration' | 'admin_test_integration' | 'admin_delete_integration', channel: string, extra: Record<string, string | number | boolean | null> = {}): void {
  logActivity({ action, targetId: channel, targetLabel: CHANNEL_LABEL[channel] ?? channel, metadata: { channel, ...extra } })
}

function view(tenantId: string): IntegrationsView {
  resolveTelegram(tenantId)
  resolveTikTok(tenantId)
  return { ...integrationsOf(tenantId), features: { ...findTenant(tenantId).features }, tiktokPending: tikTokPending.has(tenantId) }
}

/* ----------------------------------------------------------------- pending flows */

/** Raw access tokens typed in the manual form (memory only; the Test button reads them). */
const typedTokens = new Map<string, string>()
const tokenKey = (tenantId: string, channel: string) => `${tenantId}:${channel}`
const tikTokPending = new Map<string, { resolveAt: number; data: object }>()

/** Completes the Telegram handshake when its time has come. Also driven by the simulator. */
export function resolveTelegram(tenantId: string): boolean {
  const row = store.data.integrations.find((item) => item.tenantId === tenantId)
  if (!row || row.telegram.state !== 'awaiting_business_connection') return false
  const due = row.telegram.connectedAt ? Date.parse(row.telegram.connectedAt) : 0
  if (Date.now() < due) return false
  row.telegram.state = 'connected'
  row.telegram.businessAccount = findTenant(tenantId).name.en
  row.telegram.connectedAt = nowIso()
  broadcast('integration:update', row)
  return true
}

/** Completes the TikTok popup flow with the debug switch's result. Also driven by the simulator. */
export function resolveTikTok(tenantId: string): boolean {
  const pending = tikTokPending.get(tenantId)
  if (!pending) return false
  if (pending.data !== store.data) {
    tikTokPending.delete(tenantId)
    return false
  }
  if (Date.now() < pending.resolveAt) return false
  tikTokPending.delete(tenantId)
  const row = integrationsOf(tenantId)
  const tenant = findTenant(tenantId)
  const result = store.data.demo.tiktokConnectResult
  row.tiktok.state = result
  row.tiktok.account = row.tiktok.account ?? { name: tenant.name.en, username: `@${tenant.slug}.official`, avatarId: 'nest-11' }
  if (result === 'connected') row.tiktok.connectedAt = nowIso()
  broadcast('integration:update', row)
  return true
}

/* --------------------------------------------------------------------- FAQ */

function faqState(tenantId: string): FaqState {
  const settings = tenantSettings(tenantId)
  return { faqEnabled: settings.faqEnabled, faqShowOperatorButton: settings.faqShowOperatorButton, tree: settings.faqTree }
}

api.register('GET', '/admin/faq', () => faqState(guard()))

api.register('PUT', '/admin/faq', ({ body }) => {
  const tenantId = guard()
  const input = asRaw(body)
  const tree = input.tree as FaqTree | undefined
  if (!tree || typeof tree !== 'object' || !tree.nodes || !Array.isArray(tree.rootIds)) throw DemoApiError.validation({ tree: 'required' })
  const enabled = input.faqEnabled === true
  const clean: FaqTree = { rootIds: tree.rootIds.slice(0, 1), nodes: {} }
  for (const [id, node] of Object.entries(tree.nodes)) {
    clean.nodes[id] = {
      id,
      type: node.type === 'answer' ? 'answer' : 'question',
      text: { ka: str(node.text?.ka), en: str(node.text?.en), ru: str(node.text?.ru) },
      position: { x: Math.round(Number(node.position?.x) || 0), y: Math.round(Number(node.position?.y) || 0) },
      options: node.type === 'answer' ? [] : (node.options ?? []).map((option) => ({
        id: option.id,
        label: { ka: str(option.label?.ka), en: str(option.label?.en), ru: str(option.label?.ru) },
        nextId: option.transferToOperator ? null : (option.nextId ?? null),
        transferToOperator: option.transferToOperator === true,
      })),
    }
  }
  if (enabled || Object.keys(clean.nodes).length > 0) {
    const issues = validateFaqTree(clean)
    if (issues.length > 0) {
      throw new DemoApiError(400, 'faq_invalid', { tree: 'faq_invalid', nodes: [...new Set(issues.map((issue) => issue.nodeId))] })
    }
  }
  const settings = tenantSettings(tenantId)
  settings.faqTree = clean
  settings.faqEnabled = enabled
  settings.faqShowOperatorButton = input.faqShowOperatorButton === true
  broadcast('settings:update', settings)
  logActivity({ action: 'admin_update_faq', targetLabel: 'FAQ flow', metadata: { nodes: Object.keys(clean.nodes).length, enabled } })
  return faqState(tenantId)
})

/* ------------------------------------------------------------ integrations */

api.register('GET', '/admin/integrations', () => view(guard()))

api.register('PUT', '/admin/integrations/meta/:channel', ({ path, body }) => {
  const tenantId = guard()
  const channel = parseChannel(path['channel'])
  requireFeature(tenantId, channel)
  const row = metaRow(tenantId, channel)
  const input = asRaw(body)
  const enabled = input.enabled === true
  const displayName = str(input.displayName)
  const routingId = str(input.routingId)
  const accessToken = str(input.accessToken)
  const appSecret = str(input.appSecret)
  const verifyToken = str(input.verifyToken)

  const errors: Record<string, string> = {}
  if (!displayName) errors.displayName = 'required'
  if (!routingId) errors.routingId = 'required'
  else if (!/^\d{6,20}$/.test(routingId)) errors.routingId = 'invalid_id'
  if (!accessToken && !row.accessTokenPreview) errors.accessToken = 'required'
  else if (accessToken && accessToken.length < 8) errors.accessToken = 'too_short'
  if (!appSecret && !row.hasAppSecret) errors.appSecret = 'required'
  if (!verifyToken) errors.verifyToken = 'required'
  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)

  row.enabled = enabled
  row.displayName = displayName
  row.routingId = routingId
  if (accessToken) {
    row.accessTokenPreview = preview(accessToken)
    typedTokens.set(tokenKey(tenantId, channel), accessToken)
  }
  if (appSecret) row.hasAppSecret = true
  row.verifyToken = verifyToken
  row.authStatus = enabled ? 'saved_untested' : 'disabled'
  row.lastTestedAt = null
  row.lastTestError = null
  emitIntegrations(tenantId)
  audit('admin_save_integration', channel, { mode: 'manual', enabled })
  return view(tenantId)
})

api.register('POST', '/admin/integrations/meta/:channel/connect', async ({ path, signal }) => {
  const tenantId = guard()
  const channel = parseChannel(path['channel'])
  requireFeature(tenantId, channel)
  await sleep(1_500, signal)
  const row = metaRow(tenantId, channel)
  const tenant = findTenant(tenantId)
  const digits = String(Date.now()).slice(-9)
  row.enabled = true
  row.displayName = channel === 'facebook_messenger' ? tenant.name.en : channel === 'instagram' ? `@${tenant.slug}.official` : '+995 555 00 10 10'
  row.routingId = `${channel === 'instagram' ? '17' : channel === 'whatsapp' ? '11' : '10'}0${digits}`
  row.accessTokenPreview = `${channel === 'instagram' ? 'IGQ' : 'EAA'}••••${digits.slice(-4)}`
  row.hasAppSecret = true
  row.verifyToken = `chiti-${tenant.slug}-${digits.slice(-4)}`
  row.authStatus = 'connected'
  row.lastTestedAt = nowIso()
  row.lastTestError = null
  typedTokens.delete(tokenKey(tenantId, channel))
  emitIntegrations(tenantId)
  audit('admin_save_integration', channel, { mode: 'authorize', enabled: true })
  return view(tenantId)
})

api.register('POST', '/admin/integrations/meta/:channel/test', async ({ path, signal }) => {
  const tenantId = guard()
  const channel = parseChannel(path['channel'])
  requireFeature(tenantId, channel)
  const row = metaRow(tenantId, channel)
  if (!row.accessTokenPreview || !row.routingId) throw codeError(409, 'Nothing to test yet.', 'not_configured')
  await sleep(900, signal)
  const token = (typedTokens.get(tokenKey(tenantId, channel)) ?? '').toLowerCase()
  let message = 'ok'
  if (token.includes('bad')) {
    row.authStatus = 'invalid_credentials'
    row.lastTestError = 'Error validating access token: the token is invalid or has expired.'
    message = row.lastTestError
  } else if (token.includes('offline')) {
    row.authStatus = 'network_error'
    row.lastTestError = 'Could not reach the channel API (timed out after 10 s).'
    message = row.lastTestError
  } else {
    row.authStatus = row.enabled ? 'connected' : 'disabled'
    row.lastTestError = null
  }
  row.lastTestedAt = nowIso()
  emitIntegrations(tenantId)
  audit('admin_test_integration', channel, { ok: row.lastTestError === null })
  const result: MetaTestResult = { ok: row.lastTestError === null, status: row.authStatus, message, testedAt: row.lastTestedAt }
  return result
})

api.register('DELETE', '/admin/integrations/meta/:channel', ({ path }) => {
  const tenantId = guard()
  const channel = parseChannel(path['channel'])
  const row = metaRow(tenantId, channel)
  Object.assign(row, {
    enabled: false, displayName: null, routingId: null, accessTokenPreview: null, hasAppSecret: false, verifyToken: null,
    authStatus: 'not_configured', lastTestedAt: null, lastTestError: null,
  } satisfies Partial<MetaIntegration>)
  typedTokens.delete(tokenKey(tenantId, channel))
  emitIntegrations(tenantId)
  audit('admin_delete_integration', channel)
  return view(tenantId)
})

/* ---------------------------------------------------------------- Telegram */

api.register('POST', '/admin/integrations/telegram/connect', ({ body }) => {
  const tenantId = guard()
  requireFeature(tenantId, 'telegram')
  const input = asRaw(body)
  const token = str(input.token)
  const errors: Record<string, string> = {}
  if (!token) errors.token = 'required'
  else if (!TELEGRAM_TOKEN.test(token)) errors.token = 'invalid_telegram_token'
  if (input.acknowledgeEviction !== true) errors.acknowledgeEviction = 'required'
  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)
  const row = integrationsOf(tenantId)
  const tenant = findTenant(tenantId)
  row.telegram = {
    state: 'awaiting_business_connection',
    botUsername: `@${tenant.slug}_help_bot`,
    businessAccount: null,
    // While awaiting, `connectedAt` is when the (simulated) handshake completes.
    connectedAt: new Date(Date.now() + TELEGRAM_HANDSHAKE_MS).toISOString(),
  }
  emitIntegrations(tenantId)
  audit('admin_save_integration', 'telegram', { mode: 'bot_token' })
  return row.telegram
})

api.register('GET', '/admin/integrations/telegram', () => {
  const tenantId = guard()
  resolveTelegram(tenantId)
  return integrationsOf(tenantId).telegram
})

api.register('POST', '/admin/integrations/telegram/test', async ({ signal }) => {
  const tenantId = guard()
  requireFeature(tenantId, 'telegram')
  const row = integrationsOf(tenantId).telegram
  if (row.state !== 'connected') throw codeError(409, 'Telegram is not connected yet.', 'not_connected')
  await sleep(700, signal)
  audit('admin_test_integration', 'telegram', { ok: true })
  const result: SimpleTestResult = { ok: true, message: 'ok', testedAt: nowIso() }
  return result
})

api.register('DELETE', '/admin/integrations/telegram', () => {
  const tenantId = guard()
  const reset: TelegramIntegration = { state: 'not_configured', botUsername: null, businessAccount: null, connectedAt: null }
  integrationsOf(tenantId).telegram = reset
  emitIntegrations(tenantId)
  audit('admin_delete_integration', 'telegram')
  return reset
})

/* ------------------------------------------------------------------ TikTok */

api.register('POST', '/admin/integrations/tiktok/connect', () => {
  const tenantId = guard()
  requireFeature(tenantId, 'tiktok')
  tikTokPending.set(tenantId, { resolveAt: Date.now() + TIKTOK_POPUP_MS, data: store.data })
  audit('admin_save_integration', 'tiktok', { mode: 'authorize' })
  return { pending: true, resolvesInMs: TIKTOK_POPUP_MS }
})

api.register('POST', '/admin/integrations/tiktok/check', async ({ signal }) => {
  const tenantId = guard()
  requireFeature(tenantId, 'tiktok')
  await sleep(600, signal)
  const row = integrationsOf(tenantId)
  const before = row.tiktok.state
  resolveTikTok(tenantId)
  // A verification that was pending on the platform side has now been approved.
  if (row.tiktok.state === 'unverified') {
    row.tiktok.state = 'connected'
    row.tiktok.connectedAt = row.tiktok.connectedAt ?? nowIso()
    emitIntegrations(tenantId)
  }
  const result: TikTokCheckResult = { state: row.tiktok.state, changed: before !== row.tiktok.state }
  return result
})

api.register('POST', '/admin/integrations/tiktok/test', async ({ signal }) => {
  const tenantId = guard()
  requireFeature(tenantId, 'tiktok')
  const row = integrationsOf(tenantId).tiktok
  await sleep(800, signal)
  const ok = row.state === 'connected'
  audit('admin_test_integration', 'tiktok', { ok })
  const result: SimpleTestResult = { ok, message: ok ? 'ok' : row.state, testedAt: nowIso() }
  return result
})

api.register('DELETE', '/admin/integrations/tiktok', () => {
  const tenantId = guard()
  const reset: TikTokIntegration = { state: 'not_configured', account: null, euInboundDropped: 0, connectedAt: null }
  tikTokPending.delete(tenantId)
  integrationsOf(tenantId).tiktok = reset
  emitIntegrations(tenantId)
  audit('admin_delete_integration', 'tiktok')
  return reset
})

/* ---------------------------------------------------------------- comments */

function commentOf(tenantId: string, id: string | undefined): PageComment {
  const comment = store.data.comments.find((row) => row.id === id && row.tenantId === tenantId && !row.isDeleted)
  if (!comment) throw notFound('Comment not found.')
  return comment
}

function moderated(action: string, comment: PageComment): void {
  broadcast('comment:upsert', comment)
  logActivity({
    action: 'admin_moderate_comment',
    targetId: comment.id,
    targetLabel: comment.authorName,
    metadata: { action, channel: comment.channel },
  })
}

api.register('GET', '/admin/comments', ({ params }) => {
  const tenantId = guard()
  const channel = params['channel']
  return store.data.comments
    .filter((row) => row.tenantId === tenantId && !row.isDeleted && (!channel || channel === 'all' || row.channel === channel))
    .sort((a, b) => Date.parse(b.externalCreatedAt) - Date.parse(a.externalCreatedAt))
})

api.register('POST', '/admin/comments/:id/reply', ({ path, body }) => {
  const tenantId = guard()
  const account = requireRole('admin')
  const comment = commentOf(tenantId, path['id'])
  const text = str(asRaw(body).text)
  if (!text) throw DemoApiError.validation({ text: 'required' })
  if (text.length > 1000) throw DemoApiError.validation({ text: 'too_long' })
  if (comment.repliedAt) throw codeError(409, 'Already replied.', 'already_replied')
  comment.replyText = text
  comment.repliedAt = nowIso()
  comment.repliedByName = account.name
  moderated('reply', comment)
  return comment
})

api.register('POST', '/admin/comments/:id/hide', ({ path, body }) => {
  const tenantId = guard()
  const comment = commentOf(tenantId, path['id'])
  comment.isHidden = asRaw(body).hidden !== false
  moderated(comment.isHidden ? 'hide' : 'unhide', comment)
  return comment
})

api.register('DELETE', '/admin/comments/:id', ({ path }) => {
  const tenantId = guard()
  const comment = commentOf(tenantId, path['id'])
  comment.isDeleted = true
  moderated('delete', comment)
  return { id: comment.id }
})

/* ----------------------------------------------------------------- AI link */

function aiLinkOf(tenantId: string) {
  const link = store.data.aiLinks.find((row) => row.tenantId === tenantId)
  if (!link) throw notFound('AI link not found.')
  return link
}

function aiView(tenantId: string): AiLinkView {
  const link = aiLinkOf(tenantId)
  const settings = tenantSettings(tenantId)
  const outage = aiOutageActive()
  const circuit = outage
    ? { state: 'open' as const, failures: 3, lastReason: 'Upstream timed out (demo outage)', openUntil: store.data.demo.aiOutageUntil }
    : link.circuit
  const aiBotEnabled = link.aiBotEnabled && settings.aiBotEnabled
  const reasons: AiReason[] = []
  if (!link.serverConfigured) reasons.push('server_not_configured')
  if (!link.aiClientId) reasons.push('no_client_id')
  if (!aiBotEnabled) reasons.push('switch_off')
  if (link.aiClientId && !link.autopilotEnabled) reasons.push('autopilot_off')
  if (circuit.state === 'open') reasons.push('circuit_open')
  if (link.botPause) reasons.push('bot_paused')
  return { ...link, aiBotEnabled, circuit, live: reasons.length === 0, reasons, baseUrl: store.data.platform.ai.baseUrl }
}

api.register('GET', '/admin/ai-link', () => aiView(guard()))

api.register('PUT', '/admin/ai-link', ({ body }) => {
  const tenantId = guard()
  const link = aiLinkOf(tenantId)
  const input = asRaw(body)
  const rawId = input.aiClientId === null || input.aiClientId === undefined ? '' : str(input.aiClientId)
  const enabled = input.aiBotEnabled === true
  if (rawId && !UUID.test(rawId)) throw DemoApiError.validation({ aiClientId: 'invalid_uuid' })
  if (enabled && !rawId) throw DemoApiError.validation({ aiClientId: 'required_to_enable' })
  const changed = (link.aiClientId ?? '') !== rawId.toLowerCase()
  link.aiClientId = rawId ? rawId.toLowerCase() : null
  link.aiBotEnabled = enabled
  if (changed) {
    link.autopilotEnabled = rawId !== ''
    link.lastTestAt = null
    link.lastTestOk = null
    link.circuit = { state: 'closed', failures: 0, lastReason: null, openUntil: null }
    link.botPause = null
  }
  const settings = tenantSettings(tenantId)
  settings.aiBotEnabled = enabled
  broadcast('settings:update', settings)
  logActivity({ action: 'admin_save_integration', targetId: 'ai', targetLabel: 'AI link', metadata: { channel: 'ai', enabled, clientIdChanged: changed } })
  return aiView(tenantId)
})

api.register('POST', '/admin/ai-link/test', async ({ signal }) => {
  const tenantId = guard()
  const link = aiLinkOf(tenantId)
  await sleep(1_100, signal)
  const base = store.data.platform.ai.baseUrl
  const id = link.aiClientId
  const lines: string[] = []
  let ok = true
  if (!id) {
    ok = false
    lines.push('$ chiti-ai check', '! no client id saved for this workspace', '✗ aborted')
  } else if (aiOutageActive()) {
    ok = false
    lines.push(`$ chiti-ai check --client ${id}`, `→ GET ${base}/health`, '← 503 Service Unavailable (timeout after 10000 ms)', '  circuit breaker: open, probing again in 45 s', '✗ link unhealthy')
  } else if (id.startsWith('00000000')) {
    ok = false
    lines.push(`$ chiti-ai check --client ${id}`, `→ GET ${base}/health`, '← 200 OK (71 ms) {"status":"ok","version":"2.4.1"}', `→ GET ${base}/clients/${id}/config`, '← 404 Not Found {"error":"client_not_found"}', '✗ client id is unknown to the AI service')
  } else {
    lines.push(
      `$ chiti-ai check --client ${id}`,
      `→ GET ${base}/health`,
      '← 200 OK (71 ms) {"status":"ok","version":"2.4.1"}',
      `→ GET ${base}/clients/${id}/config`,
      '← 200 OK (96 ms) autopilot=enabled languages=ka,en,ru scopes=answer,turns',
      `→ POST ${base}/answer  (dry run)`,
      '← 200 OK (612 ms) grounded=true citations=2',
      `→ POST ${base}/turns  (dry run)`,
      '← 200 OK (884 ms) drafts=2',
      '✓ link healthy',
    )
  }
  link.lastTestAt = nowIso()
  link.lastTestOk = ok
  if (ok) link.circuit = { state: 'closed', failures: 0, lastReason: null, openUntil: null }
  logActivity({ action: 'admin_test_integration', targetId: 'ai', targetLabel: 'AI link', metadata: { channel: 'ai', ok } })
  return { ok, lines, link: aiView(tenantId) }
})
