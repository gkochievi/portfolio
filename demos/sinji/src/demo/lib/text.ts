/**
 * Text utilities the mock backend shares: tokenising (Georgian + Latin),
 * chunking, TF-IDF retrieval with the product's confidence levels, shingles /
 * Jaccard for duplicates, and a stable checksum.
 *
 * Provided by the architect as a working baseline; maintained by the
 * knowledge-base group. kb-quality (retrieval playground, duplicates) and
 * copilot (grounding, tier-1 passages) import it - request changes, do not fork.
 */
import type { Confidence } from '@/types'

/** Common Georgian case / plural endings, longest first (light stemming only). */
const KA_SUFFIXES = ['ებისთვის', 'ისთვის', 'ებში', 'ებზე', 'ებით', 'ების', 'ებს', 'ები', 'თვის', 'ით', 'ად', 'ში', 'ზე', 'ის', 'ს', 'მა', 'ო']
const STOPWORDS = new Set([
  // en
  'the', 'and', 'for', 'you', 'your', 'are', 'can', 'what', 'how', 'with', 'this', 'that', 'is', 'to', 'of', 'in', 'on', 'a', 'an', 'do', 'it', 'my', 'i',
  // ka
  'და', 'რომ', 'არის', 'რა', 'როგორ', 'ეს', 'ის', 'თუ', 'მე', 'თქვენ', 'ჩემი', 'არ', 'ან', 'კი', 'უნდა', 'შეიძლება', 'მაქვს', 'გაქვთ',
])

function stem(token: string): string {
  if (!/[Ⴀ-ჿ]/.test(token) || token.length <= 4) return token
  for (const suffix of KA_SUFFIXES) {
    if (token.length - suffix.length >= 3 && token.endsWith(suffix)) return token.slice(0, -suffix.length)
  }
  return token
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
    .map(stem)
}

/** Rough token estimate (Georgian script is costlier than Latin). */
export function estimateTokens(text: string): number {
  const georgian = (text.match(/[Ⴀ-ჿ]/g) ?? []).length
  return Math.max(1, Math.round(georgian / 2.5 + (text.length - georgian) / 4))
}

/** Split on blank lines and pack paragraphs into chunks of about `targetTokens`. */
export function chunkText(text: string, targetTokens = 400): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const chunks: string[] = []
  let current = ''
  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph
    if (current && estimateTokens(candidate) > targetTokens) {
      chunks.push(current)
      current = paragraph
    } else {
      current = candidate
    }
  }
  if (current) chunks.push(current)
  return chunks
}

/* ------------------------------------------------------------- retrieval */

export interface Ranked<T> {
  item: T
  /** Reported score 0..1: a real match is usually >= 0.55, unrelated 0.35-0.45. */
  score: number
}

function termFrequencies(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1)
  return tf
}

/**
 * TF-IDF cosine between `query` and each item's `content`, mapped onto the
 * product's score scale (floor 0.35). Sorted descending; ties keep input order.
 */
export function rankByText<T extends { content: string }>(query: string, items: readonly T[]): Ranked<T>[] {
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0 || items.length === 0) return items.map((item) => ({ item, score: 0.35 }))

  const docs = items.map((item) => termFrequencies(tokenize(item.content)))
  const df = new Map<string, number>()
  for (const tf of docs) for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1)
  const idf = (term: string) => Math.log(1 + items.length / (1 + (df.get(term) ?? 0)))

  const queryTf = termFrequencies(queryTokens)
  const queryVector = new Map([...queryTf].map(([term, count]) => [term, count * idf(term)]))
  const queryNorm = Math.sqrt([...queryVector.values()].reduce((sum, v) => sum + v * v, 0)) || 1

  return items
    .map((item, index) => {
      const tf = docs[index] ?? new Map<string, number>()
      let dot = 0
      let norm = 0
      for (const [term, count] of tf) {
        const weight = count * idf(term)
        norm += weight * weight
        const q = queryVector.get(term)
        if (q) dot += weight * q
      }
      const cosine = norm > 0 ? dot / (Math.sqrt(norm) * queryNorm) : 0
      const score = Math.min(0.99, 0.35 + 0.6 * Math.sqrt(Math.max(0, cosine)))
      return { item, score: Math.round(score * 1000) / 1000, index }
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item, score }) => ({ item, score }))
}

/** high when top > 0.75 and margin > 0.1; medium when top > 0.5; otherwise low. */
export function confidenceOf(scores: readonly number[]): { confidence: Confidence; top: number; margin: number } {
  const top = scores[0] ?? 0
  const margin = Math.round((top - (scores[1] ?? 0.35)) * 1000) / 1000
  const confidence: Confidence = top > 0.75 && margin > 0.1 ? 'high' : top > 0.5 ? 'medium' : 'low'
  return { confidence, top, margin }
}

/** First ~`length` characters around the best-matching query term. */
export function snippetFor(content: string, query: string, length = 220): string {
  const terms = tokenize(query)
  const lower = content.toLowerCase()
  const at = terms.map((term) => lower.indexOf(term)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0
  const start = Math.max(0, at - Math.floor(length / 3))
  const slice = content.slice(start, start + length).trim()
  return `${start > 0 ? '... ' : ''}${slice}${start + length < content.length ? ' ...' : ''}`
}

/* ------------------------------------------------------------ duplicates */

export function normaliseText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Word k-shingles for near-duplicate detection. */
export function shingles(text: string, k = 4): Set<string> {
  const words = tokenize(text)
  const out = new Set<string>()
  if (words.length < k) {
    if (words.length) out.add(words.join(' '))
    return out
  }
  for (let i = 0; i + k <= words.length; i += 1) out.add(words.slice(i, i + k).join(' '))
  return out
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let shared = 0
  for (const item of a) if (b.has(item)) shared += 1
  return shared / (a.size + b.size - shared)
}

/** FNV-1a 32-bit as an unsigned integer - stable across reloads. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Checksum of the normalised text (exact-duplicate key). */
export function checksum(text: string): string {
  return hashString(normaliseText(text)).toString(16).padStart(8, '0')
}
