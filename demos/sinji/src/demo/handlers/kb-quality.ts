/**
 * Mock handlers for the `kb-quality` group: retrieval playground, quick search,
 * duplicate scan, activity log, export, full re-embed job and the curation
 * queue. OWNED BY: kb-quality.
 *
 * Everything is scoped to the request's tenant (`tenantScope()`); the curation
 * decisions and the re-embed job need workspace-editor rights (members read).
 */
import { conflict, DemoApiError, every, notFound } from '@portfolio/demo-kit'

import type {
  Confidence,
  CurationEvidence,
  CurationProposal,
  DuplicateReport,
  Id,
  KbChunk,
  KbDocument,
  KbEvent,
  KbEventAction,
  ReembedJob,
  RetrievalHit,
  RetrievalResult,
} from '@/types'
import { api, bus, store } from '../core'
import { actorName, requireWorkspaceEditor, tenantScope } from '../guards'
import { logUsage } from '../lib/usage-log'
import {
  checksum,
  chunkText,
  confidenceOf,
  estimateTokens,
  jaccard,
  rankByText,
  shingles,
  snippetFor,
} from '../lib/text'
import { demoEpoch } from '../store'

const now = () => new Date().toISOString()

/* ------------------------------------------------------------- shared bits */

function tenantDocs(clientId: Id): KbDocument[] {
  return store.data.kbDocuments.filter((d) => d.client_id === clientId)
}

function readyChunks(clientId: Id): Array<KbChunk & { doc: KbDocument }> {
  const docs = new Map(tenantDocs(clientId).filter((d) => d.status === 'ready').map((d) => [d.id, d]))
  const out: Array<KbChunk & { doc: KbDocument }> = []
  for (const chunk of store.data.kbChunks) {
    if (chunk.client_id !== clientId) continue
    const doc = docs.get(chunk.document_id)
    if (doc) out.push({ ...chunk, doc })
  }
  return out
}

function logEvent(
  clientId: Id,
  action: KbEventAction,
  fields: Partial<Omit<KbEvent, 'id' | 'client_id' | 'action' | 'created_at'>> & { detail: string },
): KbEvent {
  const event: KbEvent = {
    id: store.nextId('kev_'),
    client_id: clientId,
    document_id: null,
    document_title: null,
    method: null,
    status: 'ok',
    actor: actorName(),
    chunk_count: null,
    duration_ms: null,
    ...fields,
    action,
    created_at: now(),
  }
  store.data.kbEvents.push(event)
  return event
}

/**
 * Stand-in for a multilingual embedding model: English query words are mapped to
 * the Georgian vocabulary the seeded knowledge bases are written in, so an
 * English question finds the Georgian passage it means. Unknown words pass through.
 */
const EN_KA: Array<[RegExp, string]> = [
  [/\b(early|prepay\w*|repay\w*|pay\s?off)\b/i, 'ვადამდელი დაფარვა'],
  [/\b(fees?|commissions?|charges?)\b/i, 'საკომისიო'],
  [/\b(discounts?)\b/i, 'ფასდაკლება ზღვრები'],
  [/\b(maximum|max|limits?)\b/i, 'მაქსიმალური ზღვარი'],
  [/\b(cards?)\b/i, 'ბარათი'],
  [/\b(block\w*|lost|stolen|freeze)\b/i, 'დაბლოკვა დაკარგვა'],
  [/\b(loans?|credit)\b/i, 'სესხი'],
  [/\b(mortgage|home\s?loan)\b/i, 'იპოთეკა'],
  [/\b(deposits?|savings?)\b/i, 'დეპოზიტი'],
  [/\b(rates?|interest)\b/i, 'განაკვეთი პროცენტი'],
  [/\b(transfers?|swift|wire)\b/i, 'გადარიცხვა'],
  [/\b(app|mobile)\b/i, 'მობილური აპლიკაცია'],
  [/\b(complaints?)\b/i, 'საჩივარი'],
  [/\b(hours|open\w*|branch\w*|sunday|weekend)\b/i, 'სამუშაო საათები ფილიალი კვირა'],
  [/\b(password|pin|sms|code)\b/i, 'პაროლი SMS კოდი'],
  [/\b(kasko|comprehensive)\b/i, 'კასკო'],
  [/\b(claims?)\b/i, 'ზარალი'],
  [/\b(cancel\w*)\b/i, 'გაუქმება'],
  [/\b(policy|insurance)\b/i, 'პოლისი დაზღვევა'],
  [/\b(refunds?)\b/i, 'დაბრუნება'],
  [/\b(delivery)\b/i, 'მიწოდება'],
]

