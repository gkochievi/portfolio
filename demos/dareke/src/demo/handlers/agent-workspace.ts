/**
 * Mock API handlers for "agent-workspace".
 * Paths are registered WITHOUT the "/api" prefix. The live call itself is
 * owned by the operator engine (`src/demo/sim/operator.ts`).
 */
import { DemoApiError, conflict, forbidden, notFound, type MockApi } from '@portfolio/demo-kit'

import type { AgentStateView, AgentTodayKpis, CallRecordView, CampaignWithStats, OperatorCall } from '@/types'
import {
  agentStateOf,
  agentStateView,
  campaignById,
  changed,
  numberById,
  requireRole,
  requireUser,
  setAgentStatus,
  startOfToday,
  statusById,
  statusIdByName,
  toCallView,
  withStats,
} from '../domain'
import { store } from '../store'
import {
  answerOffer,
  disposeCall,
  getOperatorCall,
  hangupCall,
  holdCall,
  rejectOffer,
  requestNext,
  transferCall,
} from '../sim/operator'

const asObject = (body: unknown): Record<string, unknown> => (body && typeof body === 'object' ? (body as Record<string, unknown>) : {})
const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

/** The operator's state row, created Offline-then-Available on first use. */
function myState(agentId: string) {
  return agentStateOf(agentId) ?? setAgentStatus(agentId, statusIdByName('available'))
}

const isAssigned = (agentId: string, campaignId: string): boolean =>
  store.data.campaignAgents.some((link) => link.agentId === agentId && link.campaignId === campaignId)

function myCampaigns(agentId: string): CampaignWithStats[] {
  return store.data.campaigns
    .filter((campaign) => campaign.status === 'active' && isAssigned(agentId, campaign.id))
    .map(withStats)
    .sort((a, b) => a.name.en.localeCompare(b.name.en))
}

const endedAt = (call: { callEndedAt: string | null; callInitiatedAt: string }) => call.callEndedAt ?? call.callInitiatedAt

