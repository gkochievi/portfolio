/**
 * The Georgian dictionaries, merged. `localize.ts` reads these; nothing else
 * should. Each domain file exports `entries` (exact English seed string ->
 * Georgian) and `patterns` (RegExp rules for strings the seed builds from parts):
 *
 *   catalog.ts  partners, documents, licences, task catalogue
 *   mail.ts     mailbox: subjects, bodies, signatures, previews
 *   money.ts    invoices, ledger notes, templates
 *   ops.ts      audit trail, system log, health
 *   work.ts     tasks, projects, history notes, chat, people's names
 */
import { entries as catalog, patterns as catalogPatterns } from './catalog'
import { entries as mail, localizePreview, patterns as mailPatterns } from './mail'
import { entries as money, patterns as moneyPatterns } from './money'
import { entries as ops, patterns as opsPatterns } from './ops'
import type { KaEntries, KaPattern } from './types'
import { entries as work, patterns as workPatterns } from './work'

/** Every dictionary, merged. Later files win on a duplicate key. */
export const KA_TEXT: KaEntries = { ...catalog, ...mail, ...money, ...ops, ...work }

export const KA_PATTERNS: KaPattern[] = [...catalogPatterns, ...mailPatterns, ...moneyPatterns, ...opsPatterns, ...workPatterns]

/** Georgian form of a mail `preview` (derived text, so it cannot be a plain dictionary entry). */
export const KA_PREVIEW: (preview: string) => string = localizePreview
