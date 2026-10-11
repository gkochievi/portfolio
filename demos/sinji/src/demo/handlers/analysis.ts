/**
 * Mock handlers for the `analysis` group: manual score edits (a new immutable
 * revision per edit) and the two-stage multi-call digest simulator.
 * Register with `api.register(...)` from '@/demo/core'; this module is imported
 * for its side effects by src/demo/index.ts. OWNED BY: analysis.
 */
import { DemoApiError, notFound } from '@portfolio/demo-kit'

import { recomputeScorecard } from '@/lib/scoring'
import type { CallSummary, ContentLang, Id, Recording, ScoreDimension, ScoreRevision, SummaryParticipant } from '@/types'
import { bus, api, store } from '../core'
import { actorName, requireWorkspaceEditor, tenantScope } from '../guards'
import { logUsage } from '../lib/usage-log'
import { demoEpoch } from '../store'

const MAX_CALLS = 10
const MAX_POINTS = 8
const MAX_NOTE = 500

/* ----------------------------------------------------------------- helpers */

const nowIso = () => new Date().toISOString()

function recordingOf(id: Id, tenant: Id): Recording {
  const rec = store.data.recordings.find((r) => r.id === id && r.client_id === tenant)
  if (!rec) throw notFound('Recording not found.')
  return rec
}

function summaryOf(id: Id, tenant: Id): CallSummary {
  const summary = store.data.summaries.find((s) => s.id === id && s.client_id === tenant)
  if (!summary) throw notFound('Summary not found.')
  return summary
}

const scoreMap = (dims: readonly ScoreDimension[]): Record<string, number | null> =>
  Object.fromEntries(dims.map((d) => [d.key, d.score]))

/* ------------------------------------------------------- PATCH scores edit */

api.register('PATCH', '/recordings/:id/scores', ({ path, body }) => {
  const account = requireWorkspaceEditor()
  const tenant = tenantScope()
  const rec = recordingOf(path.id ?? '', tenant)
  const card = rec.scoring
  if (!card) throw new DemoApiError(409, 'This call has no scorecard yet. Run scoring first.')

  const input = (body ?? {}) as { scores?: Record<string, unknown>; note?: unknown }
  const note = typeof input.note === 'string' ? input.note.trim() : ''
  const errors: Record<string, string> = {}
  if (!note) errors.note = 'Say why the scores are being changed.'
  else if (note.length > MAX_NOTE) errors.note = `Keep the note under ${MAX_NOTE} characters.`

  const incoming = input.scores && typeof input.scores === 'object' ? input.scores : {}
  const changes = new Map<string, number>()
  for (const [key, raw] of Object.entries(incoming)) {
    const dim = card.dimensions.find((d) => d.key === key)
    if (!dim) {
      errors.scores = `Unknown dimension "${key}".`
      continue
    }
    if (dim.source !== 'model') {
      errors[`scores.${key}`] = 'Measured dimensions come from the analysers and cannot be edited by hand.'
      continue
    }
    if (!dim.applicable) {
      errors[`scores.${key}`] = 'This dimension does not apply to this call.'
      continue
    }
    const value = typeof raw === 'number' ? raw : Number.NaN
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > dim.max) {
      errors[`scores.${key}`] = `Enter a whole number from 0 to ${dim.max}.`
      continue
    }
    if (dim.score !== value) changes.set(key, value)
  }
  if (!errors.scores && Object.keys(errors).every((k) => !k.startsWith('scores.')) && changes.size === 0) {
    errors.scores = 'Change at least one score.'
  }
  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)

  const original = rec.revisions[0]?.scores ?? {}
  const dimensions: ScoreDimension[] = card.dimensions.map((d) => {
    const next = changes.get(d.key)
    if (next === undefined) return d
    const modelScore = original[d.key] ?? d.ai_score ?? d.score
    const edited = modelScore !== next
    return { ...d, score: next, edited, ai_score: edited ? modelScore : null }
  })

  const revisionNo = (rec.revisions[rec.revisions.length - 1]?.revision ?? card.revision ?? 1) + 1
  const next = recomputeScorecard({
    ...card,
    dimensions,
    revision: revisionNo,
    manually_edited: dimensions.some((d) => d.edited),
    edited_by: account.name,
  })
  const revision: ScoreRevision = {
    revision: revisionNo,
    scores: scoreMap(next.dimensions),
    note,
    edited_by: account.name,
    created_at: nowIso(),
    weighted_total: next.weighted_total,
  }
  rec.scoring = next
  rec.revisions.push(revision)
  if (rec.analysis) rec.analysis = { ...rec.analysis, quality_score: next.weighted_total }
  store.notify()
  bus.emit('recording:updated', { id: rec.id })
  return rec
})

