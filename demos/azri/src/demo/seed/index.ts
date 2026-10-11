/**
 * The pristine seed, compiled into the bundle.
 *
 * The JSON files are GENERATED: edit `scripts/generate-seed.mjs` and run
 * `node demos/azri/scripts/generate-seed.mjs` (deterministic, no deps).
 * - catalog.json: 5 tenants, 10 branches, 16 staff, 6 campaigns, 21 questions, 6 personas
 * - history.json: 286 survey links over 45 days (11 persona links + background; 38 pending),
 *   13 persona SMS messages, 156 responses (mean about 4.2, a third or more with a comment)
 * - comments.json: the customer-comment pools by sentiment band (for simulators)
 *
 * Owner: seed agent.
 */
import type {
  Branch,
  Campaign,
  Lang,
  Question,
  Recipient,
  Seed,
  SmsMessage,
  Staff,
  SurveyLink,
  SurveyResponse,
  Tenant,
} from '@/types'

import catalog from './catalog.json'
import comments from './comments.json'
import history from './history.json'

export { accounts } from './accounts'

/**
 * The instant the seed is authored as "now" (13:00 in Tbilisi). `rebaseDates`
 * shifts every `...At` timestamp by (boot time - SEED_DATE), so pending links
 * are always a few days from expiry and "today" always has responses.
 */
export const SEED_DATE = '2026-10-01T09:00:00Z'

/** The pristine store. Plain data: `createStore` clones it on boot and on every reset. */
export const seed: Seed = {
  tenants: catalog.tenants as Tenant[],
  branches: catalog.branches as Branch[],
  staff: catalog.staff as Staff[],
  campaigns: catalog.campaigns as Campaign[],
  questions: catalog.questions as Question[],
  recipients: catalog.recipients as Recipient[],
  links: history.links as SurveyLink[],
  messages: history.messages as SmsMessage[],
  responses: history.responses as SurveyResponse[],
}

/* ------------------------------------------------------------- fixed tokens */

/** Survey-link tokens are 6 characters from this alphabet (no 0/O, 1/I/L). */
export const TOKEN_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/**
 * Hand-placed persona tokens, one per end state of the respondent flow.
 * `unknown` is printed in Luka's SMS but deliberately NOT in the store.
 */
export const SAMPLE_TOKENS = {
  /** Mariam, Nergi Bank Vake, served by Levan: pending, expires in about 5 days. */
  valid: '7KQ2M9',
  /** Mariam, Elva Telecom Didube shop: answered 2 days ago. */
  completed: 'C4WN8T',
  /** Giorgi, Nergi Bank Batumi: expired 2 days ago. */
  expired: 'X2HB5R',
  /** Luka, Elva Telecom: a token the CRM never issued. */
  unknown: '4TQ7PL',
} as const

/** Tokens the store must never hand out (printed in seed SMS but absent from links). */
export const RESERVED_TOKENS: readonly string[] = [SAMPLE_TOKENS.unknown]

/* ---------------------------------------------------------- comment pools */

export type CommentBand = 'positive' | 'neutral' | 'negative'

/**
 * One customer comment. `industry` is a Tenant['industry'] or 'any'. The history also
 * uses 'shop' and 'callcentre' for Elva remarks that only fit one kind of branch; the
 * runtime simulator only sees a tenant's industry, so it never draws those.
 */
export interface CommentSeed {
  lang: Lang
  industry: Tenant['industry'] | 'any' | 'shop' | 'callcentre'
  text: string
}

/**
 * The comment pools the seed history was drawn from, by sentiment band
 * (positive: average >= 3.75, neutral: >= 2.75, negative: below). Verbatim
 * customer voice, single-language; never translated.
 */
export const commentPools = comments as Record<CommentBand, CommentSeed[]>

/** The band a response's average rating falls in. */
export function commentBand(avg: number): CommentBand {
  return avg >= 3.75 ? 'positive' : avg >= 2.75 ? 'neutral' : 'negative'
}