function expandQuery(query: string): string {
  if (!/[A-Za-z]/.test(query)) return query
  const extra = EN_KA.filter(([pattern]) => pattern.test(query)).map(([, ka]) => ka)
  return extra.length ? `${query} ${extra.join(' ')}` : query
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/* --------------------------------------------------------------- retrieval */

function retrieve(clientId: Id, query: string, topK: number, threshold: number): RetrievalResult {
  const started = performance.now()
  const chunks = readyChunks(clientId)
  if (chunks.length === 0) {
    return { query, method: 'none', top_score: 0, margin: 0, confidence: 'low', hits: [], took_ms: 4 }
  }
  const expanded = expandQuery(query)
  const ranked = rankByText(expanded, chunks.map((c) => ({ ...c, content: `${c.doc.title}\n${c.content}` })))
  const { confidence, top, margin } = confidenceOf(ranked.slice(0, topK).map((r) => r.score))
  const hits: RetrievalHit[] = ranked
    .filter((r) => r.score >= threshold)
    .slice(0, topK)
    .map(({ item, score }) => ({
      chunk_id: item.id,
      document_id: item.document_id,
      title: item.doc.title,
      doc_type: item.doc.doc_type,
      visibility: item.doc.visibility,
      chunk_index: item.chunk_index,
      score,
      snippet: snippetFor(item.content, expanded, 260),
    }))
  // Duration is simulated: a vector search over a few dozen chunks is a few milliseconds.
  const took = Math.max(6, Math.round(performance.now() - started) + 9 + (chunks.length % 7))
  return { query, method: 'vector', top_score: top, margin, confidence: confidence as Confidence, hits, took_ms: took }
}

api.register('POST', '/kb/retrieve', ({ body }) => {
  const clientId = tenantScope()
  const input = (body ?? {}) as { query?: unknown; top_k?: unknown; threshold?: unknown }
  const query = typeof input.query === 'string' ? input.query.trim() : ''
  const topK = input.top_k === undefined ? 5 : Number(input.top_k)
  const threshold = input.threshold === undefined ? 0 : Number(input.threshold)
  const errors: Record<string, string> = {}
  if (!query) errors.query = 'Enter a question to test.'
  else if (query.length > 500) errors.query = 'Keep the query under 500 characters.'
  if (!Number.isInteger(topK) || topK < 1 || topK > 20) errors.top_k = 'Top K must be a whole number from 1 to 20.'
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) errors.threshold = 'Threshold must be between 0 and 1.'
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
  return retrieve(clientId, query, topK, threshold)
})

api.register('GET', '/kb/search', ({ params }) => {
  const clientId = tenantScope()
  const q = (params.q ?? '').trim()
  if (!q) return { query: q, method: 'keyword' as const, hits: [] as RetrievalHit[] }
  const expanded = expandQuery(q)
  const ranked = rankByText(expanded, readyChunks(clientId).map((c) => ({ ...c, content: `${c.doc.title}\n${c.content}` })))
  const hits: RetrievalHit[] = ranked
    .filter((r) => r.score > 0.351)
    .slice(0, 8)
    .map(({ item, score }) => ({
      chunk_id: item.id,
      document_id: item.document_id,
      title: item.doc.title,
      doc_type: item.doc.doc_type,
      visibility: item.doc.visibility,
      chunk_index: item.chunk_index,
      score,
      snippet: snippetFor(item.content, expanded, 200),
    }))
  return { query: q, method: 'keyword' as const, hits }
})

/* -------------------------------------------------------------- duplicates */