/* ------------------------------------------------------------ summaries API */

api.register('GET', '/summaries', ({ params }) => {
  const tenant = tenantScope()
  const recordingId = params.recording_id
  return store.data.summaries
    .filter((s) => s.client_id === tenant)
    .filter((s) => !recordingId || s.job_ids.includes(recordingId))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
})

api.register('GET', '/summaries/:id', ({ path }) => summaryOf(path.id ?? '', tenantScope()))

api.register('POST', '/summaries', ({ body }) => {
  const tenant = tenantScope()
  const input = (body ?? {}) as { recording_ids?: unknown }
  const ids = Array.isArray(input.recording_ids) ? [...new Set(input.recording_ids.filter((x): x is string => typeof x === 'string'))] : []
  if (ids.length === 0) throw DemoApiError.validation({ recording_ids: 'Pick at least one call.' })
  if (ids.length > MAX_CALLS) throw DemoApiError.validation({ recording_ids: `A digest covers up to ${MAX_CALLS} calls.` })
  const recs = ids.map((id) => recordingOf(id, tenant))
  const empty = recs.find((r) => r.segments.length === 0)
  if (empty) throw DemoApiError.validation({ recording_ids: `${empty.filename} has no transcript yet.` })

  const summary: CallSummary = {
    id: store.nextId('sum_'),
    client_id: tenant,
    job_ids: ids,
    language: pickLanguage(recs),
    title: '',
    short_summary: '',
    key_points: [],
    action_items: [],
    participants: [],
    calls: [],
    stages: [],
    status: 'running',
    created_by: actorName(),
    created_at: nowIso(),
  }
  summary.title = recs.length === 1 ? callTitle(recs[0]!) : ''
  store.data.summaries.unshift(summary)
  store.notify()
  bus.emit('summary:updated', { id: summary.id })
  runDigest(summary.id, ids, tenant)
  return summary
})

/* ------------------------------------------------------- digest simulator */

function runDigest(summaryId: Id, recIds: Id[], tenant: Id): void {
  const epoch = demoEpoch()
  const perCallMs = 1100 + Math.round(Math.random() * 300)
  const mergeMs = 900 + Math.round(Math.random() * 250)
  const find = () => store.data.summaries.find((s) => s.id === summaryId)

  setTimeout(() => {
    if (epoch !== demoEpoch()) return
    const summary = find()
    if (!summary) return
    const recs = recIds.map((id) => store.data.recordings.find((r) => r.id === id && r.client_id === tenant)).filter((r): r is Recording => !!r)
    summary.calls = recs.map((rec, i) => perCall(rec, i + 1))
    summary.stages = [{ name: 'per_call', ms: perCallMs }]
    store.notify()
    bus.emit('summary:updated', { id: summaryId })

    setTimeout(() => {
      if (epoch !== demoEpoch()) return
      const live = find()
      if (!live) return
      const liveRecs = recIds.map((id) => store.data.recordings.find((r) => r.id === id && r.client_id === tenant)).filter((r): r is Recording => !!r)
      if (liveRecs.length === 0) {
        live.status = 'error'
        store.notify()
        bus.emit('summary:updated', { id: summaryId })
        return
      }
      merge(live, liveRecs)
      live.stages = [...live.stages, { name: 'merge', ms: mergeMs }]
      live.status = 'done'
      const chars = liveRecs.reduce((sum, r) => sum + r.transcript.length, 0)
      logUsage({
        feature: 'summarise',
        group: 'summary',
        capability: 'llm',
        client_id: tenant,
        summary_id: summaryId,
        input_tokens: Math.round(chars / 3.6) + 420,
        output_tokens: 260 + 90 * liveRecs.length,
        latency_ms: perCallMs + mergeMs,
      })
      store.notify()
      bus.emit('summary:updated', { id: summaryId })
    }, mergeMs)
  }, perCallMs)
}

/* ---------------------------------------------------------- content builders */

const isKa = (lang: ContentLang | null | undefined) => lang === 'ka'

