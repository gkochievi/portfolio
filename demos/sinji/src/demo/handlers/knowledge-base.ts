/**
 * Mock handlers for the `knowledge-base` group: documents, tags, stats, the three
 * import modes, bulk actions and the chunk inspector. Ingestion is simulated:
 * a document is inserted as pending -> processing, then turns ready after 2-4 s
 * (about 6 s with "AI restructure"), or error when the file name says 'broken'.
 * OWNED BY: knowledge-base.
 */
import { DemoApiError, notFound } from '@portfolio/demo-kit'

import { KB_DOC_TYPES, KB_FILE_EXTENSIONS, type KbBulkInput, type KbDocumentPatch, type KbDocumentRow, type KbImportResult } from '@/features/knowledge-base/types'
import type { ContentLang, Id, KbChunk, KbDocType, KbDocument, KbEvent, KbEventAction, KbStats } from '@/types'
import { api, bus, store } from '../core'
import { actorName, requireWorkspaceEditor, tenantScope } from '../guards'
import { checksum, chunkText, estimateTokens, hashString } from '../lib/text'
import { logUsage } from '../lib/usage-log'
import { demoEpoch } from '../store'

/* ------------------------------------------------------------- helpers */

const nowIso = (): string => new Date().toISOString()

const docsOf = (tenantId: Id): KbDocument[] => store.data.kbDocuments.filter((d) => d.client_id === tenantId)

function findDoc(id: string, tenantId: Id): KbDocument {
  const doc = store.data.kbDocuments.find((d) => d.id === id && d.client_id === tenantId)
  if (!doc) throw notFound('Document not found.')
  return doc
}

function findChunk(id: string, tenantId: Id): KbChunk {
  const chunk = store.data.kbChunks.find((c) => c.id === id && c.client_id === tenantId)
  if (!chunk) throw notFound('Chunk not found.')
  return chunk
}

function toRow(doc: KbDocument): KbDocumentRow {
  const { content_text: _content, ...row } = doc
  return row
}

function recount(tenantId: Id): void {
  const tenant = store.data.tenants.find((t) => t.id === tenantId)
  if (tenant) tenant.documents = docsOf(tenantId).length
}

function changed(tenantId: Id): void {
  recount(tenantId)
  store.notify()
  bus.emit('kb:changed', { client_id: tenantId })
}

function logEvent(
  tenantId: Id,
  event: { action: KbEventAction; detail: string; doc?: KbDocument | null; method?: string | null; status?: 'ok' | 'error'; chunks?: number | null; ms?: number | null; actor?: string },
): void {
  const row: KbEvent = {
    id: store.nextId('kbe_'),
    client_id: tenantId,
    document_id: event.doc?.id ?? null,
    document_title: event.doc?.title ?? null,
    action: event.action,
    method: event.method ?? null,
    status: event.status ?? 'ok',
    detail: event.detail,
    actor: event.actor ?? actorName(),
    chunk_count: event.chunks ?? null,
    duration_ms: event.ms ?? null,
    created_at: nowIso(),
  }
  store.data.kbEvents.unshift(row)
}

const isBroken = (name: string | null | undefined): boolean => /broken/i.test(name ?? '')

function cleanTags(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    const tag = String(raw).trim().replace(/\s+/g, ' ')
    if (!tag || tag.length > 40 || seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    out.push(tag)
    if (out.length >= 20) break
  }
  return out
}

function cleanMetadata(input: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!input || typeof input !== 'object') return out
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const k = key.trim()
    if (k) out[k] = String(value ?? '').trim()
  }
  return out
}

function assertDocType(value: unknown): KbDocType {
  if (!KB_DOC_TYPES.includes(value as KbDocType)) throw DemoApiError.validation({ doc_type: 'Choose a valid document type.' })
  return value as KbDocType
}

const tenantLang = (tenantId: Id): ContentLang => store.data.tenants.find((t) => t.id === tenantId)?.settings.default_language ?? 'en'

/* ------------------------------------------------------ text templates */

