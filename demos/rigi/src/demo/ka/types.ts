/**
 * The contract between the Georgian text dictionaries and `localize.ts`.
 *
 * The seed is written in English and stays the source of truth. When the UI is
 * in Georgian, API responses are post-processed: any string that exactly matches
 * a dictionary entry is swapped for its Georgian text, and strings built from a
 * template are caught by a pattern rule. Dictionary files are split by domain so
 * they can be edited independently.
 */

/** Exact English seed string -> Georgian text. */
export type KaEntries = Record<string, string>

/** A template rule: `match` is tried against a whole string, `build` returns the Georgian text. */
export type KaPattern = readonly [match: RegExp, build: (m: RegExpMatchArray) => string]
