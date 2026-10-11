/**
 * Operator-tools endpoints (owner: operator-tools): customer context, internal
 * notes, quick replies, the WhatsApp template catalogue + sending, Copilot
 * drafts / feedback and the operator's chat history.
 */
import { DemoApiError, conflict, forbidden, notFound } from '@portfolio/demo-kit'

import type { ChatNote, ChatSession, ContentLang, CopilotTransform, LocalizedText, QuickReplyCategory, TemplatePreview, WhatsAppTemplate } from '@/types'
import type { ContextResponse, CopilotResponse, HistoryResponse, QuickReplyView, TemplatesResponse } from '@/features/operator-tools/types'

import { api } from '../api'
import { nowIso } from '../clock'
import { broadcast } from '../bus'
import { currentOperator, currentTenantId, findSession, requireRole, tenantSettings } from '../context'
import { logActivity, postMessage, toSummaries } from '../engine'
import { latestDraft, regenerateDraft, startDraft, transformDraft } from '../simulators/operator-tools'
import { newId, store } from '../store'

const PAGE_SIZE = 20
const MAX_NOTE = 1000
const CATEGORY_ORDER: QuickReplyCategory[] = ['greetings', 'delivery', 'payment', 'closing']
const TRANSFORMS: CopilotTransform[] = ['shorter', 'warmer', 'formal', 'to_ru', 'to_ka', 'to_en']

/** Throw a 400 whose `code` field carries a machine-readable error code. */
function coded(status: number, code: string, message: string, extra: Record<string, string> = {}): DemoApiError {
  return new DemoApiError(status, message, { code, ...extra })
}

/** A chat the signed-in operator holds (403 otherwise). */
function ownSession(sessionId: string): ChatSession {
  const operator = currentOperator()
  const session = findSession(sessionId)
  if (session.operatorId !== operator.id) throw forbidden('This chat is assigned to someone else.')
  return session
}

const compact = (value: string) => value.replace(/\s+/g, '').toLowerCase()

/* ------------------------------------------------------------------ context */

api.register('GET', '/sessions/:id/context', ({ path }): ContextResponse => {
  requireRole('operator', 'admin', 'supervisor')
  const tenantId = currentTenantId()
  const session = findSession(path.id as string)
  const settings = tenantSettings(tenantId)
  const customer = store.data.customers.find((row) => row.id === session.customerId)
  if (!customer) throw notFound('Customer not found.')

  const groupField = store.data.customFields.find((field) => field.tenantId === tenantId && field.groupBy && field.enabled)
  const own = groupField ? session.customFields.find((field) => field.fieldId === groupField.id) : undefined
  const groupBy = groupField && own?.value ? { fieldId: groupField.id, label: groupField.label, value: own.value } : null
  const previous = groupBy
    ? store.data.sessions
        .filter(
          (row) =>
            row.tenantId === tenantId &&
            row.id !== session.id &&
            row.customFields.some((field) => field.fieldId === groupBy.fieldId && compact(field.value) === compact(groupBy.value)),
        )
        .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
        .slice(0, 12)
    : []

  return {
    customer,
    fields: session.customFields,
    clientIp: settings.clientIpEnabled ? session.clientIp : null,
    faqPath: session.faqPath,
    externalContact: customer.externalContact,
    lastInboundAt: session.lastInboundAt,
    groupBy,
    previousChats: toSummaries(previous),
    notesEnabled: settings.messageNotesEnabled,
    clientIpEnabled: settings.clientIpEnabled,
  }
})

/* -------------------------------------------------------------------- notes */

api.register('GET', '/sessions/:id/notes', ({ path }): ChatNote[] => {
  requireRole('operator', 'admin', 'supervisor')
  const session = findSession(path.id as string)
  if (!tenantSettings(session.tenantId).messageNotesEnabled) return []
  return store.data.notes
    .filter((note) => note.sessionId === session.id)
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
})

api.register('POST', '/sessions/:id/notes', ({ path, body }): ChatNote => {
  const account = requireRole('operator', 'admin')
  const session = findSession(path.id as string)
  if (!tenantSettings(session.tenantId).messageNotesEnabled) throw forbidden('Internal notes are switched off for this workspace.')
  const content = String((body as { content?: unknown } | null)?.content ?? '').trim()
  if (!content) throw DemoApiError.validation({ content: 'Write the note first.' })
  if (content.length > MAX_NOTE) throw DemoApiError.validation({ content: `Notes can be up to ${MAX_NOTE} characters.` })
  const authorName =
    account.role === 'admin'
      ? (store.data.admins.find((row) => row.id === account.staffId)?.name.en ?? account.name)
      : (store.data.operators.find((row) => row.id === account.staffId)?.name.en ?? account.name)
  const note: ChatNote = {
    id: newId('note_'),
    tenantId: session.tenantId,
    sessionId: session.id,
    authorRole: account.role === 'admin' ? 'admin' : 'operator',
    authorId: account.staffId,
    authorName,
    content,
    createdAt: nowIso(),
  }
  store.data.notes.push(note)
  broadcast('note:upsert', note)
  return note
})

