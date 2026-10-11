/**
 * Mock API handlers for the supervisor wall and the auto-dialer. Paths are registered WITHOUT the
 * "/api" prefix. Every route needs supervisor, admin or super_admin.
 */
import { DemoApiError, conflict, notFound, type MockApi } from '@portfolio/demo-kit'

import { agentStateView, callById, campaignById, campaignStats, changed, holdSecondsOf, requireRole, startOfToday, statusById, withStats } from '../domain'
import { abandonRateOf, dialCycle, refreshState, resetCampaign, simulateFailure } from '../sim/autoDialer'
import { store } from '../store'
import type { AgentStateView, AutoDialerOverview, CampaignProgress, HourlyCallData, RealtimeMetrics } from '@/types'

const WALL_ROLES = ['supervisor', 'admin', 'super_admin'] as const
const HOUR = 3_600_000

/** An agent tile: the shared view plus the live hold total (sampled at `sampledAt`). */
export type WallAgentView = AgentStateView & { holdSeconds: number; sampledAt: string }

/** Avg wait drifts inside a 3-12 s band. */
let avgWait = 6
const nextAvgWait = () => {
  avgWait = Math.min(12, Math.max(3, avgWait + (Math.random() * 3 - 1.5)))
  return Math.round(avgWait)
}

const STATE_ORDER = { on_call: 0, working: 1, paused: 2, offline: 3 } as const

const autoCampaign = (id: string) => {
  const campaign = campaignById(id)
  if (!campaign) throw notFound('Campaign not found')
  if (campaign.dialingMode !== 'AUTO') throw DemoApiError.validation({ campaignId: 'Only AUTO campaigns are paced by the auto-dialer' })
  return campaign
}

