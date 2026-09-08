/**
 * The long-form fields in `content/projects.json` are prose with blank lines
 * between paragraphs — the shape a person writes in, not markup.
 *
 * Splitting here rather than at each call site keeps the rule in one place, and
 * keeps the alternative out of the codebase: dumping the raw string into one
 * node renders the blank lines as a single space, so three paragraphs arrive as
 * one wall of text that still validates and still type-checks.
 */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}