api.register('GET', '/kb/duplicates', (): DuplicateReport => {
  const clientId = tenantScope()
  const docs = tenantDocs(clientId).filter((d) => d.status === 'ready' && d.content_text.trim())
  const byChecksum = new Map<string, KbDocument[]>()
  for (const doc of docs) {
    const key = checksum(doc.content_text)
    byChecksum.set(key, [...(byChecksum.get(key) ?? []), doc])
  }
  const exact: DuplicateReport['exact'] = []
  for (const [key, group] of byChecksum) {
    if (group.length < 2) continue
    const sorted = [...group].sort((a, b) => a.created_at.localeCompare(b.created_at))
    exact.push({
      checksum: key,
      documents: sorted.map((d, i) => ({ id: d.id, title: d.title, updated_at: d.updated_at, keep: i === 0 })),
    })
  }

  const prints = docs.map((d) => ({ doc: d, key: checksum(d.content_text), grams: shingles(d.content_text) }))
  const near: DuplicateReport['near'] = []
  for (let i = 0; i < prints.length; i += 1) {
    for (let j = i + 1; j < prints.length; j += 1) {
      const a = prints[i]
      const b = prints[j]
      if (!a || !b || a.key === b.key) continue
      const similarity = jaccard(a.grams, b.grams)
      if (similarity > 0.85) {
        near.push({
          a: { id: a.doc.id, title: a.doc.title },
          b: { id: b.doc.id, title: b.doc.title },
          similarity: round3(similarity),
        })
      }
    }
  }
  near.sort((x, y) => y.similarity - x.similarity)
  return { exact, near, scanned_at: now() }
})

/* ---------------------------------------------------------------- activity */

api.register('GET', '/kb/events', ({ params }) => {
  const clientId = tenantScope()
  const action = params.action
  return store.data.kbEvents
    .filter((e) => e.client_id === clientId && (!action || e.action === action))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 300)
})

/* ------------------------------------------------------------------ export */

