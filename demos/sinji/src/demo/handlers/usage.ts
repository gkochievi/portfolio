/**
 * Mock handlers for the `usage` group: AI token-usage reporting for the operator.
 * Everything is a client-side reduce over `store.data.llmUsage`. Operator only.
 * Tokens only, never money. OWNED BY: usage.
 */
import { notFound } from '@portfolio/demo-kit'

import type { CallRow, UsageConversationRow, UsageQuery } from '@/features/usage/types'
import type {
  BreakdownDimension,
  BreakdownRow,
  CallTarget,
  Paged,
  UsageBucket,
  UsageConversationDetail,
  UsageConversationTurn,
  UsageFacets,
  UsageGroupCard,
  UsageOverview,
  UsageRecordingDetail,
  UsageRecordingRow,
  UsageTotals,
} from '@/features/usage/types'
import type { Id, LlmUsage, UsageGroup, UsageWindow } from '@/types'
import { store } from '../core'
import { requireOperator } from '../guards'
import { mockApi } from '../api'

const HOUR = 3_600_000
const DAY = 24 * HOUR

const WINDOW_MS: Record<Exclude<UsageWindow, 'custom'>, number> = { '24h': DAY, '7d': 7 * DAY, '30d': 30 * DAY, '90d': 90 * DAY }
const PUBLIC_KEY = 'public'

/* ------------------------------------------------------------------ filters */

interface Range {
  from: number
  to: number
}

function parseEdge(value: string | undefined, end: boolean): number | null {
  if (!value) return null
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const ms = dateOnly ? new Date(`${value}T00:00:00`).getTime() : Date.parse(value)
  if (!Number.isFinite(ms)) return null
  return dateOnly && end ? ms + DAY - 1 : ms
}

function readQuery(params: Record<string, string>): UsageQuery {
  const w = params.window as UsageWindow | undefined
  const window: UsageWindow = w === '24h' || w === '7d' || w === '30d' || w === '90d' || w === 'custom' ? w : '30d'
  const query: UsageQuery = { window }
  if (params.from) query.from = params.from
  if (params.to) query.to = params.to
  if (params.client_id) query.client_id = params.client_id
  if (params.group) query.group = params.group as UsageGroup
  if (params.provider) query.provider = params.provider
  if (params.model) query.model = params.model
  if (params.capability) query.capability = params.capability as UsageQuery['capability']
  if (params.status === 'ok' || params.status === 'failed') query.status = params.status
  if (params.feature) query.feature = params.feature
  if (params.actor) query.actor = params.actor
  return query
}

function rangeOf(query: UsageQuery, now = Date.now()): Range {
  if (query.window === 'custom') {
    const from = parseEdge(query.from, false)
    const to = parseEdge(query.to, true)
    if (from != null || to != null) {
      const end = to ?? now
      return { from: from ?? end - 30 * DAY, to: end }
    }
    return { from: now - 30 * DAY, to: now }
  }
  return { from: now - WINDOW_MS[query.window], to: now }
}

function passes(row: LlmUsage, f: UsageQuery, range: Range): boolean {
  const t = Date.parse(row.created_at)
  if (t < range.from || t > range.to) return false
  if (f.client_id && row.client_id !== f.client_id) return false
  if (f.group && row.group !== f.group) return false
  if (f.provider && row.provider !== f.provider) return false
  if (f.model && row.model !== f.model) return false
  if (f.capability && row.capability !== f.capability) return false
  if (f.status === 'ok' && !row.ok) return false
  if (f.status === 'failed' && row.ok) return false
  if (f.feature && row.feature !== f.feature) return false
  if (f.actor && row.actor !== f.actor) return false
  return true
}

function filtered(query: UsageQuery): { rows: LlmUsage[]; range: Range } {
  const range = rangeOf(query)
  return { rows: store.data.llmUsage.filter((r) => passes(r, query, range)), range }
}

/* ------------------------------------------------------------------ helpers */

const emptyTotals = (): UsageTotals => ({
  calls: 0,
  failed: 0,
  input: 0,
  output: 0,
  total: 0,
  cache_read: 0,
  cache_write: 0,
  audio_seconds: 0,
  characters: 0,
  byo_calls: 0,
  byo_tokens: 0,
})