/** "Loan_Terms-2026.pdf" -> "Loan Terms 2026". */
function titleFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Binary formats cannot be parsed in a browser demo: give them believable templated content. */
function templatedContent(filename: string, lang: ContentLang): string {
  const name = titleFromFilename(filename) || filename
  if (lang === 'ka') {
    return [
      `დოკუმენტი „${name}“ ატვირთულია ფაილიდან ${filename}. ქვემოთ მოცემულია ამოღებული ტექსტის მოკლე სტრუქტურა, რომელიც ბოტსა და შემფასებელს ეხმარება პასუხების დასაბუთებაში.`,
      `ზოგადი მიმოხილვა. ${name} აღწერს სერვისის პირობებს, ვადებს და მომხმარებლისთვის სავალდებულო ნაბიჯებს. ყოველი პუნქტი დაწერილია ისე, რომ ოპერატორმა მისი მოყოლა ზარის დროს უცვლელად შეძლოს.`,
      `პირობები და ვადები. მოთხოვნის განხილვა სრულდება 1-3 სამუშაო დღეში. თუ დამატებითი დოკუმენტი არის საჭირო, მომხმარებელს ეცნობება SMS-ით ან ცხელი ხაზიდან დაბრუნებული ზარით. გადაწყვეტილების შესახებ შეტყობინება იგზავნება იმავე არხით, რომლითაც მოთხოვნა შემოვიდა.`,
      `საკომისიოები და გამონაკლისები. საფასურები მითითებულია მოქმედ ტარიფებში; გამონაკლისები ვრცელდება მხოლოდ წერილობით დადასტურებულ შემთხვევებზე. სადავო საკითხი გადაეცემა უფროს სპეციალისტს და მისი პასუხი ფიქსირდება მომხმარებლის ისტორიაში.`,
      `დამატებითი ინფორმაცია. კითხვების შემთხვევაში ოპერატორმა უნდა გამოიყენოს ცხელი ხაზის სკრიპტი და მიუთითოს დოკუმენტის სახელწოდება, რათა პასუხი შემოწმებადი იყოს ცოდნის ბაზაში.`,
    ].join('\n\n')
  }
  return [
    `Document "${name}" was imported from ${filename}. The extracted text is summarised below so the bot and the reviewers can ground their answers in it.`,
    `Overview. ${name} sets out the terms of the service, the time limits and the steps a customer has to take. Each point is written so that an agent can read it back on a call without changing the meaning.`,
    `Terms and timing. A request is reviewed within 1-3 business days. If an extra document is needed, the customer is told by SMS or by a call back from the hotline. The decision is sent through the same channel the request came in on.`,
    `Fees and exceptions. Fees follow the current tariff table; exceptions apply only to cases confirmed in writing. A disputed case goes to a senior specialist and the answer is recorded in the customer history.`,
    `Further information. When in doubt the agent uses the hotline script and quotes the document name, so that the answer can be checked against the knowledge base.`,
  ].join('\n\n')
}

const firstWords = (text: string, max = 60): string => {
  const clean = text.replace(/\s+/g, ' ').trim()
  const stop = clean.search(/[.!?:]\s/)
  const head = stop > 12 && stop <= max ? clean.slice(0, stop) : clean.slice(0, max)
  return head.length < clean.length && stop <= 12 ? `${head.trim()}…` : head.trim()
}

/** "AI restructure": title heading, then a heading and bullet list per paragraph. */
function restructure(title: string, text: string): string {
  const out: string[] = [`# ${title}`]
  for (const paragraph of text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) {
    const sentences = paragraph.split(/(?<=[.!?])\s+|;\s+/).map((s) => s.trim()).filter(Boolean)
    out.push(`## ${firstWords(sentences[0] ?? paragraph)}`)
    out.push((sentences.length > 1 ? sentences : [paragraph]).map((s) => `- ${s}`).join('\n'))
  }
  return out.join('\n\n')
}

/* --------------------------------------------------------------- chunks */

function writeChunks(doc: KbDocument, texts: string[], embedded: boolean): void {
  store.data.kbChunks = store.data.kbChunks.filter((c) => c.document_id !== doc.id)
  texts.forEach((content, index) => {
    store.data.kbChunks.push({
      id: store.nextId('chk_'),
      client_id: doc.client_id,
      document_id: doc.id,
      chunk_index: index,
      content,
      token_count: estimateTokens(content),
      has_embedding: embedded,
      metadata: { ...doc.metadata },
    })
  })
  doc.chunk_count = texts.length
}

