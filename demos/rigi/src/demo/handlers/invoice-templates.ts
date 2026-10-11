/**
 * Mock API handlers. Owner: invoice-templates.
 * Template CRUD, default-per-scope, the live preview and the rendered invoice
 * documents (staff and partner portal). Patterns are registered WITHOUT /api.
 */
import { DemoApiError, notFound, type MockApi } from '@portfolio/demo-kit'

import {
  DEFAULT_CSS,
  DEFAULT_LAYOUT,
  BLOCK_TYPES,
  renderDocument,
  type TemplateSource,
} from '@/features/invoice-templates/engine/document'
import { parseTemplate, TemplateSyntaxError } from '@/features/invoice-templates/engine/mustache'
import { buildInvoiceView, buildSampleView, type DocLang } from '@/features/invoice-templates/engine/view'
import { currentLang } from '@/lib/format'
import type { Invoice, InvoiceTemplate, TemplateBlock, TemplateMode } from '@/types'

import { emitChanged, nowIso, recordAudit, requirePartnerAdmin, requireStaff } from '../ctx'
import { newId } from '../domain/ids'
import { store } from '../runtime'

/* ---------------------------------------------------------------- limits */

const NAME_MAX = 200
const SOURCE_MAX = 200_000
const MAX_BLOCKS = 80
const IMAGE_MAX = 1_400_000
const SIGNATURE_MAX = 600_000
const ACCOUNTING = 'accountant' as const

/* --------------------------------------------------------------- helpers */

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function templates(): InvoiceTemplate[] {
  return store.data.invoiceTemplates
}

function mustFind(id: string): InvoiceTemplate {
  const found = templates().find((t) => t.id === id)
  if (!found) throw notFound()
  return found
}

function partnerName(partnerId: string | null): string | null {
  if (!partnerId) return null
  return store.data.partners.find((p) => p.id === partnerId)?.name ?? null
}

function row(t: InvoiceTemplate) {
  return {
    id: t.id,
    name: t.name,
    partnerId: t.partnerId,
    partnerName: partnerName(t.partnerId),
    mode: t.mode,
    isDefault: t.isDefault,
    hasSignature: Boolean(t.signatureDataUrl),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

function lang(body?: unknown): DocLang {
  const requested = body && typeof body === 'object' ? (body as { lang?: unknown }).lang : undefined
  return requested === 'ka' || requested === 'en' ? requested : currentLang()
}

function checkMustache(source: string, field: string, errors: Record<string, string>): void {
  try {
    parseTemplate(source)
  } catch (error) {
    if (error instanceof TemplateSyntaxError) errors[field] = error.message
    else throw error
  }
}

interface Parsed {
  mode: TemplateMode
  html: string
  css: string
  layout: TemplateBlock[]
  signatureDataUrl: string | null
}

/** Validate the editable body shared by create, patch and preview. */
function parseBody(raw: unknown, base?: Partial<Parsed>): Parsed {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const errors: Record<string, string> = {}

  const mode = (body.mode ?? base?.mode ?? 'blocks') as TemplateMode
  if (mode !== 'blocks' && mode !== 'html') errors.mode = 'Choose a valid layout source.'

  const html = body.html === undefined ? (base?.html ?? '') : str(body.html)
  const css = body.css === undefined ? (base?.css ?? '') : str(body.css)
  if (html.length > SOURCE_MAX) errors.html = 'HTML is too long (max 200 000 characters).'
  if (css.length > SOURCE_MAX) errors.css = 'CSS is too long (max 200 000 characters).'
  if (!errors.html) checkMustache(html, 'html', errors)

  let layout: TemplateBlock[] = base?.layout ?? []
  if (body.layout !== undefined) {
    if (!Array.isArray(body.layout)) {
      errors.layout = 'Layout must be a list of blocks.'
    } else if (body.layout.length > MAX_BLOCKS) {
      errors.layout = `A template can hold at most ${MAX_BLOCKS} blocks.`
    } else {
      layout = []
      for (const item of body.layout as unknown[]) {
        const block = item as Partial<TemplateBlock> | null
        if (!block || typeof block !== 'object' || !BLOCK_TYPES.includes(block.type as never)) {
          errors.layout = 'Unknown block type.'
          break
        }
        const props = (block.props && typeof block.props === 'object' ? block.props : {}) as TemplateBlock['props']
        if (typeof props.src === 'string' && props.src.length > IMAGE_MAX) {
          errors.layout = 'An image is too large (max 1 MB).'
          break
        }
        if (block.type === 'text') checkMustache(str(props.text), 'layout', errors)
        layout.push({ id: str(block.id) || newId('blk_'), type: block.type as TemplateBlock['type'], props })
      }
    }
  }

  let signatureDataUrl = base?.signatureDataUrl ?? null
  if (body.signatureDataUrl !== undefined) {
    const sig = body.signatureDataUrl
    if (sig === null || sig === '') signatureDataUrl = null
    else if (typeof sig !== 'string' || !sig.startsWith('data:image/png;base64,')) errors.signatureDataUrl = 'The signature must be a PNG image.'
    else if (sig.length > SIGNATURE_MAX) errors.signatureDataUrl = 'The signature image is too large.'
    else signatureDataUrl = sig
  }

  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)
  return { mode, html, css, layout, signatureDataUrl }
}

function parseIdentity(raw: unknown, base?: { name: string; partnerId: string | null }): { name: string; partnerId: string | null } {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const errors: Record<string, string> = {}
  const name = body.name === undefined ? (base?.name ?? '') : str(body.name).trim()
  if (!name) errors.name = 'Name is required.'
  else if (name.length > NAME_MAX) errors.name = `Name must be at most ${NAME_MAX} characters.`

  let partnerId = base?.partnerId ?? null
  if (body.partnerId !== undefined) {
    const value = body.partnerId
    if (value === null || value === '' || value === 'global') partnerId = null
    else if (typeof value === 'string' && store.data.partners.some((p) => p.id === value && !p.deletedAt)) partnerId = value
    else errors.partnerId = 'Choose Global or an existing partner.'
  }
  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)
  return { name, partnerId }
}