api.register('DELETE', '/sessions/:id/notes/:noteId', ({ path }) => {
  const account = requireRole('operator', 'admin')
  const session = findSession(path.id as string)
  const note = store.data.notes.find((row) => row.id === path.noteId && row.sessionId === session.id)
  if (!note) throw notFound('Note not found.')
  if (account.role !== 'admin' && note.authorId !== account.staffId) throw forbidden('You can only delete your own notes.')
  store.data.notes = store.data.notes.filter((row) => row.id !== note.id)
  broadcast('note:deleted', { id: note.id, sessionId: session.id })
  return { ok: true }
})

/* ------------------------------------------------------------ quick replies */

function pickLocalized(text: LocalizedText, order: ContentLang[]): { value: string; lang: ContentLang } {
  for (const lang of order) {
    const value = text[lang]
    if (value && value.trim()) return { value, lang }
  }
  return { value: text.en || text.ka || '', lang: text.en ? 'en' : 'ka' }
}

api.register('GET', '/quick-replies', ({ params }): QuickReplyView[] => {
  const account = requireRole('operator', 'admin', 'supervisor')
  const tenantId = currentTenantId()
  const operatorLang: ContentLang = store.data.operators.find((row) => row.id === account.staffId)?.language ?? 'en'
  const session = params.sessionId ? store.data.sessions.find((row) => row.id === params.sessionId && row.tenantId === tenantId) : undefined
  const customerLang = session?.clientLanguage
  const query = (params.q ?? '').trim().toLowerCase()
  return store.data.quickReplies
    .filter((reply) => reply.tenantId === tenantId && reply.enabled)
    .map((reply): QuickReplyView => {
      const picked = pickLocalized(reply.content, customerLang ? [customerLang, operatorLang, 'en', 'ka'] : [operatorLang, 'en', 'ka'])
      return {
        id: reply.id,
        category: reply.category,
        title: pickLocalized(reply.title, [operatorLang, 'en', 'ka']).value,
        content: picked.value,
        lang: picked.lang,
        sortOrder: reply.sortOrder,
      }
    })
    .filter((reply) => !query || `${reply.title} ${reply.content}`.toLowerCase().includes(query))
    .sort((left, right) => CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category) || left.sortOrder - right.sortOrder)
})

/* ---------------------------------------------------------------- templates */

function catalogue(tenantId: string): TemplatesResponse {
  const templates = store.data.waTemplates.filter((row) => row.tenantId === tenantId)
  const latest = templates.reduce<string | null>((acc, row) => (!acc || Date.parse(row.syncedAt) > Date.parse(acc) ? row.syncedAt : acc), null)
  return { templates, syncedAt: latest }
}

api.register('GET', '/whatsapp/templates', (): TemplatesResponse => {
  requireRole('operator', 'admin')
  return catalogue(currentTenantId())
})

api.register('POST', '/whatsapp/templates/sync', async (): Promise<TemplatesResponse> => {
  requireRole('operator', 'admin')
  const tenantId = currentTenantId()
  await new Promise((resolve) => setTimeout(resolve, 600))
  const syncedAt = nowIso()
  for (const template of store.data.waTemplates) {
    if (template.tenantId !== tenantId) continue
    template.syncedAt = syncedAt
    // The channel finished reviewing the pending template since the last refresh.
    if (template.status === 'PENDING') {
      template.status = 'APPROVED'
      template.qualityScore = 'GREEN'
      template.sendable = true
      template.unsendableReasons = []
    }
  }
  return catalogue(tenantId)
})

function fillPreview(template: WhatsAppTemplate, values: Record<string, string>): TemplatePreview {
  const swap = (text: string, component: 'header' | 'body') =>
    text.replace(/\{\{(\d+)\}\}/g, (_, n: string) => values[`${component}_${n}`]?.trim() || `{{${n}}}`)
  const { header, body, footer, buttons } = template.preview
  return { header: header ? swap(header, 'header') : null, body: swap(body, 'body'), footer, buttons: [...buttons] }
}

