import { Fragment } from 'react'

/**
 * The prose in `content/projects.json` names real identifiers — `select_for_update()`,
 * `/api/admin/`, `FleetConsumer` — and marks them with backticks, the way the
 * repo's own README files do. Nothing rendered those fields until the detail
 * page existed, so the convention was invisible; now it either becomes a code
 * span or it prints as stray punctuation.
 *
 * This is deliberately not a markdown parser. One rule, one delimiter: text
 * between single backticks is code. An unclosed backtick keeps its literal
 * character rather than swallowing the rest of the paragraph, which is what a
 * greedy split would do to a sentence about shell syntax.
 */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/g)

  return (
    <>
      {parts.map((part, index) =>
        // The capture group lands on every odd index, so the parity is the
        // marker — no second pass and no per-part re-testing.
        index % 2 === 1 ? (
          // The mono face alone, at full ink, with no box. A tinted or
          // outlined span was the first attempt and it fails twice: over
          // --hairline it measures 1.2:1 against both page planes, which is
          // invisible rather than subtle, and the chip vocabulary it would
          // borrow instead is outline-only — 39 bordered boxes in one
          // paragraph, which is what Printomato's write-up contains, reads as
          // noise. The typeface change is the signal; the brightness against
          // the surrounding dimmed prose is the emphasis.
          <code key={index} className="font-mono text-[0.9em] text-ink">
            {part}
          </code>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  )
}
