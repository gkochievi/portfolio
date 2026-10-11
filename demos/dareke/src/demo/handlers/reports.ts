/**
 * Mock API handlers for "reports".
 * Reports and the CDR aggregate `store.data.calls`; every read is supervisor+.
 */
import { DemoApiError, notFound, type DemoParams, type MockApi } from '@portfolio/demo-kit'

import { campaignById, dispositionByCode, requireRole, toCallView, userName } from '@/demo/domain'
import { store } from '@/demo/store'
import type { CallDetail, ReportFilters } from '@/features/reports/types'
import type {
  AgentPerformanceRow,
  CallOutcome,
  CallRecord,
  CallRecordView,
  CampaignReport,
  DispositionBreakdown,
  Paginated,
} from '@/types'

const SUPERVISION = ['supervisor', 'admin', 'super_admin'] as const
const OUTCOMES: CallOutcome[] = ['IN_PROGRESS', 'ANSWERED', 'NO_ANSWER', 'BUSY', 'FAILED', 'ABANDONED']
const CALLBACK_CODES = new Set(['INTERESTED', 'CALLBACK_LATER'])
const DAY = 24 * 60 * 60 * 1000

const guard = () => requireRole(...SUPERVISION)

function parseTime(value: string | undefined, field: string): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) throw DemoApiError.validation({ [field]: 'Enter a valid date.' })
  return ms
}

/** from/to as epoch ms; defaults to the last 7 days. 400 when from is after to. */
function range(params: DemoParams, required = false): { from: number; to: number } {
  if (required && !params.from) throw DemoApiError.validation({ from: 'Start date is required.' })
  if (required && !params.to) throw DemoApiError.validation({ to: 'End date is required.' })
  const to = parseTime(params.to, 'to') ?? Date.now()
  const from = parseTime(params.from, 'from') ?? to - 7 * DAY
  if (from > to) throw DemoApiError.validation({ to: 'End date must be on or after the start date.' })
  if (to - from > 366 * DAY) throw DemoApiError.validation({ from: 'The range can be at most one year.' })
  return { from, to }
}

function inRange(call: CallRecord, from: number, to: number): boolean {
  const at = Date.parse(call.callInitiatedAt)
  return at >= from && at <= to
}

const newestFirst = (a: CallRecord, b: CallRecord) => Date.parse(b.callInitiatedAt) - Date.parse(a.callInitiatedAt)
const digits = (s: string) => s.replace(/\D/g, '')
const isAnswered = (call: CallRecord) => call.callAnsweredAt != null && call.outcome !== 'NO_ANSWER' && call.outcome !== 'BUSY'

function breakdownOf(calls: CallRecord[]): DispositionBreakdown[] {
  const counts = new Map<string, number>()
  for (const call of calls) if (call.dispositionCode) counts.set(call.dispositionCode, (counts.get(call.dispositionCode) ?? 0) + 1)
  return [...counts.entries()]
    .map(([code, count]) => {
      const d = dispositionByCode(code)
      return { code, count, name: d?.name ?? { en: code, ka: code }, color: d?.color ?? 'muted', order: d?.sortOrder ?? 99 }
    })
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...rest }) => rest)
}

