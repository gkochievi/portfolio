/**
 * Locale plumbing that every demo shares — without i18next itself, which
 * each demo owns (its own instance, its own init options).
 *
 * The convention: every feature keeps its strings next to its code, one file
 * per language and namespace —
 *
 * ```
 * src/features/orders/locales/en/orders.json
 * src/features/orders/locales/ka/orders.json
 * ```
 *
 * — and the demo's `i18n.ts` gathers them in one line:
 *
 * ```ts
 * const resources = buildResources(import.meta.glob('./**\/locales/*\/*.json', { eager: true }))
 * ```
 *
 * Two people adding two features never edit the same JSON file, so parallel
 * work cannot conflict in a locale file.
 */

/** The two languages every demo ships. */
export type Lang = 'ka' | 'en'

/** i18next's `resources` shape: language → namespace → keys. */
export type LocaleResources = Record<string, Record<string, Record<string, unknown>>>

const LOCALE_FILE = /\/locales\/([a-z-]+)\/([\w-]+)\.json$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** An eager glob yields module namespaces (`{default: json, …}`); `{import: 'default'}` yields the JSON. */
function unwrapModule(value: unknown): unknown {
  return isRecord(value) && isRecord(value.default) ? value.default : value
}

function mergeInto(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  path: string,
  file: string,
): Record<string, unknown> {
  for (const [key, value] of Object.entries(source)) {
    const keyPath = path.endsWith(':') ? `${path}${key}` : `${path}.${key}`
    const existing = target[key]
    if (isRecord(existing) && isRecord(value)) {
      mergeInto(existing, value, keyPath, file)
      continue
    }
    if (existing !== undefined && existing !== value) {
      console.warn(`[demo-kit] ${file} redefines "${keyPath}"; the later file wins.`)
    }
    // Copy nested objects so later merges never write into a module's JSON.
    target[key] = isRecord(value) ? mergeInto({}, value, keyPath, file) : value
  }
  return target
}

/**
 * Turn an `import.meta.glob` result into i18next `resources`.
 *
 * `pattern` must capture the language as group 1 and the namespace as group 2.
 * Files that map to the same language + namespace are deep-merged; a key that
 * two files both define is warned about (the later path, alphabetically,
 * wins). Files the pattern does not match, or whose JSON is not an object,
 * are skipped with a warning.
 */
export function buildResources(
  globResult: Record<string, unknown>,
  pattern: RegExp = LOCALE_FILE,
): LocaleResources {
  // A /g pattern would carry `lastIndex` from one file to the next.
  const matcher = new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ''))
  const resources: LocaleResources = {}

  // Sorted, so which file wins a clash does not depend on glob enumeration order.
  for (const file of Object.keys(globResult).sort()) {
    const match = matcher.exec(file)
    const lng = match?.[1]
    const ns = match?.[2]
    if (!lng || !ns) {
      console.warn(`[demo-kit] ${file} does not match the locale pattern ${String(pattern)}; skipped.`)
      continue
    }

    const json = unwrapModule(globResult[file])
    if (!isRecord(json)) {
      console.warn(`[demo-kit] ${file} is not a JSON object; skipped.`)
      continue
    }

    const language = (resources[lng] ??= {})
    const namespace = (language[ns] ??= {})
    mergeInto(namespace, json, `${lng}/${ns}:`, file)
  }

  return resources
}