export function register(api: MockApi): void {
  api.register('GET', '/supervisor/metrics', (): RealtimeMetrics => {
    requireRole(...WALL_ROLES)
    const operators = new Set(store.data.users.filter((user) => user.role === 'operator' && user.isActive).map((user) => user.id))
    let agentsWorking = 0
    let agentsPaused = 0
    let agentsOnCall = 0
    let agentsOffline = 0
    for (const state of store.data.agentStates) {
      if (!operators.has(state.agentId)) continue
      const type = statusById(state.statusId)?.type ?? 'offline'
      if (state.currentCallId) agentsOnCall += 1
      if (type === 'working') agentsWorking += 1
      else if (type === 'paused') agentsPaused += 1
      else agentsOffline += 1
    }
    const dayStart = startOfToday()
    const hourStart = new Date().setMinutes(0, 0, 0)
    let activeCalls = 0
    let callsThisHour = 0
    let dialedToday = 0
    let connectedToday = 0
    for (const call of store.data.calls) {
      if (call.outcome === 'IN_PROGRESS') activeCalls += 1
      const at = Date.parse(call.callInitiatedAt)
      if (at < dayStart) continue
      dialedToday += 1
      if (call.callAnsweredAt && call.outcome !== 'ABANDONED') connectedToday += 1
      if (at >= hourStart) callsThisHour += 1
    }
    return {
      activeCalls,
      agentsWorking,
      agentsPaused,
      agentsOnCall,
      agentsOffline,
      callsThisHour,
      avgWaitSeconds: nextAvgWait(),
      dialedToday,
      connectedToday,
      abandonRate: abandonRateOf(null),
      updatedAt: new Date().toISOString(),
    }
  })

  api.register('GET', '/supervisor/agents', (): WallAgentView[] => {
    requireRole(...WALL_ROLES)
    const sampledAt = new Date().toISOString()
    const operators = new Set(store.data.users.filter((user) => user.role === 'operator' && user.isActive).map((user) => user.id))
    return store.data.agentStates
      .filter((state) => operators.has(state.agentId))
      .map((state) => {
        const view = agentStateView(state)
        const call = view.currentCall ? callById(view.currentCall.id) : undefined
        return { ...view, holdSeconds: call ? holdSecondsOf(call) : 0, sampledAt }
      })
      .sort((a, b) => {
        const rank = (view: WallAgentView) => (view.currentCall ? STATE_ORDER.on_call : STATE_ORDER[view.status.type])
        return rank(a) - rank(b) || a.agent.displayName.en.localeCompare(b.agent.displayName.en)
      })
  })

  api.register('GET', '/supervisor/events', () => {
    requireRole(...WALL_ROLES)
    return store.data.callEvents.slice(0, 50)
  })

  api.register('GET', '/supervisor/hourly', (): HourlyCallData[] => {
    requireRole(...WALL_ROLES)
    const currentHour = new Date().setMinutes(0, 0, 0)
    const buckets: HourlyCallData[] = []
    for (let back = 8; back >= 0; back -= 1) {
      const start = currentHour - back * HOUR
      const hour = new Date(start).getHours()
      buckets.push({ hour, label: `${String(hour).padStart(2, '0')}:00`, dialed: 0, connected: 0 })
    }
    const first = currentHour - 8 * HOUR
    for (const call of store.data.calls) {
      const at = Date.parse(call.callInitiatedAt)
      if (at < first) continue
      const bucket = buckets[Math.floor((at - first) / HOUR)]
      if (!bucket) continue
      bucket.dialed += 1
      if (call.callAnsweredAt && call.outcome !== 'ABANDONED') bucket.connected += 1
    }
    return buckets
  })

  api.register('GET', '/supervisor/campaigns', () => {
    requireRole(...WALL_ROLES)
    return store.data.campaigns
      .filter((campaign) => campaign.status === 'active' || campaign.status === 'paused')
      .sort((a, b) => (a.status === b.status ? a.createdAt.localeCompare(b.createdAt) : a.status === 'active' ? -1 : 1))
      .map(withStats)
  })

  api.register('GET', '/supervisor/campaigns/:id/progress', ({ path }): CampaignProgress => {
    requireRole(...WALL_ROLES)
    const id = path.id ?? ''
    if (!campaignById(id)) throw notFound('Campaign not found')
    return { ...campaignStats(id), campaignId: id }
  })

  api.register('GET', '/dialer/auto', (): AutoDialerOverview => {
    requireRole(...WALL_ROLES)
    const campaigns = store.data.campaigns
      .filter((campaign) => campaign.dialingMode !== 'MANUAL' && (campaign.status === 'active' || campaign.status === 'paused'))
      .sort((a, b) => (a.dialingMode === b.dialingMode ? a.createdAt.localeCompare(b.createdAt) : a.dialingMode === 'AUTO' ? -1 : 1))
      .map((campaign) => ({
        ...refreshState(campaign),
        campaignName: campaign.name,
        dialingMode: campaign.dialingMode,
        status: campaign.status,
      }))
    return { enabled: store.data.autoDialer.enabled, targetAbandonRate: store.data.settings.dialer.targetAbandonRate, campaigns }
  })

  api.register('POST', '/dialer/auto/start', () => {
    requireRole(...WALL_ROLES)
    store.data.autoDialer.enabled = true
    changed('dialer')
    return { enabled: true }
  })

  api.register('POST', '/dialer/auto/stop', () => {
    requireRole(...WALL_ROLES)
    store.data.autoDialer.enabled = false
    changed('dialer')
    return { enabled: false }
  })

  api.register('POST', '/dialer/auto/:campaignId/trigger', ({ path }) => {
    requireRole(...WALL_ROLES)
    const campaign = autoCampaign(path.campaignId ?? '')
    if (campaign.status !== 'active') throw conflict('Start the campaign before triggering a dial cycle')
    const state = refreshState(campaign)
    if (state.backoffUntil) throw conflict('The campaign is backing off after repeated errors. Reset it first.')
    const dialed = dialCycle(campaign.id, true)
    changed('dialer', 'calls', 'numbers', 'metrics', 'campaigns')
    return { dialed }
  })

  api.register('POST', '/dialer/auto/:campaignId/reset', ({ path }) => {
    requireRole(...WALL_ROLES)
    const campaign = autoCampaign(path.campaignId ?? '')
    resetCampaign(campaign.id)
    const state = refreshState(campaign)
    changed('dialer')
    return state
  })

  api.register('POST', '/dialer/auto/:campaignId/fail', ({ path }) => {
    requireRole(...WALL_ROLES)
    const campaign = autoCampaign(path.campaignId ?? '')
    simulateFailure(campaign.id)
    changed('dialer')
    return refreshState(campaign)
  })
}