const chunksOf = (docId: string): KbChunk[] => store.data.kbChunks.filter((c) => c.document_id === docId).sort((a, b) => a.chunk_index - b.chunk_index)

/** Keep the document body in step with chunk edits and deletions. */
function syncDocFromChunks(doc: KbDocument): void {
  const chunks = chunksOf(doc.id)
  doc.content_text = chunks.map((c) => c.content).join('\n\n')
  doc.char_count = doc.content_text.length
  doc.chunk_count = chunks.length
  doc.checksum = checksum(doc.content_text)
  doc.updated_at = nowIso()
}

/* ------------------------------------------------------ ingest simulator */

type IngestKind = 'import' | 'edit' | 'reembed'

interface IngestOptions {
  kind: IngestKind
  /** Re-chunk the body (import, edit); a plain re-embed keeps the chunks. */
  rechunk: boolean
  restructure?: boolean
  detail: string
  method?: string | null
  actor: string
}

function startIngest(doc: KbDocument, opts: IngestOptions): void {
  const epoch = demoEpoch()
  const tenantId = doc.client_id
  const id = doc.id
  const started = Date.now()
  const base = 2000 + (hashString(doc.title + doc.char_count) % 2000)
  const delay = opts.restructure ? 6000 : base

  doc.status = 'pending'
  doc.error = null
  if (opts.restructure) doc.restructure = 'running'

  setTimeout(() => {
    if (epoch !== demoEpoch()) return
    const d = store.data.kbDocuments.find((x) => x.id === id)
    if (d && d.status === 'pending') {
      d.status = 'processing'
      changed(tenantId)
    }
  }, 600)

  setTimeout(() => {
    if (epoch !== demoEpoch()) return
    const d = store.data.kbDocuments.find((x) => x.id === id)
    if (!d) return
    const ms = Math.max(delay, Date.now() - started)

    if (isBroken(d.filename) || isBroken(d.title)) {
      d.status = 'error'
      d.error = 'Embedding failed: the extracted text could not be processed.'
      if (opts.restructure) d.restructure = 'none'
      d.updated_at = nowIso()
      logEvent(tenantId, { action: opts.kind === 'import' ? 'import' : opts.kind, doc: d, method: opts.method ?? null, status: 'error', detail: d.error, chunks: 0, ms, actor: opts.actor })
      changed(tenantId)
      return
    }

    if (opts.restructure) {
      const before = d.content_text
      d.content_text = restructure(d.title, before)
      d.restructure = 'done'
      logUsage({
        feature: 'kb_restructure',
        group: 'kb',
        capability: 'llm',
        client_id: tenantId,
        actor: opts.actor,
        input_tokens: estimateTokens(before) + 220,
        output_tokens: estimateTokens(d.content_text),
        latency_ms: ms,
        job_id: d.id,
      })
    }

    if (opts.rechunk || chunksOf(d.id).length === 0) writeChunks(d, chunkText(d.content_text, 400), true)
    else for (const chunk of chunksOf(d.id)) chunk.has_embedding = true

    d.char_count = d.content_text.length
    d.checksum = checksum(d.content_text)
    d.status = 'ready'
    d.error = null
    d.ingest_ms = ms
    d.updated_at = nowIso()

    const chunks = chunksOf(d.id)
    logUsage({
      feature: 'embed',
      group: 'kb',
      capability: 'embed',
      client_id: tenantId,
      actor: opts.actor,
      input_tokens: chunks.reduce((sum, c) => sum + c.token_count, 0),
      latency_ms: ms,
      job_id: d.id,
    })
    logEvent(tenantId, { action: opts.kind, doc: d, method: opts.method ?? null, detail: opts.detail, chunks: chunks.length, ms, actor: opts.actor })
    changed(tenantId)
  }, delay)
}

function newDocument(tenantId: Id, input: Partial<KbDocument> & Pick<KbDocument, 'title' | 'doc_type' | 'content_text' | 'source_type'>): KbDocument {
  const stamp = nowIso()
  const doc: KbDocument = {
    id: store.nextId('doc_'),
    client_id: tenantId,
    tags: [],
    char_count: input.content_text.length,
    chunk_count: 0,
    status: 'pending',
    error: null,
    filename: null,
    visibility: 'internal',
    checksum: checksum(input.content_text),
    actor: actorName(),
    ingest_ms: null,
    metadata: {},
    restructure: 'none',
    created_at: stamp,
    updated_at: stamp,
    ...input,
  }
  store.data.kbDocuments.unshift(doc)
  return doc
}

