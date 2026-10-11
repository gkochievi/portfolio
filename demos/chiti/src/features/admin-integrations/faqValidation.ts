/**
 * FAQ tree validation, shared by the editor (before save) and the mock
 * handler (on PUT): one root, every node reachable from it, questions need
 * options, options need a target or a transfer flag, no empty text.
 */
import type { FaqTree, LocalizedText } from '@/types'

import type { FaqIssue } from './types'

const blank = (text: LocalizedText | undefined): boolean => !text || !text.ka?.trim() || !text.en?.trim()

export function validateFaqTree(tree: FaqTree): FaqIssue[] {
  const issues: FaqIssue[] = []
  const nodes = tree.nodes
  const ids = Object.keys(nodes)
  const rootId = tree.rootIds.length === 1 ? tree.rootIds[0] : undefined
  if (!rootId || !nodes[rootId]) {
    issues.push({ nodeId: tree.rootIds[0] ?? ids[0] ?? '', code: 'no_root' })
    return issues
  }

  const reached = new Set<string>([rootId])
  const queue = [rootId]
  while (queue.length > 0) {
    const node = nodes[queue.shift() as string]
    if (!node) continue
    for (const option of node.options) {
      if (option.nextId && nodes[option.nextId] && !reached.has(option.nextId)) {
        reached.add(option.nextId)
        queue.push(option.nextId)
      }
    }
  }

  for (const id of ids) {
    const node = nodes[id]
    if (!node) continue
    if (!reached.has(id)) issues.push({ nodeId: id, code: 'unreachable' })
    if (blank(node.text)) issues.push({ nodeId: id, code: 'empty_text' })
    if (node.type === 'question') {
      if (node.options.length === 0) issues.push({ nodeId: id, code: 'no_options' })
      for (const option of node.options) {
        if (blank(option.label)) issues.push({ nodeId: id, optionId: option.id, code: 'empty_label' })
        if (option.nextId && !nodes[option.nextId]) issues.push({ nodeId: id, optionId: option.id, code: 'dangling_target' })
        else if (!option.nextId && !option.transferToOperator) issues.push({ nodeId: id, optionId: option.id, code: 'option_no_target' })
      }
    }
  }
  return issues
}
