#!/usr/bin/env node
/**
 * Step 3 of the audio workflow: turn generated audio into the media files and
 * the manifest the demo reads.
 *
 *   node demos/sinji/scripts/media/build-media.mjs <input-dir> [--out <dir>] [--merge]
 *
 * Input files are named by id (extension: mp3, wav, m4a, ogg, aac, aif, aiff, caf, flac):
 *   <input-dir>/calls/<call_id>.*      one dialogue per call        -> public/media/calls/<call_id>.m4a
 *   <input-dir>/clips/<clip_id>.*      short single-voice clips     -> public/media/tts/<clip_id>.m4a
 *   <input-dir>/voices/<voice_id>.*    voice previews               -> public/media/tts/<voice_id>-preview.m4a
 *
 * Each file becomes a compact mono AAC .m4a (48 kbps for calls, 32 kbps for the
 * rest). Calls also get 600 waveform peaks and per-turn timings, measured from
 * the silence between turns. Everything is written to
 *   public/media/...                          the audio
 *   src/demo/seed/media-manifest.json         what src/demo/seed/media.ts reads
 *
 * Options:
 *   --out <dir>   write public/media/ and src/demo/seed/media-manifest.json under <dir>
 *                 instead of the demo itself (for trying it out; nothing in the repo changes)
 *   --merge       keep manifest entries of ids that are not in <input-dir> (when their audio file is still there);
 *                 by default the manifest describes exactly this input
 *
 * Needs macOS (afconvert, afinfo). Safe to run again: same input, same files.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { PEAK_COUNT, alignTurns, analyseSpeech, computePeaks, parseWav, round2, useProvidedTimings } from './lib/analysis.mjs'
import { decodePcm, durationOf, encodeAac, requireMacAudioTools, zeroMp4Timestamps } from './lib/macos.mjs'
import { SINJI_ROOT, describeSeed, loadSeed } from './lib/seed.mjs'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.aif', '.aiff', '.caf', '.flac'])
const PROFILES = {
  call: { bitrate: 48_000, sampleRate: 32_000 },
  small: { bitrate: 32_000, sampleRate: 24_000 },
}
const SIZE_LIMIT_BYTES = 12_000_000
const TIMING_SUFFIX = '.timing.json'
const KINDS = [
  { kind: 'call', dir: 'calls', label: 'calls' },
  { kind: 'clip', dir: 'clips', label: 'clips' },
  { kind: 'voice', dir: 'voices', label: 'voices' },
]

const USAGE = 'Usage: node demos/sinji/scripts/media/build-media.mjs <input-dir> [--out <dir>] [--merge]'
const tty = process.stdout.isTTY
const loud = (text) => (tty ? `\u001b[1;31m${text}\u001b[0m` : text)
const dim = (text) => (tty ? `\u001b[2m${text}\u001b[0m` : text)
const mb = (bytes) => `${(bytes / 1e6).toFixed(2)} MB`
const size = (bytes) => (bytes >= 1e6 ? mb(bytes) : `${Math.max(1, Math.round(bytes / 1e3))} KB`)
const pad = (value, width, right = false) => (right ? String(value).padStart(width) : String(value).padEnd(width))

function die(message, code = 2) {
  console.error(`\n${message}\n`)
  process.exit(code)
}

/* ---------------------------------------------------------------- args */

function parseArgs(argv) {
  const args = { input: null, out: null, merge: false }
  for (let k = 0; k < argv.length; k++) {
    const arg = argv[k]
    if (arg === '--out') {
      args.out = argv[++k]
      if (!args.out) die(`--out needs a directory.\n${USAGE}`)
    } else if (arg === '--merge') {
      args.merge = true
    } else if (arg === '-h' || arg === '--help') {
      console.log(USAGE)
      process.exit(0)
    } else if (arg.startsWith('-')) {
      die(`Unknown option ${arg}.\n${USAGE}`)
    } else if (args.input === null) {
      args.input = arg
    } else {
      die(`Unexpected argument ${arg}.\n${USAGE}`)
    }
  }
  if (args.input === null) die(USAGE)
  return args
}

