/**
 * Georgian text layer over API responses.
 *
 * The seed stays English. When the UI language is `ka`, every API response is
 * walked once and each STRING VALUE is swapped for its Georgian text:
 *
 *   1. exact lookup in `KA_TEXT` (English seed string -> Georgian),
 *   2. else the first `KA_PATTERNS` rule whose RegExp matches the whole string,
 *   3. else the string is left alone.
 *
 * Nothing the UI uses for logic may change, so three guards sit in front of
 * the lookup:
 *
 *   - HARD keys (ids, addresses, timestamps, tokens ...) are never touched.
 *   - SOFT keys (status, role, type ... - enum-ish fields) only get an exact
 *     dictionary hit, never a pattern, and never when the value looks like a
 *     code (`in_progress`, `AGENT_PRO`, `agent`). A free-text label such as a
 *     synced user's `status: 'Available'` can still be translated.
 *   - A string that carries no Latin letter, looks like an id / email / URL /
 *     date, or is very long is never translated.
 *
 * An object that already carries a Georgian sibling (`fullName` next to
 * `fullNameKa`) keeps the English field as it is: the UI picks between them and
 * forms edit the Latin spelling.
 *
 * `localizeValue` is pure: it never mutates its input and returns the very same
 * reference when nothing inside changed. Request bodies and thrown errors are
 * out of scope (error messages double as codes in several places).
 */
import { currentLang } from '@/lib/format'

import { KA_PATTERNS, KA_PREVIEW, KA_TEXT } from './index'

export type Lang = 'en' | 'ka'

/* ------------------------------------------------------------ key classes */

/** Property names whose values are never translated. */
const HARD_KEYS: ReadonlySet<string> = new Set([
  'id', 'key', 'keyId', 'slug', 'code', 'email', 'username', 'token', 'url', 'href', 'link', 'path', 'route',
  'currency', 'locale', 'lang', 'language', 'sampleFile', 'mimeType', 'filename', 'messageId', 'inReplyTo', 'references',
  'externalId', 'subjectNormalized', 'requestId', 'ip', 'actorIp', 'iban', 'swift', 'companyId', 'phone', 'invoiceNumber',
  'html', 'css', 'signatureDataUrl', 'dataUrl', 'password', 'secret', 'host', 'user', 'from', 'to', 'cc', 'domain',
  'pbxServerIp', 'webServerIp', 'webServerDomain', 'appBaseUrl', 'sort', 'dir', 'q', 'scopes', 'fromState', 'toState',
  'action', 'entityType', 'source', 'dependency', 'job', 'op', 'authorKind', 'displayStatus', 'stack', 'color',
])

/** `partnerId`, `toAddrs`, `createdAt`, `contactEmail`, `keyId` ... */
const HARD_SUFFIX = /(?:Id|Ids|Addr|Addrs|Email|Emails|Url|Href|Ip|At|On|Date|Token|Hash|Slug|Code|Color)$/

/** Enum-ish fields: exact dictionary hit only. */
const SOFT_KEYS: ReadonlySet<string> = new Set(['status', 'state', 'type', 'kind', 'role', 'priority', 'direction', 'channel', 'method', 'level', 'severity', 'scope', 'mode', 'architecture'])
const SOFT_SUFFIX = /(?:Status|State|Kind|Type|Role|Level|Mode|Direction|Channel)$/

type KeyClass = 'hard' | 'soft' | 'free'

const classOfKey = new Map<string, KeyClass>()

function keyClass(key: string | null): KeyClass {
  if (key === null) return 'free'
  let cls = classOfKey.get(key)
  if (cls === undefined) {
    cls = HARD_KEYS.has(key) || HARD_SUFFIX.test(key) ? 'hard' : SOFT_KEYS.has(key) || SOFT_SUFFIX.test(key) ? 'soft' : 'free'
    classOfKey.set(key, cls)
  }
  return cls
}