/** Make `target` the only default of its scope. */
function promoteDefault(target: InvoiceTemplate): void {
  for (const t of templates()) {
    if (t.id !== target.id && t.partnerId === target.partnerId) t.isDefault = false
  }
  target.isDefault = true
}

/** After any change, a scope that has templates always keeps exactly one default. */
function ensureDefaults(scopes: Array<string | null>): void {
  for (const scope of new Set(scopes)) {
    const inScope = templates().filter((t) => t.partnerId === scope)
    if (inScope.length > 0 && !inScope.some((t) => t.isDefault)) {
      const first = inScope.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
      if (first && scope === null) first.isDefault = true
    }
  }
}

const FALLBACK_SOURCE: TemplateSource = { mode: 'blocks', html: '', css: DEFAULT_CSS, layout: DEFAULT_LAYOUT, signatureDataUrl: null }

/** invoice.templateId -> the partner's default -> the global default -> the built-in look. */
function templateFor(invoice: Invoice): TemplateSource {
  const all = templates()
  const chosen =
    all.find((t) => t.id === invoice.templateId && (t.partnerId === null || t.partnerId === invoice.partnerId)) ??
    all.find((t) => t.partnerId === invoice.partnerId && t.isDefault) ??
    all.find((t) => t.partnerId === null && t.isDefault) ??
    all.find((t) => t.partnerId === null)
  return chosen
    ? { mode: chosen.mode, html: chosen.html, css: chosen.css, layout: chosen.layout, signatureDataUrl: chosen.signatureDataUrl }
    : FALLBACK_SOURCE
}

function renderInvoice(invoice: Invoice): { html: string; filename: string } {
  const language = currentLang()
  const view = buildInvoiceView(store.data, invoice, language)
  const options = { lang: language, title: invoice.invoiceNumber }
  let html: string
  try {
    html = renderDocument(templateFor(invoice), view, options)
  } catch {
    // A stored template that no longer parses must never block an invoice: use the house look.
    html = renderDocument(FALLBACK_SOURCE, view, options)
  }
  return { html, filename: `${invoice.invoiceNumber}.pdf` }
}

/* -------------------------------------------------------------- register */