function addTo(t: UsageTotals, r: LlmUsage): void {
  t.calls += 1
  if (!r.ok) t.failed += 1
  t.input += r.input_tokens
  t.output += r.output_tokens
  t.total += r.total_tokens
  t.cache_read += r.cache_read_tokens
  t.cache_write += r.cache_creation_tokens
  t.audio_seconds += r.audio_seconds ?? 0
  t.characters += r.characters ?? 0
  if (r.byo) {
    t.byo_calls += 1
    t.byo_tokens += r.total_tokens
  }
}

const totalsOf = (rows: LlmUsage[]): UsageTotals => {
  const t = emptyTotals()
  for (const r of rows) addTo(t, r)
  return t
}

function paginate<T>(all: T[], params: Record<string, string>, defaultSize: number): Paged<T> {
  const page_size = Math.min(200, Math.max(1, Number.parseInt(params.page_size ?? '', 10) || defaultSize))
  const total = all.length
  const pages = Math.max(1, Math.ceil(total / page_size))
  const page = Math.min(pages, Math.max(1, Number.parseInt(params.page ?? '', 10) || 1))
  return { items: all.slice((page - 1) * page_size, page * page_size), total, page, page_size }
}

function sortRows<T>(rows: T[], params: Record<string, string>, accessors: Record<string, (r: T) => string | number>, fallback: string): T[] {
  const key = params.sort && accessors[params.sort] ? params.sort : fallback
  const get = accessors[key] ?? (() => 0)
  const sample = rows.length ? get(rows[0] as T) : 0
  const dir = (params.dir ?? (typeof sample === 'number' ? 'desc' : 'asc')) === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = get(a)
    const y = get(b)
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en')
    return c * dir
  })
}

const norm = (s: string) => s.toLowerCase()
const matchesQ = (q: string | undefined, ...fields: Array<string | null | undefined>) => {
  if (!q) return true
  const needle = norm(q.trim())
  return !needle || fields.some((f) => f && norm(f).includes(needle))
}

function tenantName(id: Id | null): { en: string; ka: string } {
  if (!id) return { en: 'Public tools', ka: 'საჯარო ინსტრუმენტები' }
  const t = store.data.tenants.find((x) => x.id === id)
  return t ? { en: t.name, ka: t.name_ka } : { en: id, ka: id }
}

function targetOf(r: LlmUsage): CallTarget | null {
  const { recordings, conversations, summaries } = store.data
  if (r.job_id) {
    const rec = recordings.find((x) => x.id === r.job_id)
    return { kind: 'recording', id: r.job_id, label: rec?.filename ?? null, exists: Boolean(rec) }
  }
  if (r.conversation_id) {
    const conv = conversations.find((x) => x.id === r.conversation_id)
    return { kind: 'conversation', id: r.conversation_id, label: conv?.subject ?? null, exists: Boolean(conv) }
  }
  if (r.summary_id) {
    const sum = summaries.find((x) => x.id === r.summary_id)
    return { kind: 'digest', id: r.summary_id, label: sum?.title ?? null, exists: Boolean(sum) }
  }
  return null
}

function decorate(r: LlmUsage): CallRow {
  const name = r.client_id ? tenantName(r.client_id) : null
  return { ...r, workspace: name?.en ?? null, workspace_ka: name?.ka ?? null, target: targetOf(r) }
}

const byTime = (a: LlmUsage, b: LlmUsage) => Date.parse(a.created_at) - Date.parse(b.created_at)

/* --------------------------------------------------------------- endpoints */

mockApi.register('GET', '/admin/usage/facets', () => {
  requireOperator()
  const rows = store.data.llmUsage
  const distinct = (pick: (r: LlmUsage) => string) => [...new Set(rows.map(pick))].sort((a, b) => a.localeCompare(b))
  const facets: UsageFacets = {
    workspaces: store.data.tenants.map((t) => ({ id: t.id, name: t.name, name_ka: t.name_ka })),
    groups: distinct((r) => r.group),
    providers: distinct((r) => r.provider),
    models: distinct((r) => r.model),
    capabilities: distinct((r) => r.capability),
    features: distinct((r) => r.feature),
    actors: distinct((r) => r.actor),
  }
  return facets
})

