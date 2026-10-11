#!/usr/bin/env node
/**
 * Step 1 of the audio workflow: export what has to be spoken.
 *
 *   node demos/sinji/scripts/media/export-dialogues.mjs <out-dir>
 *
 * Writes (existing files with the same names are overwritten, nothing else is touched):
 *   <out-dir>/calls/<call_id>.json   { id, language, turns: [{ i, speaker, text }] }   one multi-voice dialogue per timed call
 *   <out-dir>/clips/<clip_id>.json   { id, voice_id, language, text }                  short single-voice clips (speech tool)
 *   <out-dir>/voices.json            [{ voice_id, name, language, gender, category, preview_text }]   one short preview per voice
 *
 * The text is read from the seed itself (src/demo/seed), so it always matches
 * the transcript the demo shows. `turns[].i` is the seed's segment index and is
 * what build-media.mjs aligns the measured timings to.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { describeSeed, loadSeed } from './lib/seed.mjs'

/** The seed's own estimate (build.ts buildSegments): about 0.058 s of speech per character. */
const SECONDS_PER_CHAR = 0.058

const out = process.argv[2]
if (!out || out.startsWith('-')) {
  console.error('Usage: node demos/sinji/scripts/media/export-dialogues.mjs <out-dir>')
  process.exit(2)
}
const outDir = path.resolve(out)

const write = (file, data) => {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
}

const { calls, clips, voices } = describeSeed(await loadSeed())

for (const call of calls) {
  write(path.join(outDir, 'calls', `${call.id}.json`), {
    id: call.id,
    language: call.language,
    turns: call.turns.map(({ i, speaker, text }) => ({ i, speaker, text })),
  })
}
for (const clip of clips) {
  write(path.join(outDir, 'clips', `${clip.id}.json`), {
    id: clip.id,
    voice_id: clip.voice_id,
    language: clip.language,
    text: clip.text,
  })
}

/* A voice preview needs a sentence per language. The seed has none, so the first clip of each language is suggested. */
const previewText = {}
for (const clip of clips) previewText[clip.language] ??= clip.text
write(
  path.join(outDir, 'voices.json'),
  voices.map(({ voice_id, name, language, gender, category }) => ({
    voice_id,
    name,
    language,
    gender,
    category,
    preview_text: previewText[language] ?? '',
  })),
)

/* ------------------------------------------------------------------ summary */

const chars = (s) => s.length
const callChars = (call) => call.turns.reduce((sum, t) => sum + chars(t.text), 0)
const pad = (value, width, right = false) => (right ? String(value).padStart(width) : String(value).padEnd(width))
const minutes = (c) => ((c * SECONDS_PER_CHAR) / 60).toFixed(1)

console.log(`Exported to ${outDir}\n`)
console.log(`${pad('call', 12)}${pad('lang', 6)}${pad('turns', 7, true)}${pad('characters', 12, true)}${pad('~minutes', 10, true)}`)
let callTotal = 0
let turnTotal = 0
for (const call of calls) {
  const c = callChars(call)
  callTotal += c
  turnTotal += call.turns.length
  console.log(`${pad(call.id, 12)}${pad(call.language, 6)}${pad(call.turns.length, 7, true)}${pad(c, 12, true)}${pad(minutes(c), 10, true)}`)
}
console.log(`${pad(`${calls.length} calls`, 18)}${pad(turnTotal, 7, true)}${pad(callTotal, 12, true)}${pad(minutes(callTotal), 10, true)}`)

console.log(`\n${pad('clip', 12)}${pad('lang', 6)}${pad('voice', 10)}${pad('characters', 12, true)}`)
let clipTotal = 0
for (const clip of clips) {
  clipTotal += chars(clip.text)
  console.log(`${pad(clip.id, 12)}${pad(clip.language, 6)}${pad(clip.voice_id, 10)}${pad(chars(clip.text), 12, true)}`)
}
console.log(`${pad(`${clips.length} clips`, 28)}${pad(clipTotal, 12, true)}`)

const previewTotal = voices.reduce((sum, v) => sum + chars(previewText[v.language] ?? ''), 0)
console.log(`\n${voices.length} voice previews (suggested text, one sentence per voice): ${previewTotal} characters`)
console.log(`\nTotal to synthesise: ${callTotal + clipTotal + previewTotal} characters`)
console.log(`  calls ${callTotal} + clips ${clipTotal} + previews ${previewTotal}; ${calls.length} dialogues, ${clips.length} clips, ${voices.length} previews`)