export function register(api: MockApi): void {
  api.register('GET', '/invoice-templates', ({ params }) => {
    requireStaff(ACCOUNTING)
    const partnerId = params.partnerId
    return templates()
      .filter((t) => !partnerId || t.partnerId === null || t.partnerId === partnerId)
      .slice()
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || (a.partnerId ?? '').localeCompare(b.partnerId ?? '') || a.name.localeCompare(b.name))
      .map(row)
  })

  // Literal segment beats `:id`, but keep it registered before for readability.
  api.register('POST', '/invoice-templates/preview', ({ body }) => {
    requireStaff(ACCOUNTING)
    const source = parseBody(body)
    const language = lang(body)
    const view = buildSampleView(store.data.settings.billing, language)
    try {
      return { html: renderDocument(source, view, { lang: language, title: 'Preview' }) }
    } catch (error) {
      if (error instanceof TemplateSyntaxError) throw DemoApiError.validation({ html: error.message })
      throw error
    }
  })

  api.register('POST', '/invoice-templates', ({ body }) => {
    requireStaff(ACCOUNTING)
    const identity = parseIdentity(body)
    const source = parseBody(body, { mode: 'blocks', layout: DEFAULT_LAYOUT.map((b) => ({ ...b, id: newId('blk_'), props: { ...b.props } })), css: DEFAULT_CSS })
    const at = nowIso()
    const created: InvoiceTemplate = {
      id: newId('itpl_'),
      ...identity,
      ...source,
      isDefault: false,
      createdAt: at,
      updatedAt: at,
    }
    templates().push(created)
    // The first template of a scope becomes its default, so a partner scope never has none.
    if (!templates().some((t) => t.partnerId === created.partnerId && t.isDefault)) created.isDefault = true
    const wantsDefault = (body as { isDefault?: unknown } | null)?.isDefault === true
    if (wantsDefault) promoteDefault(created)
    recordAudit({ action: 'invoice_template.create', entityType: 'template', entityId: created.id, partnerId: created.partnerId, after: { name: created.name, mode: created.mode, isDefault: created.isDefault } })
    emitChanged('invoice-templates', 'audit')
    return created
  })

  api.register('GET', '/invoice-templates/:id', ({ path }) => {
    requireStaff(ACCOUNTING)
    return mustFind(path.id)
  })

  api.register('PATCH', '/invoice-templates/:id', ({ path, body }) => {
    requireStaff(ACCOUNTING)
    const current = mustFind(path.id)
    const before = { name: current.name, partnerId: current.partnerId, mode: current.mode, isDefault: current.isDefault }
    const identity = parseIdentity(body, { name: current.name, partnerId: current.partnerId })
    const source = parseBody(body, current)
    const previousScope = current.partnerId
    Object.assign(current, identity, source, { updatedAt: nowIso() })
    // Moving scope: it cannot stay default of a scope it left; join the new scope as non-default unless it has none.
    if (previousScope !== current.partnerId) {
      current.isDefault = false
      if (!templates().some((t) => t.id !== current.id && t.partnerId === current.partnerId && t.isDefault)) current.isDefault = true
      ensureDefaults([previousScope])
      // Invoices pointing at this template from another partner fall back to the default.
      for (const invoice of store.data.invoices) {
        if (invoice.templateId === current.id && current.partnerId !== null && invoice.partnerId !== current.partnerId) invoice.templateId = null
      }
    }
    recordAudit({
      action: 'invoice_template.update',
      entityType: 'template',
      entityId: current.id,
      partnerId: current.partnerId,
      before,
      after: { name: current.name, partnerId: current.partnerId, mode: current.mode, isDefault: current.isDefault },
    })
    emitChanged('invoice-templates', 'invoices', 'audit')
    return current
  })

  api.register('DELETE', '/invoice-templates/:id', ({ path }) => {
    requireStaff(ACCOUNTING)
    const current = mustFind(path.id)
    if (current.isDefault) throw new DemoApiError(409, 'template_is_default')
    store.data.invoiceTemplates = templates().filter((t) => t.id !== current.id)
    for (const invoice of store.data.invoices) if (invoice.templateId === current.id) invoice.templateId = null
    recordAudit({ action: 'invoice_template.delete', entityType: 'template', entityId: current.id, partnerId: current.partnerId, before: { name: current.name } })
    emitChanged('invoice-templates', 'invoices', 'audit')
    return { ok: true }
  })

  api.register('POST', '/invoice-templates/:id/default', ({ path }) => {
    requireStaff(ACCOUNTING)
    const current = mustFind(path.id)
    promoteDefault(current)
    current.updatedAt = nowIso()
    recordAudit({ action: 'invoice_template.set_default', entityType: 'template', entityId: current.id, partnerId: current.partnerId, after: { name: current.name } })
    emitChanged('invoice-templates', 'audit')
    return current
  })

  api.register('GET', '/invoices/:id/document', ({ path }) => {
    requireStaff(ACCOUNTING)
    const invoice = store.data.invoices.find((i) => i.id === path.id)
    if (!invoice) throw notFound()
    return renderInvoice(invoice)
  })

  api.register('GET', '/portal/invoices/:id/document', ({ path }) => {
    const { partner } = requirePartnerAdmin()
    const invoice = store.data.invoices.find((i) => i.id === path.id)
    // Drafts and other partners' invoices do not exist as far as the portal is concerned.
    if (!invoice || invoice.partnerId !== partner.id || invoice.status === 'draft') throw notFound()
    return renderInvoice(invoice)
  })
}
