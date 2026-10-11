/** Pure helpers for the editor's working copy of a template. */
import type { InvoiceTemplate, TemplateBlock, TemplateBlockType } from '@/types'

import type { TemplateDraft } from '../api'
import { BLOCK_DEFAULT_PROPS, DEFAULT_CSS, DEFAULT_LAYOUT, compileBlocks } from '../engine/document'

export function blockId(): string {
  return `blk_${Math.random().toString(36).slice(2, 9)}`
}

export function newBlock(type: TemplateBlockType): TemplateBlock {
  return { id: blockId(), type, props: { ...BLOCK_DEFAULT_PROPS[type] } }
}

export function cloneLayout(layout: TemplateBlock[]): TemplateBlock[] {
  return layout.map((b) => ({ ...b, id: blockId(), props: { ...b.props } }))
}

export function blankDraft(): TemplateDraft {
  const layout = cloneLayout(DEFAULT_LAYOUT)
  return { name: '', partnerId: null, mode: 'blocks', html: compileBlocks(layout), css: DEFAULT_CSS, layout, signatureDataUrl: null }
}

export function draftOf(template: InvoiceTemplate): TemplateDraft {
  return {
    name: template.name,
    partnerId: template.partnerId,
    mode: template.mode,
    html: template.html,
    css: template.css,
    layout: template.layout.map((b) => ({ ...b, props: { ...b.props } })),
    signatureDataUrl: template.signatureDataUrl,
  }
}

export function sameDraft(a: TemplateDraft, b: TemplateDraft): boolean {
  return (
    a.name === b.name &&
    a.partnerId === b.partnerId &&
    a.mode === b.mode &&
    a.html === b.html &&
    a.css === b.css &&
    a.signatureDataUrl === b.signatureDataUrl &&
    JSON.stringify(a.layout) === JSON.stringify(b.layout)
  )
}

/** Insert `snippet` into `value` at the textarea's selection; returns the new value and caret. */
export function insertAt(value: string, snippet: string, start: number | null, end: number | null): { value: string; caret: number } {
  const from = start ?? value.length
  const to = end ?? from
  return { value: value.slice(0, from) + snippet + value.slice(to), caret: from + snippet.length }
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item as T)
  return next
}