const csvCell = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`

api.register('GET', '/kb/export', ({ params }) => {
  const clientId = tenantScope()
  const format = params.format === 'csv' ? 'csv' : 'json'
  const docs = tenantDocs(clientId)
  const tenant = store.data.tenants.find((t) => t.id === clientId)
  const stamp = now().slice(0, 10)
  const filename = `${tenant?.slug ?? 'workspace'}-knowledge-base-${stamp}.${format}`
  const chunksOf = (id: Id) => store.data.kbChunks.filter((c) => c.document_id === id).sort((a, b) => a.chunk_index - b.chunk_index)
  let content: string
  if (format === 'json') {
    content = JSON.stringify(
      {
        exported_at: now(),
        workspace: tenant?.slug ?? clientId,
        documents: docs.map((d) => ({
          id: d.id,
          title: d.title,
          doc_type: d.doc_type,
          visibility: d.visibility,
          status: d.status,
          tags: d.tags,
          updated_at: d.updated_at,
          content: d.content_text,
          chunks: chunksOf(d.id).map((c) => ({ index: c.chunk_index, tokens: c.token_count, text: c.content })),
        })),
      },
      null,
      2,
    )
  } else {
    const header = ['id', 'title', 'type', 'visibility', 'status', 'tags', 'chunks', 'updated_at', 'content']
    const rows = docs.map((d) =>
      [d.id, d.title, d.doc_type, d.visibility, d.status, d.tags.join('; '), d.chunk_count, d.updated_at, d.content_text].map(csvCell).join(','),
    )
    content = `﻿${header.join(',')}\n${rows.join('\n')}\n`
  }
  logEvent(clientId, 'export', {
    method: format,
    detail: `Exported ${docs.length} documents as ${format.toUpperCase()}`,
    duration_ms: 180 + docs.length * 6,
  })
  store.notify()
  return { filename, mime: format === 'json' ? 'application/json' : 'text/csv', content }
})

/* --------------------------------------------------------------- re-embed */

const latestJob = (clientId: Id): ReembedJob | null => {
  const jobs = store.data.reembedJobs.filter((j) => j.client_id === clientId)
  return jobs[jobs.length - 1] ?? null
}

api.register('GET', '/kb/reembed-jobs/current', () => latestJob(tenantScope()))

api.register('POST', '/kb/reembed-jobs', () => {
  const clientId = tenantScope()
  requireWorkspaceEditor()
  const existing = latestJob(clientId)
  if (existing && (existing.state === 'running' || existing.state === 'queued')) {
    throw conflict('A re-embed job is already running for this workspace.')
  }
  const docs = tenantDocs(clientId)
  const job: ReembedJob = {
    id: store.nextId('rej_'),
    client_id: clientId,
    state: 'running',
    total_documents: docs.length,
    done_documents: 0,
    failed_documents: 0,
    created_at: now(),
    finished_at: null,
    error: null,
  }
  store.data.reembedJobs.push(job)
  store.notify()
  const epoch = demoEpoch()
  const startedAt = Date.now()
  const stop = every(500, () => {
    if (epoch !== demoEpoch()) return stop()
    const current = store.data.reembedJobs.find((j) => j.id === job.id)
    if (!current) return stop()
    const doc = tenantDocs(clientId)[current.done_documents + current.failed_documents]
    if (doc && (doc.status === 'error' || !doc.content_text.trim())) current.failed_documents += 1
    else current.done_documents += 1
    if (current.done_documents + current.failed_documents >= current.total_documents) {
      current.state = 'done'
      current.finished_at = now()
      for (const chunk of store.data.kbChunks) if (chunk.client_id === clientId) chunk.has_embedding = true
      const chunkTotal = store.data.kbChunks.filter((c) => c.client_id === clientId).length
      logEvent(clientId, 'reembed', {
        detail:
          current.failed_documents > 0
            ? `Full re-embed: ${current.done_documents} of ${current.total_documents} documents (${current.failed_documents} failed: no text)`
            : `Full re-embed: ${current.done_documents} documents`,
        status: current.failed_documents > 0 ? 'error' : 'ok',
        chunk_count: chunkTotal,
        duration_ms: Date.now() - startedAt,
      })
      logUsage({
        feature: 'embed',
        group: 'kb',
        capability: 'embed',
        client_id: clientId,
        input_tokens: store.data.kbChunks.filter((c) => c.client_id === clientId).reduce((sum, c) => sum + c.token_count, 0),
        latency_ms: Date.now() - startedAt,
      })
      stop()
      bus.emit('kb:changed', { client_id: clientId })
    }
    store.notify()
    bus.emit('reembed:progress', { job: structuredClone(current) })
  })
  return job
})

/* ---------------------------------------------------------------- curation */

const PRIORITY_RANK: Record<CurationProposal['priority'], number> = { high: 0, medium: 1, low: 2 }

function proposalsOf(clientId: Id): CurationProposal[] {
  return store.data.curationProposals.filter((p) => p.client_id === clientId)
}

api.register('GET', '/curation/proposals', ({ params }) => {
  const clientId = tenantScope()
  const state = params.state
  return proposalsOf(clientId)
    .filter((p) => !state || p.state === state)
    .sort((a, b) => {
      if (a.state !== 'pending') return (b.decided_at ?? '').localeCompare(a.decided_at ?? '')
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.confidence - a.confidence
    })
})

api.register('GET', '/curation/summary', () => {
  const pending = proposalsOf(tenantScope()).filter((p) => p.state === 'pending')
  return { pending: pending.length, high_priority: pending.filter((p) => p.priority === 'high').length }
})

function rebuildChunks(doc: KbDocument, startedAt: number): void {
  store.data.kbChunks = store.data.kbChunks.filter((c) => c.document_id !== doc.id)
  const pieces = chunkText(doc.content_text)
  pieces.forEach((content, index) => {
    store.data.kbChunks.push({
      id: store.nextId('chk_'),
      client_id: doc.client_id,
      document_id: doc.id,
      chunk_index: index,
      content,
      token_count: estimateTokens(content),
      has_embedding: true,
      metadata: { section: String(index + 1) },
    })
  })
  doc.chunk_count = pieces.length
  doc.status = 'ready'
  doc.error = null
  doc.ingest_ms = Date.now() - startedAt
  doc.updated_at = now()
}

/** Apply an accepted proposal to the knowledge base. Returns the affected document. */
function applyProposal(p: CurationProposal, content: string): KbDocument | null {
  const epoch = demoEpoch()
  const startedAt = Date.now()
  const afterReembed = (docId: Id) => {
    setTimeout(() => {
      if (epoch !== demoEpoch()) return
      const doc = store.data.kbDocuments.find((d) => d.id === docId)
      if (!doc) return
      rebuildChunks(doc, startedAt)
      store.notify()
      bus.emit('kb:changed', { client_id: p.client_id })
    }, 1000)
  }

  if (p.op === 'add') {
    const doc: KbDocument = {
      id: store.nextId('doc_'),
      client_id: p.client_id,
      title: p.title,
      ...(p.title_en ? { title_en: p.title_en } : {}),
      doc_type: 'faq',
      tags: [...p.suggested_tags],
      content_text: content,
      char_count: content.length,
      chunk_count: 0,
      status: 'processing',
      error: null,
      source_type: 'api',
      filename: null,
      visibility: 'public',
      checksum: checksum(content),
      actor: actorName(),
      ingest_ms: null,
      metadata: { origin: 'curation', proposal: p.id },
      restructure: 'none',
      created_at: now(),
      updated_at: now(),
    }
    store.data.kbDocuments.push(doc)
    afterReembed(doc.id)
    return doc
  }

  const target = p.target ? store.data.kbDocuments.find((d) => d.id === p.target?.document_id && d.client_id === p.client_id) : undefined
  if (!target) {
    p.apply_error = 'The target document no longer exists.'
    throw conflict('The target document no longer exists. Decline this proposal instead.')
  }

  if (p.op === 'remove') {
    store.data.kbDocuments = store.data.kbDocuments.filter((d) => d.id !== target.id)
    store.data.kbChunks = store.data.kbChunks.filter((c) => c.document_id !== target.id)
    return target
  }

  // update: replace the passage the proposal was mined against, or the whole text when it cannot be located.
  const passage = p.target?.content ?? ''
  target.content_text = passage && target.content_text.includes(passage) ? target.content_text.replace(passage, content) : content
  target.char_count = target.content_text.length
  target.checksum = checksum(target.content_text)
  target.status = 'processing'
  target.chunk_count = 0
  target.updated_at = now()
  store.data.kbChunks = store.data.kbChunks.filter((c) => c.document_id !== target.id)
  afterReembed(target.id)
  return target
}

function acceptProposal(p: CurationProposal, edited?: string): void {
  const content = (edited ?? p.proposed_content).trim()
  if (p.op !== 'remove' && !content) throw DemoApiError.validation({ content: 'The proposed text cannot be empty.' })
  const doc = applyProposal(p, content)
  p.state = 'accepted'
  p.apply_error = null
  p.decided_at = now()
  p.decided_by = actorName()
  if (edited !== undefined && p.op !== 'remove') p.proposed_content = content
  logEvent(p.client_id, 'curation', {
    document_id: doc?.id ?? null,
    document_title: doc?.title ?? p.title,
    detail: `Curation proposal accepted (${p.op}${edited !== undefined ? ', edited' : ''}): ${p.title}`,
    chunk_count: p.op === 'remove' ? 0 : chunkText(content).length,
    duration_ms: 1000,
  })
  logUsage({
    feature: 'curation',
    group: 'kb',
    capability: 'embed',
    client_id: p.client_id,
    input_tokens: estimateTokens(content),
    latency_ms: 1000,
  })
}

function findProposal(id: string): CurationProposal {
  const clientId = tenantScope()
  const p = store.data.curationProposals.find((x) => x.id === id && x.client_id === clientId)
  if (!p) throw notFound('Proposal not found.')
  return p
}

function emitCuration(clientId: Id): void {
  store.notify()
  bus.emit('curation:changed', { client_id: clientId })
  bus.emit('kb:changed', { client_id: clientId })
}

api.register('POST', '/curation/proposals/bulk-accept', ({ body }) => {
  const clientId = tenantScope()
  requireWorkspaceEditor()
  const ids = (body as { ids?: unknown } | null)?.ids
  if (!Array.isArray(ids) || ids.length === 0) throw DemoApiError.validation({ ids: 'Select at least one proposal.' })
  let accepted = 0
  let skipped = 0
  for (const id of ids) {
    const p = store.data.curationProposals.find((x) => x.id === id && x.client_id === clientId)
    if (!p || p.state !== 'pending' || p.op === 'remove') {
      skipped += 1
      continue
    }
    try {
      acceptProposal(p)
      accepted += 1
    } catch {
      skipped += 1
    }
  }
  emitCuration(clientId)
  return { accepted, skipped }
})

api.register('POST', '/curation/proposals/:id/accept', ({ path, body }) => {
  requireWorkspaceEditor()
  const p = findProposal(path.id ?? '')
  if (p.state !== 'pending') throw conflict('This proposal has already been decided.')
  const content = (body as { content?: unknown } | null)?.content
  if (content !== undefined && typeof content !== 'string') throw DemoApiError.validation({ content: 'Content must be text.' })
  acceptProposal(p, content)
  emitCuration(p.client_id)
  return p
})

api.register('POST', '/curation/proposals/:id/decline', ({ path, body }) => {
  requireWorkspaceEditor()
  const p = findProposal(path.id ?? '')
  if (p.state !== 'pending') throw conflict('This proposal has already been decided.')
  const reason = String((body as { reason?: unknown } | null)?.reason ?? '').trim()
  if (!reason) throw DemoApiError.validation({ reason: 'Tell us why, so the miner can learn from it.' })
  p.state = 'declined'
  p.decline_reason = reason
  p.decided_at = now()
  p.decided_by = actorName()
  emitCuration(p.client_id)
  return p
})

/* "Run now": a pool of new patterns the miner can surface, 1-2 at a time. */

interface Template {
  cluster: string
  title: string
  title_en: string
  content: string
  rationale: string
  rationale_en: string
  tags: string[]
  signal: CurationProposal['signal']
  priority: CurationProposal['priority']
  risk: CurationProposal['risk']
  question: string
  answer: string
  source: CurationEvidence['source_kind']
  mtiebiOnly?: boolean
}

const TEMPLATES: Template[] = [
  {
    cluster: 'SMS კოდი არ მოდის',
    title: 'რა ვქნა, თუ SMS კოდი არ მომივიდა',
    title_en: 'What to do when the SMS code does not arrive',
    content:
      'თუ აპლიკაციაში შესვლისას SMS კოდი არ მოდის, დაელოდეთ ერთ წუთს და მოითხოვეთ კოდი თავიდან. შეამოწმეთ, რომ ტელეფონს აქვს ქსელი და ბანკში დაფიქსირებული ნომერი სწორია. პრობლემის გაგრძელებისას დაგვირეკეთ ცხელ ხაზზე *7070. კოდი არავის გაუმხილოთ, ბანკის თანამშრომელსაც კი.',
    rationale: 'ბოტმა სამ საუბარში ვერ უპასუხა კითხვას „კოდი არ მოდის“, ოპერატორებმა კი ერთნაირი პასუხი გასცეს.',
    rationale_en: 'The bot could not answer "the code does not arrive" in three conversations; operators then gave the same answer each time.',
    tags: ['აპლიკაცია', 'უსაფრთხოება'],
    signal: 'S5',
    priority: 'medium',
    risk: 'low',
    question: 'აპლიკაციაში შესვლისას კოდი არ მომდის, რა ვქნა?',
    answer: 'დაელოდეთ ერთ წუთს და მოითხოვეთ ახალი კოდი. თუ არ მოვიდა, დაგვირეკეთ *7070-ზე.',
    source: 'weak_retrieval',
    mtiebiOnly: true,
  },
  {
    cluster: 'საჩივრის სტატუსი',
    title: 'საჩივრის სტატუსის შემოწმება',
    title_en: 'Checking the status of a complaint',
    content:
      'საჩივრის განხილვის შედეგს 10 სამუშაო დღეში მიიღებთ. სტატუსის გასაგებად დაგვიკავშირდით ცხელ ხაზზე *7070 და დაასახელეთ საჩივრის ნომერი ან პირადი ნომერი.',
    rationale: 'კლიენტები ხშირად ეკითხებიან საჩივრის სტატუსს; პასუხი ამჟამად დოკუმენტებში ცალკე აღწერილი არ არის.',
    rationale_en: 'Customers often ask about the status of a complaint; the answer is not written down on its own in the documents today.',
    tags: ['საჩივრები'],
    signal: 'S4',
    priority: 'medium',
    risk: 'low',
    question: 'ორი კვირის წინ საჩივარი დავწერე, როდის მექნება პასუხი?',
    answer: 'საჩივარს 10 სამუშაო დღეში განვიხილავთ. სტატუსი ცხელ ხაზზე შეგიძლიათ გაიგოთ.',
    source: 'factcheck_not_in_kb',
    mtiebiOnly: true,
  },
  {
    cluster: 'ოპერატორთან გადართვა',
    title: 'ოპერატორთან გადართვა',
    title_en: 'Switching to a human operator',
    content:
      'თუ ჩატბოტი ვერ გპასუხობთ, მოითხოვეთ ოპერატორთან გადართვა ჩატში ან დაგვიკავშირდით კომპანიის ცხელ ხაზზე. ოპერატორი საუბრის ისტორიას დაინახავს, ამიტომ კითხვის თავიდან განმეორება არ მოგიწევთ.',
    rationale: 'ბოტის უარის პასუხების ნაწილში კლიენტი ოპერატორს ითხოვდა, მაგრამ ცოდნის ბაზაში ამის შესახებ პასუხი არ არის.',
    rationale_en: 'In part of the bot refusals the customer was asking for a human, and the knowledge base has no answer about it.',
    tags: ['ზოგადი'],
    signal: 'S6',
    priority: 'low',
    risk: 'low',
    question: 'მინდა ცოცხალ ადამიანს დაველაპარაკო',
    answer: 'ახლავე გადაგრთავთ ოპერატორთან.',
    source: 'bot_refusal',
  },
  {
    cluster: 'სამუშაო დღეები',
    title: 'რას ნიშნავს „სამუშაო დღე“ ვადების დათვლისას',
    title_en: 'What "business day" means when counting deadlines',
    content:
      'სამუშაო დღეებში არ ითვლება შაბათ-კვირა და სახელმწიფო დღესასწაულები. ვადა იწყება მომდევნო სამუშაო დღიდან.',
    rationale: 'ოპერატორები ვადების დათვლას ერთმანეთისგან განსხვავებულად განმარტავდნენ.',
    rationale_en: 'Operators explained how deadlines are counted in different ways.',
    tags: ['განმარტებები'],
    signal: 'S1',
    priority: 'low',
    risk: 'low',
    question: 'სამუშაო დღეში შაბათიც ითვლება?',
    answer: 'არა, სამუშაო დღეებში შაბათ-კვირა და დღესასწაულები არ შედის.',
    source: 'operator_rewrite',
  },
]

let runCounter = 0

api.register('POST', '/curation/run', () => {
  const clientId = tenantScope()
  requireWorkspaceEditor()
  const used = new Set(proposalsOf(clientId).map((p) => p.cluster))
  const isMtiebi = clientId === 'tn_mtiebi'
  const pool = TEMPLATES.filter((t) => (isMtiebi || !t.mtiebiOnly) && !used.has(t.cluster) && !used.has(t.title))
  const batch = pool.slice(0, (runCounter % 2) + 1)
  runCounter += 1
  const epoch = demoEpoch()
  setTimeout(() => {
    if (epoch !== demoEpoch()) return
    batch.forEach((t, i) => {
      const at = new Date(Date.now() - (i + 1) * 3_600_000).toISOString()
      store.data.curationProposals.push({
        id: store.nextId('cur_'),
        client_id: clientId,
        op: 'add',
        state: 'pending',
        signal: t.signal,
        cluster: t.cluster,
        title: t.title,
        title_en: t.title_en,
        proposed_content: t.content,
        rationale: t.rationale,
        rationale_en: t.rationale_en,
        target: null,
        suggested_tags: t.tags,
        occurrences: 3 + i,
        distinct_sources: 2 + i,
        confidence: 0.78 - i * 0.05,
        priority: t.priority,
        risk: t.risk,
        apply_error: null,
        decline_reason: null,
        evidence: [
          { channel: 'web', locale: 'ka', occurred_at: at, source_kind: t.source, question: t.question, answer: t.answer },
          { channel: 'whatsapp', locale: 'ka', occurred_at: new Date(Date.now() - (i + 5) * 3_600_000).toISOString(), source_kind: t.source, question: t.question, answer: t.answer },
        ],
        created_at: now(),
        decided_at: null,
        decided_by: null,
      })
    })
    logUsage({
      feature: 'curation',
      group: 'kb',
      capability: 'llm',
      client_id: clientId,
      input_tokens: 4200 + batch.length * 380,
      output_tokens: 260 * batch.length,
      latency_ms: 1900,
    })
    emitCuration(clientId)
  }, 2000)
  return { queued: true, added: batch.length }
})