export function register(api: MockApi): void {
  api.register('GET', '/agent/me/state', (): AgentStateView => {
    const user = requireRole('operator')
    return agentStateView(myState(user.id))
  })

  api.register('POST', '/agent/me/status', ({ body }): AgentStateView => {
    const user = requireRole('operator')
    const statusId = asString(asObject(body).statusId)
    const status = statusById(statusId)
    if (!status || !status.isActive) throw DemoApiError.validation({ statusId: 'Choose a status' })
    if (status.isSystem) throw DemoApiError.validation({ statusId: 'This status is set by the dialer' })
    const state = myState(user.id)
    if (getOperatorCall(user.id) || state.currentCallId) throw conflict('You cannot change your status during a call')
    setAgentStatus(user.id, status.id, { campaignId: state.currentCampaignId })
    changed('me', 'agents', 'metrics', 'dialer')
    return agentStateView(myState(user.id))
  })

  api.register('POST', '/agent/me/campaign', ({ body }): AgentStateView => {
    const user = requireRole('operator')
    const campaignId = asString(asObject(body).campaignId)
    const campaign = campaignById(campaignId)
    if (!campaign) throw notFound('Campaign not found')
    if (!isAssigned(user.id, campaign.id)) throw forbidden('You are not assigned to this campaign')
    if (campaign.status !== 'active') throw conflict('This campaign is not active')
    const state = myState(user.id)
    if (getOperatorCall(user.id) || state.currentCallId) throw conflict('You cannot switch campaigns during a call')
    setAgentStatus(user.id, state.statusId, { campaignId: campaign.id })
    changed('me', 'agents', 'dialer')
    return agentStateView(myState(user.id))
  })

  api.register('GET', '/agent/me/campaigns', (): CampaignWithStats[] => {
    const user = requireRole('operator')
    return myCampaigns(user.id)
  })

  api.register('GET', '/agent/me/kpis', (): AgentTodayKpis => {
    const user = requireRole('operator')
    const since = startOfToday()
    const mine = store.data.calls.filter((call) => call.agentId === user.id)
    const today = mine.filter((call) => Date.parse(call.callInitiatedAt) >= since && call.outcome !== 'IN_PROGRESS')
    const answered = today.filter((call) => call.outcome === 'ANSWERED')
    const talk = answered.reduce((sum, call) => sum + call.talkDuration, 0)
    const conversions = today.filter((call) => call.dispositionCode === 'SALE').length
    const recent: string[] = []
    for (const call of [...mine].filter((c) => c.dispositionCode).sort((a, b) => endedAt(b).localeCompare(endedAt(a)))) {
      const code = call.dispositionCode as string
      if (!recent.includes(code)) recent.push(code)
      if (recent.length === 3) break
    }
    return {
      calls: today.length,
      answered: answered.length,
      avgDurationSeconds: answered.length ? Math.round(talk / answered.length) : 0,
      talkTimeSeconds: talk,
      conversions,
      conversionRate: answered.length ? Math.round((conversions / answered.length) * 1000) / 10 : 0,
      recentDispositionCodes: recent,
    }
  })

  api.register('GET', '/agent/me/calls', (): CallRecordView[] => {
    const user = requireRole('operator')
    const since = startOfToday()
    return store.data.calls
      .filter((call) => call.agentId === user.id && call.outcome !== 'IN_PROGRESS' && Date.parse(call.callInitiatedAt) >= since)
      .sort((a, b) => b.callInitiatedAt.localeCompare(a.callInitiatedAt))
      .map(toCallView)
  })

  api.register('GET', '/agent/me/call', (): OperatorCall | null => {
    const user = requireRole('operator')
    return getOperatorCall(user.id)
  })

  api.register('POST', '/dialer/next', ({ body }): OperatorCall => {
    const user = requireRole('operator')
    const campaignId = asString(asObject(body).campaignId)
    if (!campaignId) throw new DemoApiError(400, 'Please select a campaign first')
    const campaign = campaignById(campaignId)
    if (!campaign) throw notFound('Campaign not found')
    if (!isAssigned(user.id, campaign.id)) throw forbidden('You are not assigned to this campaign')
    if (campaign.status !== 'active') throw conflict('This campaign is not active')
    const state = myState(user.id)
    const status = statusById(state.statusId)
    if (status && status.type !== 'working' && !getOperatorCall(user.id)) throw conflict('Set your status to Available to take calls')
    if (state.currentCampaignId !== campaign.id) setAgentStatus(user.id, state.statusId, { campaignId: campaign.id, silent: true })
    return requestNext(user.id, campaign.id)
  })

  api.register('POST', '/dialer/calls/:id/answer', ({ path }) => {
    const user = requireRole('operator')
    return answerOffer(user.id, path.id ?? '')
  })

  api.register('POST', '/dialer/calls/:id/reject', ({ path }) => {
    const user = requireRole('operator')
    return rejectOffer(user.id, path.id ?? '')
  })

  api.register('POST', '/dialer/calls/:id/hold', ({ path, body }) => {
    const user = requireRole('operator')
    return holdCall(user.id, path.id ?? '', asObject(body).onHold === true)
  })

  api.register('POST', '/dialer/calls/:id/hangup', ({ path }) => {
    const user = requireRole('operator')
    return hangupCall(user.id, path.id ?? '')
  })

  api.register('POST', '/dialer/calls/:id/transfer', ({ path, body }) => {
    const user = requireRole('operator')
    return transferCall(user.id, path.id ?? '', asString(asObject(body).extension))
  })

  api.register('POST', '/calls/:id/disposition', ({ path, body }): CallRecordView => {
    const user = requireRole('operator')
    const input = asObject(body)
    const code = asString(input.code)
    if (!code) throw DemoApiError.validation({ code: 'Choose a disposition' })
    const record = disposeCall(user.id, path.id ?? '', {
      code,
      note: asString(input.note) || null,
      callbackAt: asString(input.callbackAt) || null,
    })
    return toCallView(record)
  })

  api.register('GET', '/dialer/numbers/:id/history', ({ path }): CallRecordView[] => {
    requireUser()
    const lead = numberById(path.id ?? '')
    if (!lead) throw notFound('Number not found')
    return store.data.calls
      .filter((call) => call.destinationNumber === lead.phoneNumber && call.outcome !== 'IN_PROGRESS')
      .sort((a, b) => b.callInitiatedAt.localeCompare(a.callInitiatedAt))
      .map(toCallView)
  })
}