/* ---------------------------------------------------------------- reads */

api.register('GET', '/kb/stats', () => {
  const tenantId = tenantScope()
  const docs = docsOf(tenantId)
  const ids = new Set(docs.map((d) => d.id))
  const chunks = store.data.kbChunks.filter((c) => ids.has(c.document_id))
  const embedded = chunks.filter((c) => c.has_embedding).length
  const by_type = Object.fromEntries(KB_DOC_TYPES.map((t) => [t, 0])) as Record<KbDocType, number>
  for (const doc of docs) by_type[doc.doc_type] += 1
  const stats: KbStats & { by_type: Record<KbDocType, number> } = {
    documents: docs.length,
    public_documents: docs.filter((d) => d.visibility === 'public').length,
    chunks: chunks.length,
    // Percent, 0-100 (one decimal).
    embedding_coverage: chunks.length ? Math.round((embedded / chunks.length) * 1000) / 10 : 0,
    failed: docs.filter((d) => d.status === 'error').length,
    in_progress: docs.filter((d) => d.status === 'pending' || d.status === 'processing').length,
    approx_tokens: chunks.reduce((sum, c) => sum + c.token_count, 0),
    last_updated: docs.map((d) => d.updated_at).sort().at(-1) ?? null,
    by_type,
  }
  return stats
})

api.register('GET', '/kb/tags', () => {
  const tenantId = tenantScope()
  const tags = new Set<string>()
  for (const doc of docsOf(tenantId)) for (const tag of doc.tags) tags.add(tag)
  return [...tags].sort((a, b) => a.localeCompare(b))
})