const isDirectory = (p) => existsSync(p) && statSync(p).isDirectory()

/* --------------------------------------------------------------- input */

/** Files in <input>/calls|clips|voices, grouped by id. */
function scanInput(inputDir) {
  const found = { call: new Map(), clip: new Map(), voice: new Map() }
  const timingFiles = new Map()
  const skipped = []
  for (const { kind, dir } of KINDS) {
    const folder = path.join(inputDir, dir)
    if (!isDirectory(folder)) continue
    for (const name of readdirSync(folder).sort()) {
      if (name.startsWith('.')) continue
      const file = path.join(folder, name)
      if (!statSync(file).isFile()) continue
      if (kind === 'call' && name.endsWith(TIMING_SUFFIX)) {
        timingFiles.set(name.slice(0, -TIMING_SUFFIX.length), file)
        continue
      }
      const ext = path.extname(name).toLowerCase()
      if (!AUDIO_EXTENSIONS.has(ext)) {
        skipped.push(`${dir}/${name}`)
        continue
      }
      const id = path.basename(name, path.extname(name))
      if (!found[kind].has(id)) found[kind].set(id, [])
      found[kind].get(id).push(file)
    }
  }
  return { found, timingFiles, skipped }
}

/* ------------------------------------------------------------ manifest */

function stringifyManifest(manifest) {
  const sorted = (group) => Object.entries(group).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const calls = sorted(manifest.calls).map(([id, call]) => {
    const segments = call.segments.map((s) => `      ${JSON.stringify({ i: s.i, start: s.start, end: s.end })}`).join(',\n')
    return [
      `    ${JSON.stringify(id)}: {`,
      `      "audio_url": ${JSON.stringify(call.audio_url)},`,
      `      "duration_s": ${call.duration_s},`,
      `      "peaks": ${JSON.stringify(call.peaks)},`,
      `      "segments": [\n${segments}\n      ]`,
      '    }',
    ].join('\n')
  })
  const simple = (group) => sorted(group).map(([id, entry]) => `    ${JSON.stringify(id)}: ${JSON.stringify(entry)}`)
  const block = (name, rows) => `  "${name}": {${rows.length ? `\n${rows.join(',\n')}\n  ` : ''}}`
  return `{\n${[block('calls', calls), block('voices', simple(manifest.voices)), block('clips', simple(manifest.clips))].join(',\n')}\n}\n`
}

/** Throws if the manifest on disk would not satisfy what media.ts / the player expect. */
function validateManifest(manifest, callsById) {
  for (const [id, call] of Object.entries(manifest.calls)) {
    const turns = callsById.get(id)?.turns
    if (!turns) throw new Error(`manifest: ${id} is not a timed call in the seed`)
    if (!(call.duration_s > 0)) throw new Error(`manifest: ${id} has no duration`)
    if (call.peaks.length !== PEAK_COUNT || call.peaks.some((p) => !(p >= 0 && p <= 1))) {
      throw new Error(`manifest: ${id} needs ${PEAK_COUNT} peaks in 0..1`)
    }
    if (call.segments.length !== turns.length) throw new Error(`manifest: ${id} has ${call.segments.length} segments for ${turns.length} turns`)
    let last = 0
    call.segments.forEach((s, k) => {
      if (s.i !== turns[k].i) throw new Error(`manifest: ${id} segment ${k} has index ${s.i}, the seed has ${turns[k].i}`)
      if (!(s.start >= last - 1e-9 && s.end > s.start && s.end <= call.duration_s + 1e-9)) {
        throw new Error(`manifest: ${id} segment ${s.i} (${s.start}-${s.end}) is out of order or outside the audio`)
      }
      last = s.end
    })
  }
}

/* --------------------------------------------------------------- main */

