/**
 * Transcription keyterm rules, shared by the form (per-line errors) and the
 * mock handler (the 400). At most 1000 terms, each shorter than 50 characters
 * and at most 5 words. OWNED BY: workspace-settings.
 */
export const KEYTERM_MAX_ITEMS = 1000
export const KEYTERM_MAX_CHARS = 50
export const KEYTERM_MAX_WORDS = 5

export type KeytermIssue = 'too_long' | 'too_many_words'

export interface KeytermLineError {
  /** 1-based line number in the textarea. */
  line: number
  term: string
  issue: KeytermIssue
}

export interface KeytermCheck {
  terms: string[]
  lineErrors: KeytermLineError[]
  tooMany: boolean
  valid: boolean
}

export const wordCount = (term: string): number => term.trim().split(/\s+/).filter(Boolean).length

export function parseKeyterms(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function checkKeytermsText(text: string): KeytermCheck {
  const lineErrors: KeytermLineError[] = []
  const terms: string[] = []
  text.split(/\r?\n/).forEach((raw, index) => {
    const term = raw.trim()
    if (!term) return
    terms.push(term)
    if (term.length >= KEYTERM_MAX_CHARS) lineErrors.push({ line: index + 1, term, issue: 'too_long' })
    else if (wordCount(term) > KEYTERM_MAX_WORDS) lineErrors.push({ line: index + 1, term, issue: 'too_many_words' })
  })
  const tooMany = terms.length > KEYTERM_MAX_ITEMS
  return { terms, lineErrors, tooMany, valid: lineErrors.length === 0 && !tooMany }
}

export function checkKeytermList(terms: readonly string[]): KeytermCheck {
  return checkKeytermsText(terms.join('\n'))
}