function pickLanguage(recs: Recording[]): ContentLang {
  const counts = new Map<ContentLang, number>()
  for (const r of recs) counts.set(r.language ?? 'en', (counts.get(r.language ?? 'en') ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'ka'
}

function callTitle(rec: Recording): string {
  const canned = rec.canned_id ? store.data.cannedCalls.find((c) => c.id === rec.canned_id) : undefined
  return canned?.title ?? rec.filename.replace(/\.[a-z0-9]{2,4}$/i, '')
}

const firstSentence = (text: string): string => {
  const m = text.trim().match(/^.*?[.!?。](?=\s|$)/)
  return (m?.[0] ?? text).trim()
}

interface CallLine {
  index: number
  recording_id: Id
  title: string
  summary: string
  outcome: string
  summary_en?: string
  outcome_en?: string
}

function outcomeOf(rec: Recording, lang: 'ka' | 'en'): string {
  const n = rec.kb_check?.counts.contradicted ?? 0
  const total = rec.scoring?.weighted_total ?? rec.analysis?.quality_score ?? null
  if (lang === 'ka') {
    if (n > 0) return `${n} მტკიცება ცოდნის ბაზას ეწინააღმდეგება${total !== null ? `; ქულა ${total}/100` : ''}.`
    if (rec.sentiment?.agreement === 'conflict') return `სიტყვები და ხმა ერთმანეთს არ ემთხვევა${total !== null ? `; ქულა ${total}/100` : ''}.`
    if (total !== null) return total >= 80 ? `საკითხი გადაწყდა, წინააღმდეგობა არ დაფიქსირებულა; ქულა ${total}/100.` : `ზარი შეფასდა: ${total}/100; არის გასაუმჯობესებელი ადგილები.`
    return 'ანალიზი ჯერ სრულად არ არის გაშვებული.'
  }
  if (n > 0) return `${n} claim${n === 1 ? '' : 's'} contradict the knowledge base${total !== null ? `; score ${total}/100` : ''}.`
  if (rec.sentiment?.agreement === 'conflict') return `Words and voice disagree${total !== null ? `; score ${total}/100` : ''}.`
  if (total !== null) return total >= 80 ? `Resolved with no contradicted claims; score ${total}/100.` : `Call scored ${total}/100; there is room to coach.`
  return 'Analysis has not been fully run yet.'
}

function perCall(rec: Recording, index: number): CallSummary['calls'][number] {
  const lang: 'ka' | 'en' = isKa(rec.analysis?.language ?? rec.language) ? 'ka' : 'en'
  const fallback =
    lang === 'ka'
      ? `${rec.segments.length} რეპლიკა; ${firstSentence(rec.segments[0]?.text ?? '')}`
      : `${rec.segments.length} turns; ${firstSentence(rec.segments[0]?.text ?? '')}`
  const line: CallLine = {
    index,
    recording_id: rec.id,
    title: callTitle(rec),
    summary: rec.analysis?.summary ?? fallback,
    outcome: outcomeOf(rec, lang),
  }
  if (lang === 'ka') {
    line.summary_en = rec.analysis?.summary_en
    line.outcome_en = outcomeOf(rec, 'en')
  }
  return line
}

/** Dedupe by normalised text while keeping order; round-robin across the calls. */
function interleave<T extends { text: string }>(lists: T[][], max: number): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  const longest = Math.max(0, ...lists.map((l) => l.length))
  for (let i = 0; i < longest && out.length < max; i++) {
    for (const list of lists) {
      const item = list[i]
      if (!item) continue
      const key = item.text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(item)
      if (out.length >= max) break
    }
  }
  return out
}

function actionItemsFor(rec: Recording, index: number, lang: 'ka' | 'en'): Array<{ text: string; en: string }> {
  const items: Array<{ text: string; en: string }> = []
  const tag = (n: string, nEn: string, ka: string, en: string) => ({ text: `${ka} (${n})`, en: `${en} (${nEn})` })
  const label = `#${index}`
  void lang
  for (const claim of rec.kb_check?.claims ?? []) {
    if (claim.verdict === 'CONTRADICTED') {
      items.push(
        tag(label, label, `ოპერატორს გაუსწორდეს მცდარი ინფორმაცია: „${claim.claim}“`, `Correct the agent's wrong statement: "${claim.claim_en ?? claim.claim}"`),
      )
    }
  }
  const unknown = (rec.kb_check?.claims ?? []).filter((c) => c.verdict === 'NOT_IN_KB')
  if (unknown.length > 0) {
    items.push(tag(label, label, `ცოდნის ბაზაში დაემატოს ${unknown.length} ახალი მტკიცება`, `Add ${unknown.length} unverified claim${unknown.length === 1 ? '' : 's'} to the knowledge base`))
  }
  const weakest = (rec.scoring?.dimensions ?? [])
    .filter((d) => d.source === 'model' && d.applicable && d.score !== null && d.score < 60)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]
  if (weakest) {
    items.push(tag(label, label, `ტრენინგი თემაზე: ${weakest.name}`, `Coach on: ${weakest.name_en ?? weakest.name}`))
  }
  if (rec.sentiment?.agreement === 'conflict') {
    items.push(tag(label, label, 'მომხმარებელს დაუკავშირდეს უფროსი ოპერატორი: სიტყვები და ხმა არ ემთხვევა', 'A senior agent should follow up with the customer: words and voice disagree'))
  }
  return items
}