const args = parseArgs(process.argv.slice(2))
const inputDir = path.resolve(args.input)
if (!isDirectory(inputDir)) die(`Input directory not found: ${inputDir}`)
const { found, timingFiles, skipped } = scanInput(inputDir)
const fileCount = KINDS.reduce((n, { kind }) => n + [...found[kind].values()].reduce((m, files) => m + files.length, 0), 0)
if (fileCount === 0) {
  die(
    `No audio found in ${inputDir}.\nExpected calls/<call_id>.mp3|wav|m4a|ogg, clips/<clip_id>.* and voices/<voice_id>.* (see demos/sinji/scripts/media/README.md).`,
  )
}
for (const { kind, dir } of KINDS) {
  const clashes = [...found[kind]].filter(([, files]) => files.length > 1)
  if (clashes.length) {
    die(`More than one file for the same id in ${dir}/:\n${clashes.map(([id, files]) => `  ${id}: ${files.map((f) => path.basename(f)).join(', ')}`).join('\n')}\nKeep one per id.`)
  }
}

try {
  requireMacAudioTools()
} catch (error) {
  die(error.message, 1)
}

const root = args.out ? path.resolve(args.out) : SINJI_ROOT
const publicDir = path.join(root, 'public')
const manifestPath = path.join(root, 'src', 'demo', 'seed', 'media-manifest.json')

const seed = describeSeed(await loadSeed())
const callsById = new Map(seed.calls.map((c) => [c.id, c]))
const clipsById = new Map(seed.clips.map((c) => [c.id, c]))
const voicesById = new Map(seed.voices.map((v) => [v.voice_id, v]))
const known = { call: callsById, clip: clipsById, voice: voicesById }

const warnings = []
const warn = (message) => warnings.push(message)
for (const name of skipped) warn(`ignored ${name}: not an audio extension I know`)

const items = []
for (const { kind, dir } of KINDS) {
  for (const [id, files] of [...found[kind]].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (!known[kind].has(id)) {
      const valid = [...known[kind].keys()].join(', ')
      warn(`ignored ${dir}/${path.basename(files[0])}: "${id}" is not a ${kind} id in the seed${kind === 'call' ? ' with audio' : ''} (valid: ${valid})`)
      continue
    }
    items.push({ kind, id, src: files[0], dir })
  }
}

if (items.length === 0) {
  console.error(warnings.map((w) => `  - ${w}`).join('\n'))
  die('Nothing to do: no file in the input directory matches an id in the seed. (The manifest was not touched.)')
}

for (const id of timingFiles.keys()) {
  if (!items.some((item) => item.kind === 'call' && item.id === id)) warn(`ignored calls/${id}${TIMING_SUFFIX}: there is no audio for call "${id}" in this input`)
}

const tmp = mkdtempSync(path.join(tmpdir(), 'sinji-media-'))
const manifest = { calls: {}, voices: {}, clips: {} }
const failures = []
const estimated = []

console.log(`Input   ${inputDir}`)
console.log(`Output  ${path.join(publicDir, 'media')}${dim(args.out ? '   (--out: the demo itself is untouched)' : '')}`)
console.log(`        ${manifestPath}\n`)
console.log(`${pad('kind', 7)}${pad('id', 13)}${pad('source', 30)}${pad('in', 10, true)}${pad('out', 10, true)}${pad('duration', 11, true)}  timing`)