api.register('POST', '/sessions/:id/template', ({ path, body }) => {
  const operator = currentOperator()
  const session = ownSession(path.id as string)
  if (session.status === 'ended') throw conflict('This chat has already ended.')
  if (session.adminInterventionActive) throw new DemoApiError(423, 'An admin is writing in this chat right now.')
  const input = (body ?? {}) as { templateId?: unknown; values?: Record<string, unknown> }
  if (session.channel !== 'whatsapp') throw coded(409, 'wrong_channel', 'Templates can only be sent on WhatsApp chats.')
  const template = store.data.waTemplates.find((row) => row.id === input.templateId && row.tenantId === session.tenantId)
  if (!template) throw notFound('Template not found.')
  if (!template.sendable || template.status !== 'APPROVED') {
    throw coded(409, 'template_unsendable', template.unsendableReasons[0] ?? 'This template cannot be sent right now.')
  }
  const values: Record<string, string> = {}
  for (const [key, value] of Object.entries(input.values ?? {})) values[key] = typeof value === 'string' ? value : String(value ?? '')
  const missing = template.slots.filter((slot) => !values[slot.key]?.trim())
  if (missing.length > 0) {
    throw coded(400, 'missing_values', 'Fill in every field of the template.', Object.fromEntries(missing.map((slot) => [`slot:${slot.key}`, 'Required'])))
  }
  const preview = fillPreview(template, values)
  const message = postMessage(session.id, {
    sender: 'operator',
    senderId: operator.id,
    senderName: operator.nickname,
    type: 'template',
    content: preview.body,
    template: { templateId: template.id, name: template.name, preview },
  })
  logActivity({
    action: 'operator_send_template',
    targetId: session.id,
    targetLabel: session.customerName,
    metadata: { template: template.name, channel: session.channel },
  })
  return message
})

/* ------------------------------------------------------------------ copilot */

function copilotResponse(sessionId: string): CopilotResponse {
  const until = store.data.demo.aiOutageUntil
  const outage = !!until && Date.parse(until) > Date.now()
  return { draft: latestDraft(sessionId) ?? null, outage, outageUntil: outage ? until : null }
}

api.register('GET', '/sessions/:id/copilot', ({ path }): CopilotResponse => {
  requireRole('operator', 'admin', 'supervisor')
  const session = findSession(path.id as string)
  return copilotResponse(session.id)
})

api.register('POST', '/sessions/:id/copilot/regenerate', ({ path }): CopilotResponse => {
  const session = ownSession(path.id as string)
  const draft = regenerateDraft(session.id)
  if (!draft) throw notFound('There is no customer message to answer yet.')
  return copilotResponse(session.id)
})

api.register('POST', '/sessions/:id/copilot/transform', ({ path, body }): CopilotResponse => {
  const session = ownSession(path.id as string)
  const transform = (body as { transform?: CopilotTransform } | null)?.transform
  if (!transform || !TRANSFORMS.includes(transform)) throw DemoApiError.validation({ transform: 'Unknown transform.' })
  const draft = transformDraft(session.id, transform)
  if (!draft) {
    // Nothing ready to transform: fall back to a fresh draft when one is missing.
    if (!latestDraft(session.id) && startDraft(session.id)) return copilotResponse(session.id)
    throw conflict('Wait for the current draft to finish first.')
  }
  return copilotResponse(session.id)
})

api.register('POST', '/copilot/feedback', ({ body }) => {
  requireRole('operator')
  const input = (body ?? {}) as { sessionId?: unknown; draftId?: unknown; action?: unknown; variantIndex?: unknown; finalText?: unknown }
  const session = findSession(String(input.sessionId ?? ''))
  const action = input.action
  if (action !== 'shown' && action !== 'inserted' && action !== 'edited_sent' && action !== 'sent_asis' && action !== 'ignored') {
    throw DemoApiError.validation({ action: 'Unknown feedback action.' })
  }
  store.data.copilotFeedback.push({
    id: newId('cpf_'),
    sessionId: session.id,
    draftId: String(input.draftId ?? ''),
    action,
    variantIndex: typeof input.variantIndex === 'number' ? input.variantIndex : null,
    finalText: typeof input.finalText === 'string' ? input.finalText : null,
    at: nowIso(),
  })
  return { ok: true }
})

/* ------------------------------------------------------------------ history */

api.register('GET', '/operator/history', ({ params }): HistoryResponse => {
  requireRole('operator', 'admin', 'supervisor')
  const tenantId = currentTenantId()
  const query = (params.q ?? '').trim().toLowerCase()
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const rows = store.data.sessions
    .filter((session) => session.tenantId === tenantId && session.status === 'ended')
    .filter((session) => {
      if (!query) return true
      const haystack = [session.customerName, session.customerNumber, session.endSummary ?? '', session.channel, ...session.customFields.map((field) => field.value)]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query) || compact(haystack).includes(compact(query))
    })
    .sort((left, right) => Date.parse(right.endedAt ?? right.lastActivity) - Date.parse(left.endedAt ?? left.lastActivity))
  const start = (page - 1) * PAGE_SIZE
  return { rows: toSummaries(rows.slice(start, start + PAGE_SIZE)), total: rows.length, page, pageSize: PAGE_SIZE }
})