function merge(summary: CallSummary, recs: Recording[]): void {
  const ka = isKa(summary.language)
  const analyses = recs.map((r) => r.analysis)

  // Key points: dedupe, round-robin so every call is represented.
  const pointLists = recs.map((r) => {
    const a = r.analysis
    return (a?.key_points ?? []).map((text, i) => ({ text, en: a?.key_points_en?.[i] }))
  })
  const points = interleave(pointLists, MAX_POINTS)
  summary.key_points = points.map((p) => p.text)
  const glosses = points.map((p) => p.en)
  if (ka && glosses.every(Boolean)) summary.key_points_en = glosses as string[]

  // Action items gathered from the evidence of every call.
  const actionLists = recs.map((r, i) => actionItemsFor(r, i + 1, ka ? 'ka' : 'en'))
  const actions = interleave(actionLists, MAX_POINTS)
  const actionText = (a: { text: string; en: string }) => (ka ? a.text : a.en)
  summary.action_items = actions.map(actionText)
  if (ka) summary.action_items_en = actions.map((a) => a.en)

  // Participants: one agent and one customer per call.
  const participants: SummaryParticipant[] = []
  recs.forEach((_, i) => {
    participants.push({ label: ka ? `ოპერატორი ${i + 1}` : `Agent ${i + 1}`, role: 'agent', appears_in: [i + 1] })
    participants.push({ label: ka ? `მომხმარებელი ${i + 1}` : `Customer ${i + 1}`, role: 'customer', appears_in: [i + 1] })
  })
  summary.participants = participants

  // Title and short summary.
  const titles = recs.map(callTitle)
  const scores = recs.map((r) => r.scoring?.weighted_total).filter((s): s is number => typeof s === 'number')
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const contradicted = recs.reduce((sum, r) => sum + (r.kb_check?.counts.contradicted ?? 0), 0)
  const lead = recs.map((_r, i) => firstSentence(analyses[i]?.summary ?? summary.calls[i]?.summary ?? ''))
  const leadEn = recs.map((_r, i) => firstSentence(analyses[i]?.summary_en ?? ''))
  const count = recs.length
  if (ka) {
    summary.title = count === 1 ? titles[0]! : `${count} ზარის შეჯამება: ${titles[0]}${count > 1 ? ' და სხვა' : ''}`
    summary.title_en = count === 1 ? titles[0]! : `Digest of ${count} calls: ${titles[0]} and more`
    summary.short_summary = [
      `${count} ზარი გაანალიზდა${avg !== null ? `, საშუალო ქულა ${avg}/100` : ''}${contradicted ? `, ცოდნის ბაზასთან წინააღმდეგობა: ${contradicted}` : ''}.`,
      ...lead.filter(Boolean),
    ].join(' ')
    if (leadEn.every(Boolean)) {
      summary.short_summary_en = [
        `${count} call${count === 1 ? '' : 's'} analysed${avg !== null ? `, average score ${avg}/100` : ''}${contradicted ? `, ${contradicted} contradiction${contradicted === 1 ? '' : 's'} with the knowledge base` : ''}.`,
        ...leadEn,
      ].join(' ')
    }
  } else {
    summary.title = count === 1 ? titles[0]! : `Digest of ${count} calls: ${titles[0]} and more`
    summary.short_summary = [
      `${count} call${count === 1 ? '' : 's'} analysed${avg !== null ? `, average score ${avg}/100` : ''}${contradicted ? `, ${contradicted} contradiction${contradicted === 1 ? '' : 's'} with the knowledge base` : ''}.`,
      ...lead.filter(Boolean),
    ].join(' ')
  }
}