try {
  for (const item of items) {
    const { kind, id, src } = item
    const profile = kind === 'call' ? PROFILES.call : PROFILES.small
    const relative = kind === 'call' ? `media/calls/${id}.m4a` : kind === 'clip' ? `media/tts/${id}.m4a` : `media/tts/${id}-preview.m4a`
    const target = path.join(publicDir, relative)
    const sourceName = `${item.dir}/${path.basename(src)}`
    let timing = ''
    let record = () => {}
    try {
      const encoded = path.join(tmp, `${kind}-${id}.m4a`)
      encodeAac(src, encoded, profile)
      zeroMp4Timestamps(encoded)
      const duration = round2(durationOf(encoded))
      const bytes = readFileSync(encoded)

      /* A recording that is wildly off in length is usually the wrong file or a cut-off one. */
      const text = kind === 'call' ? callsById.get(id).turns.map((t) => t.text).join('') : kind === 'clip' ? clipsById.get(id).text : ''
      if (text) {
        const expected = text.length * 0.058
        if (duration < expected * 0.3 || duration > expected * 3) {
          warn(`${kind} ${id}: audio is ${duration.toFixed(1)} s but the text suggests about ${expected.toFixed(0)} s. Is it the right file, and is it complete?`)
        }
      }
      if (duration < 0.3) warn(`${kind} ${id}: the audio is only ${duration.toFixed(2)} s long`)

      if (kind === 'call') {
        const decoded = path.join(tmp, `${id}.wav`)
        decodePcm(src, decoded)
        const pcm = parseWav(readFileSync(decoded))
        rmSync(decoded)
        if (Math.abs(pcm.duration - duration) > 0.15) {
          warn(`call ${id}: decoded length ${pcm.duration.toFixed(2)} s differs from the encoded ${duration.toFixed(2)} s; timings may be off by that much`)
        }
        const turns = callsById.get(id).turns.map((t) => ({ i: t.i, chars: t.text.length }))
        const timingFile = timingFiles.get(id)
        let aligned
        if (timingFile) {
          try {
            aligned = useProvidedTimings(JSON.parse(readFileSync(timingFile, 'utf8')), turns, duration)
          } catch (error) {
            throw new Error(`${id}${TIMING_SUFFIX}: ${error.message}`)
          }
        } else {
          aligned = alignTurns(turns, analyseSpeech(pcm.samples, pcm.sampleRate), duration)
        }
        const peaks = computePeaks(pcm.samples)
        record = () => (manifest.calls[id] = { audio_url: relative, duration_s: duration, peaks, segments: aligned.segments })
        if (aligned.method === 'proportional') {
          timing = loud('ESTIMATED (fallback)')
          estimated.push(id)
          warn(
            loud(`WARNING call ${id}: segment timings are ESTIMATED from character counts, not measured: ${aligned.reason}. The transcript highlight will drift from the voice. Check that the audio has the same turns as the transcript, with a pause at each change of speaker, or supply the real times in calls/${id}${TIMING_SUFFIX}.`),
          )
        } else if (aligned.method === 'provided') {
          timing = 'from timing file'
        } else if (aligned.method === 'single') {
          timing = 'single turn'
        } else {
          timing = `silence gaps, ${aligned.confidence}`
          if (aligned.confidence !== 'high') {
            warn(`call ${id}: timings measured from silence gaps with ${aligned.confidence} confidence: ${aligned.notes.join('; ')}. Spot-check it in the demo.`)
          }
        }
      } else if (kind === 'clip') {
        record = () => (manifest.clips[id] = { audio_url: relative, duration_s: duration })
      } else {
        record = () => (manifest.voices[id] = { preview_url: relative, duration_s: duration })
      }

      /* only now put the audio in place, so a file that failed above leaves nothing half-done */
      const previous = existsSync(target) ? readFileSync(target) : null
      if (!previous || !previous.equals(bytes)) {
        mkdirSync(path.dirname(target), { recursive: true })
        writeFileSync(`${target}.partial`, bytes)
        renameSync(`${target}.partial`, target)
      }
      record()

      console.log(
        `${pad(kind, 7)}${pad(id, 13)}${pad(sourceName, 30)}${pad(size(statSync(src).size), 10, true)}${pad(size(bytes.length), 10, true)}${pad(`${duration.toFixed(2)} s`, 11, true)}  ${timing}`,
      )
    } catch (error) {
      failures.push(`${kind} ${id} (${sourceName}): ${error.message}${/open input file/.test(error.message) ? ' (afconvert cannot read this file; for ogg and other formats macOS lacks, convert to wav or mp3 first)' : ''}`)
      console.log(`${pad(kind, 7)}${pad(id, 13)}${pad(sourceName, 30)}${loud('FAILED')}`)
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

/* --merge: keep what an earlier run produced for ids that are not in this input */
if (args.merge && existsSync(manifestPath)) {
  try {
    const previous = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const urlOf = { calls: 'audio_url', clips: 'audio_url', voices: 'preview_url' }
    const knownIds = { calls: callsById, clips: clipsById, voices: voicesById }
    for (const group of ['calls', 'clips', 'voices']) {
      for (const [id, entry] of Object.entries(previous[group] ?? {})) {
        if (manifest[group][id] || !knownIds[group].has(id)) continue
        if (existsSync(path.join(publicDir, entry[urlOf[group]]))) manifest[group][id] = entry
      }
    }
  } catch (error) {
    warn(`--merge: could not read the existing manifest (${error.message}); it is replaced`)
  }
}

if (Object.values(manifest).some((group) => Object.keys(group).length > 0)) {
  validateManifest(manifest, callsById)
  const text = stringifyManifest(manifest)
  JSON.parse(text)
  const unchanged = existsSync(manifestPath) && readFileSync(manifestPath, 'utf8') === text
  if (!unchanged) {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    writeFileSync(`${manifestPath}.partial`, text)
    renameSync(`${manifestPath}.partial`, manifestPath)
  }
  console.log(
    `\nManifest ${unchanged ? 'unchanged' : 'written'}: ${Object.keys(manifest.calls).length} calls, ${Object.keys(manifest.clips).length} clips, ${Object.keys(manifest.voices).length} voice previews`,
  )
}

/* what is still missing, what is on disk */
const missing = KINDS.map(({ kind, label }) => {
  const have = manifest[kind === 'call' ? 'calls' : kind === 'clip' ? 'clips' : 'voices']
  const ids = [...known[kind].keys()].filter((id) => !have[id])
  return ids.length ? `${label}: ${ids.join(', ')}` : null
}).filter(Boolean)
if (missing.length) console.log(`\nNo audio yet for  ${missing.join('\n                  ')}\n(those stay silent in the demo, with estimated timings)`)

const mediaFiles = ['calls', 'tts'].flatMap((sub) => {
  const folder = path.join(publicDir, 'media', sub)
  return isDirectory(folder) ? readdirSync(folder).filter((n) => n.endsWith('.m4a')).map((n) => path.join(folder, n)) : []
})
const referenced = new Set(
  [...Object.values(manifest.calls), ...Object.values(manifest.clips)].map((e) => path.join(publicDir, e.audio_url)).concat(Object.values(manifest.voices).map((e) => path.join(publicDir, e.preview_url))),
)
const orphans = mediaFiles.filter((f) => !referenced.has(f))
if (orphans.length) warn(`${orphans.length} file(s) in public/media are not in the manifest (left alone; delete them if stale): ${orphans.map((f) => path.relative(publicDir, f)).join(', ')}`)

const totalBytes = mediaFiles.reduce((sum, f) => sum + statSync(f).size, 0)
console.log(`\nMedia on disk: ${mb(totalBytes)} in ${mediaFiles.length} files (limit ${mb(SIZE_LIMIT_BYTES)})`)
if (totalBytes > SIZE_LIMIT_BYTES) {
  warn(loud(`WARNING media is ${mb(totalBytes)}, over the ${mb(SIZE_LIMIT_BYTES)} budget. It ships with every deploy: shorten the calls or re-encode them smaller.`))
}

if (warnings.length) {
  console.log(`\n${warnings.length} warning${warnings.length === 1 ? '' : 's'}:`)
  for (const message of warnings) console.log(`  - ${message}`)
}
if (failures.length) {
  console.log(loud(`\n${failures.length} file${failures.length === 1 ? '' : 's'} failed:`))
  for (const message of failures) console.log(`  - ${message}`)
}
if (estimated.length) {
  console.log(loud(`\n!!! TIMINGS ESTIMATED, NOT MEASURED, for ${estimated.join(', ')}. Their transcript highlight will not follow the voice. See the warnings above.`))
}
if (failures.length) process.exit(1)
