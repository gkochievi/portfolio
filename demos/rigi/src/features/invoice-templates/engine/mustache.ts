/**
 * An in-house mustache subset, enough for invoice templates:
 *   {{a.b}}            escaped value (dot paths, `{{.}}` = current item)
 *   {{{a.b}}} {{& a}}  raw value
 *   {{#s}}…{{/s}}      section: arrays repeat, objects/strings push context, truthy renders once
 *   {{^s}}…{{/s}}      inverted: renders when falsy or an empty array
 *   {{! comment }}
 * Pure and dependency-free so the mock API and the editor share it.
 */

export class TemplateSyntaxError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message)
    this.name = 'TemplateSyntaxError'
  }
}

type Node =
  | { kind: 'text'; value: string }
  | { kind: 'var'; name: string; raw: boolean }
  | { kind: 'section'; name: string; inverted: boolean; children: Node[]; start: number }

const TAG = /\{\{(\{)?\s*([#^/!&]?)\s*([\s\S]*?)\s*(\})?\}\}/g

export function parseTemplate(source: string): Node[] {
  const root: Node[] = []
  const stack: Array<{ node: Extract<Node, { kind: 'section' }>; parent: Node[] }> = []
  let current = root
  let last = 0
  TAG.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TAG.exec(source)) !== null) {
    const [whole, tripleOpen, sigil, rawName, tripleClose] = match
    if (match.index > last) current.push({ kind: 'text', value: source.slice(last, match.index) })
    last = match.index + whole.length
    const name = (rawName ?? '').trim()
    if (sigil === '!') continue
    if (tripleOpen) {
      if (!tripleClose) throw new TemplateSyntaxError(`Unclosed triple mustache near "${whole}"`, match.index)
      current.push({ kind: 'var', name, raw: true })
      continue
    }
    if (!name) throw new TemplateSyntaxError('Empty tag', match.index)
    if (sigil === '#' || sigil === '^') {
      const node: Extract<Node, { kind: 'section' }> = { kind: 'section', name, inverted: sigil === '^', children: [], start: match.index }
      current.push(node)
      stack.push({ node, parent: current })
      current = node.children
      continue
    }
    if (sigil === '/') {
      const open = stack.pop()
      if (!open) throw new TemplateSyntaxError(`Unexpected closing tag {{/${name}}}`, match.index)
      if (open.node.name !== name) {
        throw new TemplateSyntaxError(`{{/${name}}} closes {{${open.node.inverted ? '^' : '#'}${open.node.name}}}`, match.index)
      }
      current = open.parent
      continue
    }
    current.push({ kind: 'var', name, raw: sigil === '&' })
  }
  if (last < source.length) current.push({ kind: 'text', value: source.slice(last) })
  const unclosed = stack.pop()
  if (unclosed) throw new TemplateSyntaxError(`Section {{#${unclosed.node.name}}} is never closed`, unclosed.node.start)
  return root
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '=': '&#61;' }

export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"'`=]/g, (c) => ESCAPES[c] ?? c)
}

function lookup(stack: unknown[], name: string): unknown {
  if (name === '.') return stack[stack.length - 1]
  const parts = name.split('.')
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const ctx = stack[i]
    if (ctx !== null && typeof ctx === 'object' && parts[0]! in (ctx as object)) {
      let value: unknown = ctx
      for (const part of parts) {
        if (value === null || value === undefined || typeof value !== 'object') return undefined
        value = (value as Record<string, unknown>)[part]
      }
      return value
    }
  }
  return undefined
}

function isFalsy(value: unknown): boolean {
  return value === undefined || value === null || value === false || value === '' || (Array.isArray(value) && value.length === 0)
}

function renderNodes(nodes: Node[], stack: unknown[]): string {
  let out = ''
  for (const node of nodes) {
    if (node.kind === 'text') {
      out += node.value
    } else if (node.kind === 'var') {
      const value = lookup(stack, node.name)
      if (value === undefined || value === null) continue
      out += node.raw ? String(value) : escapeHtml(value)
    } else {
      const value = lookup(stack, node.name)
      if (node.inverted) {
        if (isFalsy(value)) out += renderNodes(node.children, stack)
      } else if (Array.isArray(value)) {
        for (const item of value) out += renderNodes(node.children, [...stack, item])
      } else if (!isFalsy(value)) {
        out += renderNodes(node.children, typeof value === 'object' ? [...stack, value] : stack)
      }
    }
  }
  return out
}

/** Render `source` against `view`. Throws `TemplateSyntaxError` on malformed tags. */
export function renderMustache(source: string, view: unknown): string {
  return renderNodes(parseTemplate(source), [view])
}
