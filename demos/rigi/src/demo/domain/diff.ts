/** Shallow JSON-patch style diff for audit rows. Owner: seed. */
import type { JsonPatchOp } from '@/types'

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function shallowDiff(before: unknown, after: unknown): JsonPatchOp[] {
  if (!isObj(before) || !isObj(after)) {
    if (JSON.stringify(before) === JSON.stringify(after)) return []
    return [{ op: before === undefined || before === null ? 'add' : after === undefined || after === null ? 'remove' : 'replace', path: '', value: after }]
  }
  const ops: JsonPatchOp[] = []
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key]
    const b = after[key]
    if (JSON.stringify(a) === JSON.stringify(b)) continue
    if (a === undefined) ops.push({ op: 'add', path: `/${key}`, value: b })
    else if (b === undefined) ops.push({ op: 'remove', path: `/${key}` })
    else ops.push({ op: 'replace', path: `/${key}`, value: b })
  }
  return ops
}