function breakdown(rows: LlmUsage[], dim: BreakdownDimension): BreakdownRow[] {
  const map = new Map<string, BreakdownRow>()
  for (const r of rows) {
    let key: string
    let label: string
    let label_ka: string | undefined
    switch (dim) {
      case 'workspace': {
        key = r.client_id ?? PUBLIC_KEY
        const n = tenantName(r.client_id)
        label = n.en
        label_ka = n.ka
        break
      }
      case 'group':
        key = r.group
        label = r.group
        break
      case 'provider':
        key = r.provider
        label = r.provider
        break
      case 'model':
        key = r.model
        label = r.model
        break
      case 'feature':
        key = r.feature
        label = r.feature
        break
      default:
        key = r.actor
        label = r.actor
    }
    let row = map.get(key)
    if (!row) {
      row = { key, label, label_ka, calls: 0, failed: 0, input: 0, output: 0, total: 0, cached: 0 }
      map.set(key, row)
    }
    row.calls += 1
    if (!r.ok) row.failed += 1
    row.input += r.input_tokens
    row.output += r.output_tokens
    row.total += r.total_tokens
    row.cached += r.cache_read_tokens
  }
  return [...map.values()].sort((a, b) => b.total - a.total || b.calls - a.calls)
}

mockApi.register('GET', '/admin/usage/overview', ({ params }) => {
  requireOperator()
  const query = readQuery(params)
  const { rows, range } = filtered(query)
  const hourly = range.to - range.from <= 48 * HOUR + 1
  const floor = (ms: number) => {
    const d = new Date(ms)
    if (hourly) d.setMinutes(0, 0, 0)
    else d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  const buckets = new Map<number, UsageBucket>()
  for (let t = floor(range.from); t <= range.to; ) {
    buckets.set(t, { ts: new Date(t).toISOString(), input: 0, output: 0, calls: 0 })
    const next = new Date(t)
    if (hourly) next.setHours(next.getHours() + 1)
    else next.setDate(next.getDate() + 1)
    t = next.getTime()
  }
  for (const r of rows) {
    const b = buckets.get(floor(Date.parse(r.created_at)))
    if (!b) continue
    b.input += r.input_tokens
    b.output += r.output_tokens
    b.calls += 1
  }

  const byoMap = new Map<string, { calls: number; tokens: number }>()
  for (const r of rows) {
    if (!r.byo || !r.client_id) continue
    const cur = byoMap.get(r.client_id) ?? { calls: 0, tokens: 0 }
    cur.calls += 1
    cur.tokens += r.total_tokens
    byoMap.set(r.client_id, cur)
  }

  const overview: UsageOverview = {
    window: { from: new Date(range.from).toISOString(), to: new Date(range.to).toISOString(), bucket: hourly ? 'hour' : 'day' },
    totals: totalsOf(rows),
    series: [...buckets.values()],
    breakdown: {
      workspace: breakdown(rows, 'workspace'),
      group: breakdown(rows, 'group'),
      provider: breakdown(rows, 'provider'),
      model: breakdown(rows, 'model'),
      feature: breakdown(rows, 'feature'),
      user: breakdown(rows, 'user'),
    },
    byo_workspaces: [...byoMap.entries()].map(([id, v]) => ({ id, ...{ name: tenantName(id).en, name_ka: tenantName(id).ka }, ...v })),
  }
  return overview
})

/* ---- recordings ---- */

const ANALYSER_GROUPS: UsageGroup[] = ['transcription', 'analysis', 'factcheck', 'tone', 'scoring', 'summary']

mockApi.register('GET', '/admin/usage/recordings', ({ params }) => {
  requireOperator()
  const query = readQuery(params)
  const { rows } = filtered(query)
  const recs = new Map(store.data.recordings.map((r) => [r.id, r]))
  const map = new Map<string, UsageRecordingRow>()
  for (const r of rows) {
    if (!r.job_id) continue
    const rec = recs.get(r.job_id)
    if (!rec) continue
    let item = map.get(rec.id)
    if (!item) {
      const n = tenantName(rec.client_id)
      item = {
        id: rec.id,
        client_id: rec.client_id,
        workspace: n.en,
        workspace_ka: n.ka,
        filename: rec.filename,
        created_at: rec.created_at,
        created_by: rec.created_by,
        duration_s: rec.duration_s,
        status: rec.status,
        calls: 0,
        failed: 0,
        input: 0,
        output: 0,
        total: 0,
        groups: {},
      }
      map.set(rec.id, item)
    }
    item.calls += 1
    if (!r.ok) item.failed += 1
    item.input += r.input_tokens
    item.output += r.output_tokens
    item.total += r.total_tokens
    item.groups[r.group] = (item.groups[r.group] ?? 0) + r.total_tokens
  }
  const list = [...map.values()].filter((i) => matchesQ(params.q, i.filename, i.created_by, i.workspace, i.workspace_ka, i.id))
  const accessors: Record<string, (r: UsageRecordingRow) => string | number> = {
    created_at: (r) => Date.parse(r.created_at),
    filename: (r) => r.filename,
    workspace: (r) => r.workspace,
    calls: (r) => r.calls,
    total: (r) => r.total,
    duration_s: (r) => r.duration_s ?? 0,
    created_by: (r) => r.created_by,
  }
  for (const g of ANALYSER_GROUPS) accessors[`group:${g}`] = (r) => r.groups[g] ?? 0
  return paginate(sortRows(list, params, accessors, 'created_at'), params, 25)
})

function groupCards(rows: LlmUsage[]): UsageGroupCard[] {
  const map = new Map<UsageGroup, UsageGroupCard>()
  for (const r of rows) {
    let c = map.get(r.group)
    if (!c) {
      c = { group: r.group, calls: 0, failed: 0, input: 0, output: 0, cached: 0, total: 0, audio_seconds: 0, characters: 0, models: [] }
      map.set(r.group, c)
    }
    c.calls += 1
    if (!r.ok) c.failed += 1
    c.input += r.input_tokens
    c.output += r.output_tokens
    c.cached += r.cache_read_tokens
    c.total += r.total_tokens
    c.audio_seconds += r.audio_seconds ?? 0
    c.characters += r.characters ?? 0
    if (!c.models.includes(r.model)) c.models.push(r.model)
  }
  const order = (g: UsageGroup) => {
    const i = ANALYSER_GROUPS.indexOf(g)
    return i < 0 ? 99 : i
  }
  return [...map.values()].sort((a, b) => order(a.group) - order(b.group))
}

mockApi.register('GET', '/admin/usage/recordings/:id', ({ path }) => {
  requireOperator()
  const rec = store.data.recordings.find((r) => r.id === path.id)
  if (!rec) throw notFound('Recording not found.')
  const rows = store.data.llmUsage.filter((r) => r.job_id === rec.id).sort(byTime)
  const n = tenantName(rec.client_id)
  const digests = store.data.summaries
    .filter((s) => s.job_ids.includes(rec.id))
    .map((s) => {
      const sr = store.data.llmUsage.filter((r) => r.summary_id === s.id)
      return {
        id: s.id,
        title: s.title,
        title_en: s.title_en,
        created_at: s.created_at,
        recordings: s.job_ids.length,
        tokens: sr.reduce((sum, r) => sum + r.total_tokens, 0),
        calls: sr.length,
      }
    })
  const detail: UsageRecordingDetail = {
    recording: {
      id: rec.id,
      client_id: rec.client_id,
      workspace: n.en,
      workspace_ka: n.ka,
      filename: rec.filename,
      created_at: rec.created_at,
      created_by: rec.created_by,
      duration_s: rec.duration_s,
      status: rec.status,
      language: rec.language,
    },
    totals: totalsOf(rows),
    groups: groupCards(rows),
    calls: rows.map(decorate),
    digests,
  }
  return detail
})

/* ---- conversations ---- */

const BOT_FEATURES = ['triage', 'autopilot', 'handoff', 'copilot'] as const

function conversationRow(conv: (typeof store.data.conversations)[number], rows: LlmUsage[]): UsageConversationRow {
  const turns = store.data.turns.filter((t) => t.conversation_id === conv.id)
  const n = tenantName(conv.client_id)
  const features: UsageConversationRow['features'] = {}
  let total = 0
  let failed = 0
  for (const r of rows) {
    total += r.total_tokens
    if (!r.ok) failed += 1
    if ((BOT_FEATURES as readonly string[]).includes(r.feature)) {
      const k = r.feature as (typeof BOT_FEATURES)[number]
      features[k] = (features[k] ?? 0) + r.total_tokens
    }
  }
  return {
    id: conv.id,
    client_id: conv.client_id,
    workspace: n.en,
    workspace_ka: n.ka,
    subject: conv.subject,
    channel: conv.channel,
    state: conv.state,
    mode: conv.mode,
    created_at: conv.created_at,
    last_message_at: conv.last_message_at,
    turns: turns.length,
    questions: turns.filter((t) => t.role === 'customer').length,
    calls: rows.length,
    failed,
    total,
    features,
  }
}

mockApi.register('GET', '/admin/usage/conversations', ({ params }) => {
  requireOperator()
  const query = readQuery(params)
  const { rows } = filtered(query)
  const grouped = new Map<string, LlmUsage[]>()
  for (const r of rows) {
    if (!r.conversation_id) continue
    const arr = grouped.get(r.conversation_id) ?? []
    arr.push(r)
    grouped.set(r.conversation_id, arr)
  }
  const list: UsageConversationRow[] = []
  for (const conv of store.data.conversations) {
    const g = grouped.get(conv.id)
    if (!g) continue
    const row = conversationRow(conv, g)
    if (matchesQ(params.q, row.subject, row.workspace, row.workspace_ka, row.channel, row.state, row.id)) list.push(row)
  }
  const accessors: Record<string, (r: UsageConversationRow) => string | number> = {
    created_at: (r) => Date.parse(r.last_message_at),
    subject: (r) => r.subject,
    workspace: (r) => r.workspace,
    channel: (r) => r.channel,
    state: (r) => r.state,
    turns: (r) => r.turns,
    questions: (r) => r.questions,
    total: (r) => r.total,
    triage: (r) => r.features.triage ?? 0,
    autopilot: (r) => r.features.autopilot ?? 0,
    handoff: (r) => r.features.handoff ?? 0,
    copilot: (r) => r.features.copilot ?? 0,
  }
  return paginate(sortRows(list, params, accessors, 'created_at'), params, 25)
})

mockApi.register('GET', '/admin/usage/conversations/:id', ({ path }) => {
  requireOperator()
  const conv = store.data.conversations.find((c) => c.id === path.id)
  if (!conv) throw notFound('Conversation not found.')
  const rows = store.data.llmUsage.filter((r) => r.conversation_id === conv.id).sort(byTime)
  const decorated = rows.map(decorate)
  const turnIds = new Set<string>()
  const turns: UsageConversationTurn[] = store.data.turns
    .filter((t) => t.conversation_id === conv.id)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .map((t) => {
      turnIds.add(t.id)
      const calls = decorated.filter((c) => c.turn_id === t.id)
      return {
        id: t.id,
        role: t.role,
        content: t.content,
        grounded: t.grounded,
        method: t.method,
        top_score: t.top_score,
        created_at: t.created_at,
        calls,
        tokens: calls.reduce((sum, c) => sum + c.total_tokens, 0),
      }
    })
  const byFeature = new Map<string, { feature: string; calls: number; tokens: number }>()
  for (const r of rows) {
    const cur = byFeature.get(r.feature) ?? { feature: r.feature, calls: 0, tokens: 0 }
    cur.calls += 1
    cur.tokens += r.total_tokens
    byFeature.set(r.feature, cur)
  }
  const detail: UsageConversationDetail = {
    conversation: { ...conversationRow(conv, rows), locale: conv.locale },
    totals: totalsOf(rows),
    turns,
    extra_calls: decorated.filter((c) => !c.turn_id || !turnIds.has(c.turn_id)),
    features: [...byFeature.values()].sort((a, b) => b.tokens - a.tokens),
  }
  return detail
})

/* ---- calls log ---- */

mockApi.register('GET', '/admin/usage/calls', ({ params }) => {
  requireOperator()
  const query = readQuery(params)
  const { rows } = filtered(query)
  const recs = new Map(store.data.recordings.map((r) => [r.id, r.filename]))
  const convs = new Map(store.data.conversations.map((c) => [c.id, c.subject]))
  const q = params.q
  const matched = q
    ? rows.filter((r) => {
        const n = r.client_id ? tenantName(r.client_id) : null
        return matchesQ(
          q,
          r.id,
          r.actor,
          r.feature,
          r.group,
          r.provider,
          r.model,
          r.error,
          r.job_id,
          r.conversation_id,
          r.summary_id,
          n?.en,
          n?.ka,
          r.job_id ? recs.get(r.job_id) : null,
          r.conversation_id ? convs.get(r.conversation_id) : null,
        )
      })
    : rows
  const accessors: Record<string, (r: LlmUsage) => string | number> = {
    created_at: (r) => Date.parse(r.created_at),
    workspace: (r) => (r.client_id ? tenantName(r.client_id).en : ''),
    feature: (r) => r.feature,
    group: (r) => r.group,
    model: (r) => `${r.provider}/${r.model}`,
    tokens: (r) => r.total_tokens,
    latency: (r) => r.latency_ms,
    status: (r) => (r.ok ? 1 : 0),
    actor: (r) => r.actor,
  }
  const page = paginate(sortRows(matched, params, accessors, 'created_at'), params, 50)
  return { ...page, items: page.items.map(decorate) } satisfies Paged<CallRow>
})