export function register(api: MockApi): void {
  api.register('GET', '/reports/filters', (): ReportFilters => {
    guard()
    const { campaigns, users, dispositions } = store.data
    return {
      campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status })),
      agents: users
        .filter((u) => u.role === 'operator')
        .map((u) => ({ id: u.id, name: u.displayName, isActive: u.isActive }))
        .sort((a, b) => a.name.en.localeCompare(b.name.en)),
      dispositions: [...dispositions]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((d) => ({ code: d.code, name: d.name, color: d.color })),
    }
  })

  api.register('GET', '/reports/agent-performance', ({ params }): AgentPerformanceRow[] => {
    guard()
    const { from, to } = range(params, true)
    const byAgent = new Map<string, CallRecord[]>()
    for (const call of store.data.calls) {
      if (!call.agentId || call.outcome === 'IN_PROGRESS' || !inRange(call, from, to)) continue
      const list = byAgent.get(call.agentId) ?? []
      list.push(call)
      byAgent.set(call.agentId, list)
    }
    const rows: AgentPerformanceRow[] = []
    for (const [agentId, calls] of byAgent) {
      const answered = calls.filter(isAnswered)
      const talkTime = calls.reduce((sum, c) => sum + c.talkDuration, 0)
      rows.push({
        agentId,
        agentName: userName(agentId) ?? { en: agentId, ka: agentId },
        callsHandled: calls.length,
        talkTime,
        avgCallDuration: answered.length ? Math.round(talkTime / answered.length) : 0,
        sales: calls.filter((c) => c.dispositionCode === 'SALE').length,
        callbacks: calls.filter((c) => c.dispositionCode && CALLBACK_CODES.has(c.dispositionCode)).length,
        notInterested: calls.filter((c) => c.dispositionCode === 'NOT_INTERESTED').length,
      })
    }
    return rows.sort((a, b) => b.callsHandled - a.callsHandled)
  })

  api.register('GET', '/reports/campaign/:id', ({ path, params }): CampaignReport => {
    guard()
    const id = path.id ?? ''
    const campaign = campaignById(id)
    if (!campaign) throw notFound('Campaign not found.')
    const { from, to } = range(params, true)
    const calls = store.data.calls.filter((c) => c.campaignId === id && c.outcome !== 'IN_PROGRESS' && inRange(c, from, to))
    const answered = calls.filter(isAnswered)
    const sales = calls.filter((c) => c.dispositionCode === 'SALE').length
    const talk = answered.reduce((sum, c) => sum + c.talkDuration, 0)
    return {
      campaignId: id,
      campaignName: campaign.name,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      totalDialed: calls.length,
      answered: answered.length,
      answerRate: calls.length ? (answered.length / calls.length) * 100 : 0,
      conversionRate: answered.length ? (sales / answered.length) * 100 : 0,
      avgTalkTime: answered.length ? Math.round(talk / answered.length) : 0,
      breakdown: breakdownOf(calls),
    }
  })

  api.register('GET', '/reports/call-detail', ({ params }): CallRecordView[] => {
    guard()
    const { from, to } = range(params, true)
    return store.data.calls
      .filter(
        (c) =>
          c.outcome !== 'IN_PROGRESS' &&
          inRange(c, from, to) &&
          (!params.campaignId || c.campaignId === params.campaignId) &&
          (!params.agentId || c.agentId === params.agentId),
      )
      .sort(newestFirst)
      .map(toCallView)
  })

  api.register('GET', '/calls', ({ params }): Paginated<CallRecordView> => {
    guard()
    const from = parseTime(params.from, 'from')
    const to = parseTime(params.to, 'to')
    if (from != null && to != null && from > to) throw DemoApiError.validation({ to: 'End date must be on or after the start date.' })
    const outcome = params.outcome as CallOutcome | undefined
    if (outcome && !OUTCOMES.includes(outcome)) throw DemoApiError.validation({ outcome: 'Unknown outcome.' })
    const phone = digits(params.phone ?? '')
    const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(params.pageSize ?? '25', 10) || 25))

    const matches = store.data.calls
      .filter((c) => {
        const at = Date.parse(c.callInitiatedAt)
        if (from != null && at < from) return false
        if (to != null && at > to) return false
        if (params.campaignId && c.campaignId !== params.campaignId) return false
        if (params.agentId && c.agentId !== params.agentId) return false
        if (outcome && c.outcome !== outcome) return false
        if (params.disposition === 'none' ? c.dispositionCode != null : params.disposition && c.dispositionCode !== params.disposition) return false
        if (phone && !digits(c.destinationNumber).includes(phone)) return false
        return true
      })
      .sort(newestFirst)
    const start = (page - 1) * pageSize
    return { items: matches.slice(start, start + pageSize).map(toCallView), total: matches.length, page, pageSize }
  })

  api.register('GET', '/calls/:id', ({ path }): CallDetail => {
    guard()
    const call = store.data.calls.find((c) => c.id === path.id)
    if (!call) throw notFound('Call not found.')
    const otherCalls = store.data.calls
      .filter((c) => c.id !== call.id && c.destinationNumber === call.destinationNumber)
      .sort(newestFirst)
      .slice(0, 20)
      .map(toCallView)
    return { ...toCallView(call), otherCalls }
  })
}