/* ----------------------------------------------------------- string rules */

const MAX_LENGTH = 4000
const LATIN = /[A-Za-z]/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_LIKE = /^(?:https?:|mailto:|tel:|data:|\/|#)/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]|$)/
const CODE_LOWER = /^[a-z0-9]+(?:[_.:/-][a-z0-9]+)*$/
const CODE_UPPER = /^[A-Z0-9]+(?:[_.:-][A-Z0-9]+)*$/
const MESSAGE_ID = /^<[^<>\s]+>$/

/** True for strings that can never be display text worth translating. */
function isOpaque(text: string): boolean {
  if (text.length === 0 || text.length > MAX_LENGTH) return true
  if (!LATIN.test(text)) return true
  if (CODE_LOWER.test(text) || CODE_UPPER.test(text)) return true
  return EMAIL.test(text) || URL_LIKE.test(text) || ISO_DATE.test(text) || MESSAGE_ID.test(text)
}

let textMap: Map<string, string> | null = null
const patternCache = new Map<string, string>()
const CACHE_LIMIT = 20_000

function dictionary(): Map<string, string> {
  if (!textMap) textMap = new Map(Object.entries(KA_TEXT))
  return textMap
}

/** Georgian text for one display string; the input when nothing applies. */
function translate(text: string, exactOnly: boolean): string {
  if (isOpaque(text)) return text
  const exact = dictionary().get(text)
  if (exact !== undefined) return exact
  if (exactOnly) return text
  const cached = patternCache.get(text)
  if (cached !== undefined) return cached
  let result = text
  for (const [match, build] of KA_PATTERNS) {
    match.lastIndex = 0
    const m = match.exec(text)
    if (!m) continue
    try {
      result = build(m)
    } catch {
      result = text
    }
    break
  }
  if (patternCache.size >= CACHE_LIMIT) patternCache.clear()
  patternCache.set(text, result)
  return result
}

/** Georgian text for a single string (`en` returns it unchanged). */
export function localizeString(text: string, lang: Lang): string {
  return lang === 'ka' ? translate(text, false) : text
}

/* ----------------------------------------------------------------- walker */

const MAX_DEPTH = 40

function isPlainObject(value: object): value is Record<string, unknown> {
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function walk(value: unknown, key: string | null, depth: number): unknown {
  if (typeof value === 'string') {
    const cls = keyClass(key)
    if (cls === 'hard') return value
    if (key === 'preview') return KA_PREVIEW(value)
    return translate(value, cls === 'soft')
  }
  if (value === null || typeof value !== 'object' || depth > MAX_DEPTH) return value
  if (Array.isArray(value)) {
    let out: unknown[] | null = null
    for (let i = 0; i < value.length; i += 1) {
      const next = walk(value[i], key, depth + 1)
      if (next !== value[i]) {
        out ??= value.slice()
        out[i] = next
      }
    }
    return out ?? value
  }
  if (!isPlainObject(value)) return value
  let out: Record<string, unknown> | null = null
  for (const [k, v] of Object.entries(value)) {
    // The UI already has the Georgian spelling next to it: leave the Latin one for forms.
    if (typeof v === 'string') {
      const sibling = value[`${k}Ka`]
      if (typeof sibling === 'string' && sibling !== '') continue
    }
    const next = walk(v, k, depth + 1)
    if (next !== v) {
      out ??= { ...value }
      out[k] = next
    }
  }
  return out ?? value
}

/**
 * Deep-walk JSON-like `value` and swap display strings for their Georgian text
 * when `lang` is `ka`. Pure: never mutates, returns `value` itself if nothing
 * changed (always, for `en`).
 */
export function localizeValue<T>(value: T, lang: Lang): T {
  if (lang !== 'ka') return value
  return walk(value, null, 0) as T
}

/** `localizeValue` for the UI language that is active right now. */
export function localizeResponse<T>(value: T): T {
  return localizeValue(value, currentLang())
}