api.register('GET', '/kb/documents', ({ params }) => {
  const tenantId = tenantScope()
  const q = (params.q ?? '').trim().toLowerCase()
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const page_size = Math.min(100, Math.max(1, Number.parseInt(params.page_size ?? '20', 10) || 20))

  const rows = docsOf(tenantId)
    .filter((d) => {
      if (params.status) {
        if (params.status === 'in_progress') {
          if (d.status !== 'pending' && d.status !== 'processing') return false
        } else if (d.status !== params.status) return false
      }
      if (params.doc_type && d.doc_type !== params.doc_type) return false
      if (params.tag && !d.tags.includes(params.tag)) return false
      if (params.visibility && d.visibility !== params.visibility) return false
      if (q) {
        const hay = [d.title, d.title_en ?? '', d.filename ?? '', d.tags.join(' '), d.content_text].join('\n').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  return {
    items: rows.slice((page - 1) * page_size, page * page_size).map(toRow),
    total: rows.length,
    page,
    page_size,
  }
})

api.register('GET', '/kb/documents/:id', ({ path }) => findDoc(path.id ?? '', tenantScope()))

api.register('GET', '/kb/documents/:id/chunks', ({ path }) => {
  const doc = findDoc(path.id ?? '', tenantScope())
  return chunksOf(doc.id)
})

/* --------------------------------------------------------------- writes */

api.register('PATCH', '/kb/documents/:id', ({ path, body }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const doc = findDoc(path.id ?? '', tenantId)
  const input = (body ?? {}) as KbDocumentPatch
  const errors: Record<string, string> = {}

  if (input.title !== undefined && !input.title.trim()) errors.title = 'Title is required.'
  if (input.content_text !== undefined && !input.content_text.trim()) errors.content_text = 'Content cannot be empty.'
  if (input.doc_type !== undefined && !KB_DOC_TYPES.includes(input.doc_type)) errors.doc_type = 'Choose a valid document type.'
  if (input.visibility !== undefined && input.visibility !== 'public' && input.visibility !== 'internal') errors.visibility = 'Visibility must be public or internal.'
  if (input.metadata && Object.keys(input.metadata).some((k) => !k.trim())) errors.metadata = 'Metadata keys cannot be empty.'
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
  if (doc.status === 'pending' || doc.status === 'processing') {
    if (input.content_text !== undefined) throw new DemoApiError(409, 'This document is still being processed. Try again in a few seconds.')
  }

  const notes: string[] = []
  if (input.title !== undefined && input.title.trim() !== doc.title) {
    doc.title = input.title.trim()
    delete doc.title_en
    notes.push('title')
  }
  if (input.doc_type !== undefined && input.doc_type !== doc.doc_type) {
    doc.doc_type = input.doc_type
    notes.push('type')
  }
  if (input.tags !== undefined) {
    const next = cleanTags(input.tags)
    if (next.join('\u0000') !== doc.tags.join('\u0000')) {
      doc.tags = next
      notes.push('tags')
    }
  }
  if (input.metadata !== undefined) {
    const next = cleanMetadata(input.metadata)
    if (JSON.stringify(next) !== JSON.stringify(doc.metadata)) {
      doc.metadata = next
      for (const chunk of chunksOf(doc.id)) chunk.metadata = { ...next }
      notes.push('metadata')
    }
  }
  if (input.visibility !== undefined && input.visibility !== doc.visibility) {
    doc.visibility = input.visibility
    notes.push(input.visibility === 'public' ? 'published (the bot may quote it)' : 'set to internal')
  }

  const contentChanged = input.content_text !== undefined && input.content_text.trim() !== doc.content_text.trim()
  if (contentChanged) {
    doc.content_text = (input.content_text ?? '').trim()
    doc.char_count = doc.content_text.length
    doc.checksum = checksum(doc.content_text)
    doc.restructure = 'none'
    notes.push('content')
  }
  doc.updated_at = nowIso()

  if (contentChanged) {
    startIngest(doc, { kind: 'edit', rechunk: true, detail: `Content updated, re-chunked (${notes.join(', ')})`, method: 'ui', actor: actorName() })
  } else if (notes.length) {
    logEvent(tenantId, { action: 'edit', doc, method: 'ui', detail: `Updated ${notes.join(', ')}`, chunks: doc.chunk_count, ms: 60 })
  }
  changed(tenantId)
  return toRow(doc)
})

api.register('DELETE', '/kb/documents/:id', ({ path }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const doc = findDoc(path.id ?? '', tenantId)
  store.data.kbDocuments = store.data.kbDocuments.filter((d) => d.id !== doc.id)
  store.data.kbChunks = store.data.kbChunks.filter((c) => c.document_id !== doc.id)
  logEvent(tenantId, { action: 'delete', doc, method: 'ui', detail: `Deleted document and ${doc.chunk_count} chunks`, chunks: doc.chunk_count, ms: 40 })
  changed(tenantId)
  return { ok: true }
})

api.register('POST', '/kb/documents/:id/reembed', ({ path }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const doc = findDoc(path.id ?? '', tenantId)
  if (doc.status === 'pending' || doc.status === 'processing') throw new DemoApiError(409, 'This document is already being processed.')
  for (const chunk of chunksOf(doc.id)) chunk.has_embedding = false
  startIngest(doc, { kind: 'reembed', rechunk: false, detail: 'Re-embedded all chunks', method: 'ui', actor: actorName() })
  changed(tenantId)
  return toRow(doc)
})

api.register('POST', '/kb/documents/bulk', ({ body }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const input = (body ?? {}) as KbBulkInput
  const ids = Array.isArray(input.ids) ? input.ids : []
  if (ids.length === 0) throw DemoApiError.validation({ ids: 'Select at least one document.' })
  if (!['publish', 'unpublish', 'reembed', 'retag', 'delete'].includes(input.action)) throw DemoApiError.validation({ action: 'Unknown bulk action.' })
  const tags = cleanTags(input.tags)
  if (input.action === 'retag' && tags.length === 0) throw DemoApiError.validation({ tags: 'Add at least one tag.' })

  const docs = ids.map((id) => docsOf(tenantId).find((d) => d.id === id)).filter((d): d is KbDocument => Boolean(d))
  let affected = 0
  for (const doc of docs) {
    switch (input.action) {
      case 'publish':
      case 'unpublish':
        doc.visibility = input.action === 'publish' ? 'public' : 'internal'
        doc.updated_at = nowIso()
        affected += 1
        break
      case 'retag':
        doc.tags = input.mode === 'add' ? cleanTags([...doc.tags, ...tags]) : tags
        doc.updated_at = nowIso()
        affected += 1
        break
      case 'reembed':
        if (doc.status === 'pending' || doc.status === 'processing') break
        for (const chunk of chunksOf(doc.id)) chunk.has_embedding = false
        startIngest(doc, { kind: 'reembed', rechunk: false, detail: 'Re-embedded all chunks (bulk)', method: 'bulk', actor: actorName() })
        affected += 1
        break
      case 'delete':
        store.data.kbDocuments = store.data.kbDocuments.filter((d) => d.id !== doc.id)
        store.data.kbChunks = store.data.kbChunks.filter((c) => c.document_id !== doc.id)
        affected += 1
        break
    }
  }
  const verb = { publish: 'Published', unpublish: 'Set to internal', reembed: 'Re-embedded', retag: 'Retagged', delete: 'Deleted' }[input.action]
  logEvent(tenantId, { action: 'bulk', method: 'bulk', detail: `${verb} ${affected} document${affected === 1 ? '' : 's'}`, ms: 90 + affected * 12 })
  changed(tenantId)
  return { affected }
})

/* --------------------------------------------------------------- import */

interface ImportBase {
  doc_type?: KbDocType
  title?: string
  tags?: string[]
  metadata?: Record<string, string>
  restructure?: boolean
}

function importCommon(input: ImportBase) {
  return {
    doc_type: assertDocType(input.doc_type ?? 'other'),
    tags: cleanTags(input.tags),
    metadata: cleanMetadata(input.metadata),
    restructure: Boolean(input.restructure),
  }
}

const fileExt = (name: string): string => (name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : '')

api.register('POST', '/kb/import/files', ({ body }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const input = (body ?? {}) as ImportBase & { files?: { name: string; size: number; text?: string }[] }
  const common = importCommon(input)
  const files = Array.isArray(input.files) ? input.files : []
  if (files.length === 0) throw DemoApiError.validation({ files: 'Choose at least one file.' })
  const unsupported = files.find((f) => !(KB_FILE_EXTENSIONS as readonly string[]).includes(fileExt(f.name)))
  if (unsupported) throw DemoApiError.validation({ files: `${unsupported.name}: unsupported file type.` })

  const lang = tenantLang(tenantId)
  const result: KbImportResult = { documents: [], failed: [] }
  for (const file of files) {
    const text = file.text?.trim() ? file.text.trim() : templatedContent(file.name, lang)
    const title = (files.length === 1 && input.title?.trim()) || titleFromFilename(file.name) || file.name
    const doc = newDocument(tenantId, {
      title,
      doc_type: common.doc_type,
      content_text: text,
      source_type: 'file',
      filename: file.name,
      tags: common.tags,
      metadata: common.metadata,
    })
    if (isBroken(file.name)) {
      doc.status = 'error'
      doc.error = 'Text extraction failed: the file could not be read.'
      logEvent(tenantId, { action: 'import', doc, method: 'file', status: 'error', detail: doc.error, chunks: 0, ms: 420 })
      result.failed.push({ name: file.name, error: doc.error })
    } else {
      startIngest(doc, { kind: 'import', rechunk: true, restructure: common.restructure, detail: `Imported ${file.name}`, method: 'file', actor: actorName() })
    }
    result.documents.push(toRow(doc))
  }
  changed(tenantId)
  return result
})

api.register('POST', '/kb/import/text', ({ body }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const input = (body ?? {}) as ImportBase & { text?: string }
  const common = importCommon(input)
  const errors: Record<string, string> = {}
  if (!input.title?.trim()) errors.title = 'Title is required.'
  if (!input.text?.trim()) errors.text = 'Paste some text to import.'
  else if (input.text.trim().length < 20) errors.text = 'The text is too short to index.'
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)

  const doc = newDocument(tenantId, {
    title: (input.title ?? '').trim(),
    doc_type: common.doc_type,
    content_text: (input.text ?? '').trim(),
    source_type: 'paste',
    tags: common.tags,
    metadata: common.metadata,
  })
  startIngest(doc, { kind: 'import', rechunk: true, restructure: common.restructure, detail: 'Imported pasted text', method: 'paste', actor: actorName() })
  changed(tenantId)
  return { documents: [toRow(doc)], failed: [] } satisfies KbImportResult
})

api.register('POST', '/kb/import/csv', ({ body }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const input = (body ?? {}) as ImportBase & { filename?: string; rows?: { question: string; answer: string }[] }
  const common = importCommon({ ...input, doc_type: input.doc_type ?? 'faq' })
  const rows = (Array.isArray(input.rows) ? input.rows : [])
    .map((r) => ({ question: String(r.question ?? '').trim(), answer: String(r.answer ?? '').trim() }))
    .filter((r) => r.question && r.answer)
  if (rows.length === 0) throw DemoApiError.validation({ rows: 'The CSV has no complete question and answer rows.' })

  const filename = input.filename?.trim() || 'qa.csv'
  const lang = tenantLang(tenantId)
  const content = rows.map((r) => `${lang === 'ka' ? 'კითხვა' : 'Q'}: ${r.question}\n${lang === 'ka' ? 'პასუხი' : 'A'}: ${r.answer}`).join('\n\n')
  const doc = newDocument(tenantId, {
    title: input.title?.trim() || titleFromFilename(filename) || 'Q&A',
    doc_type: common.doc_type,
    content_text: content,
    source_type: 'csv',
    filename,
    tags: common.tags,
    metadata: common.metadata,
  })
  if (isBroken(filename)) {
    doc.status = 'error'
    doc.error = 'The CSV could not be processed.'
    logEvent(tenantId, { action: 'import', doc, method: 'csv', status: 'error', detail: doc.error, chunks: 0, ms: 300 })
    changed(tenantId)
    return { documents: [toRow(doc)], failed: [{ name: filename, error: doc.error }] } satisfies KbImportResult
  }
  startIngest(doc, { kind: 'import', rechunk: true, restructure: common.restructure, detail: `CSV imported: ${rows.length} rows`, method: 'csv', actor: actorName() })
  changed(tenantId)
  return { documents: [toRow(doc)], failed: [] } satisfies KbImportResult
})

/* --------------------------------------------------------------- chunks */

api.register('PATCH', '/kb/chunks/:id', ({ path, body }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const chunk = findChunk(path.id ?? '', tenantId)
  const content = String(((body ?? {}) as { content?: string }).content ?? '').trim()
  if (!content) throw DemoApiError.validation({ content: 'A chunk cannot be empty.' })
  const doc = store.data.kbDocuments.find((d) => d.id === chunk.document_id)

  chunk.content = content
  chunk.token_count = estimateTokens(content)
  chunk.has_embedding = false
  if (doc) {
    syncDocFromChunks(doc)
    logEvent(tenantId, { action: 'chunk_edit', doc, method: 'ui', detail: `Edited chunk ${chunk.chunk_index + 1}`, chunks: 1, ms: 70 })
  }
  changed(tenantId)

  // The edited chunk is re-embedded in the background.
  const epoch = demoEpoch()
  const chunkId = chunk.id
  setTimeout(() => {
    if (epoch !== demoEpoch()) return
    const current = store.data.kbChunks.find((c) => c.id === chunkId)
    if (!current) return
    current.has_embedding = true
    if (doc) {
      logUsage({ feature: 'embed', group: 'kb', capability: 'embed', client_id: tenantId, input_tokens: current.token_count, job_id: doc.id })
    }
    changed(tenantId)
  }, 1200)
  return chunk
})

api.register('DELETE', '/kb/chunks/:id', ({ path }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const chunk = findChunk(path.id ?? '', tenantId)
  const doc = store.data.kbDocuments.find((d) => d.id === chunk.document_id)
  store.data.kbChunks = store.data.kbChunks.filter((c) => c.id !== chunk.id)
  if (doc) {
    chunksOf(doc.id).forEach((c, i) => {
      c.chunk_index = i
    })
    syncDocFromChunks(doc)
    logEvent(tenantId, { action: 'chunk_delete', doc, method: 'ui', detail: `Deleted chunk ${chunk.chunk_index + 1}`, chunks: 1, ms: 40 })
  }
  changed(tenantId)
  return { ok: true }
})
