/**
 * Word-level diff by longest common subsequence. Whitespace travels with the
 * word that follows it so both sides re-assemble to the exact original text.
 */
export type DiffOp = '=' | '-' | '+'
export interface DiffRun {
  op: DiffOp
  text: string
}

function tokens(text: string): string[] {
  return text.match(/\s*\S+|\s+$/g) ?? []
}

const norm = (token: string) => token.trim()

export function diffWords(before: string, after: string): DiffRun[] {
  const a = tokens(before)
  const b = tokens(after)
  const n = a.length
  const m = b.length
  // Trim the shared head and tail first: most proposals only touch a sentence or two.
  let head = 0
  while (head < n && head < m && norm(a[head] ?? '') === norm(b[head] ?? '')) head += 1
  let tail = 0
  while (tail < n - head && tail < m - head && norm(a[n - 1 - tail] ?? '') === norm(b[m - 1 - tail] ?? '')) tail += 1

  const midA = a.slice(head, n - tail)
  const midB = b.slice(head, m - tail)
  const rows = midA.length
  const cols = midB.length
  const runs: DiffRun[] = []
  const push = (op: DiffOp, text: string) => {
    const last = runs[runs.length - 1]
    if (last && last.op === op) last.text += text
    else runs.push({ op, text })
  }

  if (head) push('=', b.slice(0, head).join(''))

  if (rows * cols > 4_000_000) {
    // Pathologically large: fall back to a coarse replace.
    if (rows) push('-', midA.join(''))
    if (cols) push('+', midB.join(''))
  } else {
    const table: Uint32Array[] = Array.from({ length: rows + 1 }, () => new Uint32Array(cols + 1))
    for (let i = rows - 1; i >= 0; i -= 1) {
      for (let j = cols - 1; j >= 0; j -= 1) {
        const row = table[i] as Uint32Array
        const below = table[i + 1] as Uint32Array
        row[j] = norm(midA[i] ?? '') === norm(midB[j] ?? '') ? (below[j + 1] ?? 0) + 1 : Math.max(below[j] ?? 0, row[j + 1] ?? 0)
      }
    }
    let i = 0
    let j = 0
    while (i < rows && j < cols) {
      if (norm(midA[i] ?? '') === norm(midB[j] ?? '')) {
        push('=', midB[j] ?? '')
        i += 1
        j += 1
      } else if (((table[i + 1] as Uint32Array)[j] ?? 0) >= ((table[i] as Uint32Array)[j + 1] ?? 0)) {
        push('-', midA[i] ?? '')
        i += 1
      } else {
        push('+', midB[j] ?? '')
        j += 1
      }
    }
    while (i < rows) push('-', midA[i++] ?? '')
    while (j < cols) push('+', midB[j++] ?? '')
  }

  if (tail) push('=', b.slice(m - tail).join(''))
  return runs
}

/** The runs that make up one side: `old` keeps = and -, `new` keeps = and +. */
export function sideOf(runs: readonly DiffRun[], side: 'old' | 'new'): DiffRun[] {
  const keep: DiffOp = side === 'old' ? '-' : '+'
  return runs.filter((run) => run.op === '=' || run.op === keep)
}

export function diffStats(runs: readonly DiffRun[]): { added: number; removed: number } {
  const count = (op: DiffOp) =>
    runs.filter((r) => r.op === op).reduce((sum, r) => sum + (r.text.match(/\S+/g)?.length ?? 0), 0)
  return { added: count('+'), removed: count('-') }
}
