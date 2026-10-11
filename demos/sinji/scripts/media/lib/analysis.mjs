/**
 * Audio analysis for build-media: WAV parsing, waveform peaks, silence
 * detection and the alignment of transcript turns to the silence gaps.
 * Pure functions; no file access, no macOS tools.
 */

/** Same count the seed's placeholderPeaks uses (src/demo/seed/build.ts, `count = 600`). */
export const PEAK_COUNT = 600

const FRAME_S = 0.01 // energy frame
const MIN_GAP_S = 0.12 // shortest silence considered as a possible turn boundary
const MIN_SPEECH_S = 0.05 // shorter bursts (clicks) are treated as silence
const PAD_S = 0.04 // a segment reaches this far into the gaps next to it
const GAP_CAP_S = 3 // a long hold or silence counts no more than this when ranking gaps
const LENGTH_WEIGHT = 1.5 // how much a longer gap is preferred over a position closer to the estimate
const PROPORTIONAL_GAP_S = 0.3 // pause assumed between turns in the proportional fallback

export const round2 = (n) => Math.round(n * 100) / 100

/* ----------------------------------------------------------------- WAV */

/** Parse a 16-bit PCM mono WAV (what `afconvert -d LEI16 -c 1` writes). Skips extra chunks such as FLLR; accepts the extensible header. */
export function parseWav(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('decoded audio is not a RIFF/WAVE file')
  }
  let offset = 12
  let fmt = null
  let data = null
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4)
    const body = offset + 8
    let size = buf.readUInt32LE(offset + 4)
    if (body + size > buf.length) size = buf.length - body // tolerate a truncated or streamed size field
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      }
      // WAVE_FORMAT_EXTENSIBLE (afconvert writes it when decoding some m4a files): the real format is the sub-format GUID's first two bytes
      if (fmt.format === 0xfffe && size >= 26) fmt.format = buf.readUInt16LE(body + 24)
    } else if (id === 'data') {
      data = { body, size }
      break
    }
    offset = body + size + (size & 1)
  }
  if (!fmt || !data) throw new Error('decoded WAV has no fmt or data chunk')
  if (fmt.format !== 1 || fmt.channels !== 1 || fmt.bits !== 16) {
    throw new Error(`expected 16-bit mono PCM, got format ${fmt.format}, ${fmt.channels} ch, ${fmt.bits} bit`)
  }
  const count = Math.floor(data.size / 2)
  const view = new DataView(buf.buffer, buf.byteOffset + data.body, count * 2)
  const samples = new Int16Array(count)
  for (let i = 0; i < count; i++) samples[i] = view.getInt16(i * 2, true)
  return { sampleRate: fmt.sampleRate, samples, duration: count / fmt.sampleRate }
}

/* --------------------------------------------------------------- peaks */

/**
 * `count` waveform peaks in 0..1: the largest absolute sample in each equal slice
 * of the file, divided by the 99th-percentile slice so one click cannot flatten
 * the rest. Rounded to 2 decimals like the placeholder peaks.
 */
export function computePeaks(samples, count = PEAK_COUNT) {
  const raw = new Float64Array(count)
  const n = samples.length
  for (let k = 0; k < count; k++) {
    const from = Math.floor((k * n) / count)
    const to = Math.max(from + 1, Math.floor(((k + 1) * n) / count))
    let max = 0
    for (let i = from; i < to && i < n; i++) {
      const a = Math.abs(samples[i])
      if (a > max) max = a
    }
    raw[k] = max
  }
  const sorted = Float64Array.from(raw).sort()
  const reference = sorted[Math.min(count - 1, Math.floor(count * 0.99))] || sorted[count - 1] || 1
  return Array.from(raw, (v) => round2(Math.min(1, v / reference)))
}

/* ------------------------------------------------------------- silence */

const percentile = (sortedValues, p) => sortedValues[Math.min(sortedValues.length - 1, Math.floor(sortedValues.length * p))]

/**
 * Find the speech runs and the silence gaps between them from short-time energy.
 * The threshold follows the recording: 35 dB under its loud passages, but at least
 * 12 dB above its quietest ones (so a noise floor does not count as speech).
 */
export function analyseSpeech(samples, sampleRate) {
  const frame = Math.max(1, Math.round(sampleRate * FRAME_S))
  const frames = Math.floor(samples.length / frame)
  const db = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    let sum = 0
    for (let i = f * frame, end = i + frame; i < end; i++) sum += samples[i] * samples[i]
    db[f] = Math.max(-100, 20 * Math.log10(Math.sqrt(sum / frame) / 32768 + 1e-9))
  }
  const sorted = Float32Array.from(db).sort()
  const loud = frames ? percentile(sorted, 0.95) : -100
  const quiet = frames ? Math.max(percentile(sorted, 0.05), -90) : -100
  if (loud < -75) return { silent: true, speechStart: 0, speechEnd: 0, gaps: [], thresholdDb: loud }
  const threshold = Math.max(loud - 35, quiet + 12)

  let runs = []
  let from = -1
  for (let f = 0; f <= frames; f++) {
    const on = f < frames && db[f] > threshold
    if (on && from < 0) from = f
    if (!on && from >= 0) {
      runs.push([from, f])
      from = -1
    }
  }
  runs = runs.filter(([a, b]) => (b - a) * FRAME_S >= MIN_SPEECH_S)
  if (runs.length === 0) return { silent: true, speechStart: 0, speechEnd: 0, gaps: [], thresholdDb: threshold }

  const gaps = []
  for (let r = 0; r + 1 < runs.length; r++) {
    const start = runs[r][1] * FRAME_S
    const end = runs[r + 1][0] * FRAME_S
    if (end - start >= MIN_GAP_S) gaps.push({ start, end, len: end - start })
  }
  return {
    silent: false,
    speechStart: runs[0][0] * FRAME_S,
    speechEnd: runs[runs.length - 1][1] * FRAME_S,
    gaps,
    thresholdDb: threshold,
  }
}

/* ----------------------------------------------------------- alignment */

/**
 * Character-proportional timing over [from, to]: the fallback, and the estimate
 * the gap search is anchored to. Weights follow the seed's own formula
 * (0.5 s + about 0.058 s per character).
 */
export function proportionalSegments(turns, from, to) {
  const weights = turns.map((t) => 0.5 + 0.058 * t.chars)
  const total = weights.reduce((a, b) => a + b, 0)
  const available = Math.max(0.3 * turns.length, to - from - PROPORTIONAL_GAP_S * (turns.length - 1))
  let t = from
  return turns.map((turn, k) => {
    const start = t
    const end = start + (available * weights[k]) / total
    t = end + PROPORTIONAL_GAP_S
    return { i: turn.i, start, end }
  })
}

/**
 * Pick the turn boundaries from the silence gaps: exactly turns-1 gaps, in order,
 * minimising a cost that prefers long gaps and gaps near where the transcript
 * says the boundary should be (dynamic programming over the sorted gaps).
 * Returns the chosen gap indices, or null when there are fewer gaps than boundaries.
 */
function chooseGaps(gaps, predicted, sigma) {
  const need = predicted.length
  const total = gaps.length
  if (total < need) return null
  const cost = (k, j) => {
    const gap = gaps[j]
    const d = ((gap.start + gap.end) / 2 - predicted[k]) / sigma
    return 0.5 * d * d - LENGTH_WEIGHT * Math.log(Math.min(gap.len, GAP_CAP_S) / 0.5)
  }
  const best = Array.from({ length: need }, () => new Float64Array(total).fill(Infinity))
  const from = Array.from({ length: need }, () => new Int32Array(total).fill(-1))
  for (let j = 0; j < total; j++) best[0][j] = cost(0, j)
  for (let k = 1; k < need; k++) {
    let run = Infinity
    let runAt = -1
    for (let j = 0; j < total; j++) {
      if (j > 0 && best[k - 1][j - 1] < run) {
        run = best[k - 1][j - 1]
        runAt = j - 1
      }
      if (run < Infinity) {
        best[k][j] = run + cost(k, j)
        from[k][j] = runAt
      }
    }
  }
  let end = -1
  let lowest = Infinity
  for (let j = 0; j < total; j++) {
    if (best[need - 1][j] < lowest) {
      lowest = best[need - 1][j]
      end = j
    }
  }
  if (end < 0) return null
  const chosen = new Array(need)
  for (let k = need - 1, j = end; k >= 0; k--) {
    chosen[k] = j
    j = from[k][j]
  }
  return chosen
}

/**
 * Timings supplied by whoever made the audio (a speech service's per-turn
 * timestamps, an edit list): [{ i, start, end }], one per transcript turn.
 * Validated, not measured. Returns the same shape as alignTurns.
 */
export function useProvidedTimings(data, turns, duration) {
  const list = Array.isArray(data) ? data : data?.segments
  if (!Array.isArray(list)) throw new Error('timing file must be a list of { i, start, end } (or { "segments": [...] })')
  if (list.length !== turns.length) throw new Error(`timing file has ${list.length} segments, the transcript has ${turns.length} turns`)
  let last = 0
  const segments = list.map((entry, k) => {
    const { i, start, end } = entry ?? {}
    if (i !== turns[k].i) throw new Error(`timing file entry ${k} has i=${i}, expected ${turns[k].i} (keep the transcript order)`)
    if (!Number.isFinite(start) || !Number.isFinite(end) || !(start >= 0) || !(end > start)) throw new Error(`timing file entry i=${i} needs 0 <= start < end`)
    if (start < last - 0.05) throw new Error(`timing file entry i=${i} starts at ${start}, before the previous turn ended (${last})`)
    if (end > duration + 0.3) throw new Error(`timing file entry i=${i} ends at ${end} s, after the audio (${duration.toFixed(2)} s)`)
    last = end
    return { i, start: round2(start), end: round2(Math.min(end, duration)) }
  })
  return { method: 'provided', confidence: 'high', segments, notes: [] }
}

/**
 * Segment timings for one call.
 *
 * `turns` is [{ i, chars }] in transcript order; `speech` comes from analyseSpeech.
 * Returns { method, confidence, segments: [{ i, start, end }], notes: [] } where
 * method is 'silence-gaps' (measured; confidence 'high' or 'medium', with notes), 'single'
 * (one turn) or 'proportional' (the fallback, confidence 'low'; `reason` says why).
 * The caller should warn loudly on 'proportional'.
 */
export function alignTurns(turns, speech, duration) {
  const finish = (method, confidence, raw, notes = [], reason) => {
    const segments = raw.map(({ i, start, end }) => ({
      i,
      start: round2(Math.max(0, Math.min(duration, start))),
      end: round2(Math.max(0, Math.min(duration, end))),
    }))
    return { method, confidence, segments, notes, ...(reason ? { reason } : {}) }
  }
  const from = speech.silent ? Math.min(0.3, duration / 4) : speech.speechStart
  const to = speech.silent ? Math.max(from + 1, duration - 0.5) : speech.speechEnd
  const fallback = (reason) => finish('proportional', 'low', proportionalSegments(turns, from, to), [], reason)

  if (turns.length === 0) return finish('single', 'high', [])
  if (speech.silent) return fallback('no speech was detected in the audio')
  if (turns.length === 1) {
    return finish('single', 'high', [{ i: turns[0].i, start: from - PAD_S, end: to + PAD_S }])
  }

  const need = turns.length - 1
  if (speech.gaps.length < need) {
    return fallback(`found ${speech.gaps.length} silence gaps of at least ${MIN_GAP_S} s, but the transcript has ${need} turn boundaries`)
  }

  const estimate = proportionalSegments(turns, from, to)
  const predicted = estimate.slice(1).map((seg, k) => (estimate[k].end + seg.start) / 2)
  const span = to - from
  const sigma = Math.max(1.5, 0.06 * span)
  const chosen = chooseGaps(speech.gaps, predicted, sigma)
  if (!chosen) return fallback('no consistent set of silence gaps')

  const tolerance = Math.max(4, 0.2 * span)
  for (let k = 0; k < need; k++) {
    const gap = speech.gaps[chosen[k]]
    const off = Math.abs((gap.start + gap.end) / 2 - predicted[k])
    if (off > tolerance) {
      return fallback(
        `the gap chosen for the boundary after turn ${turns[k].i} is ${off.toFixed(1)} s from where the transcript length puts it (limit ${tolerance.toFixed(1)} s)`,
      )
    }
  }

  /* Is the audio plausibly the same dialogue? The silences between turns should stand out from the pauses inside turns. */
  const ranked = speech.gaps.map((g) => g.len).sort((x, y) => y - x)
  let cliff = { ratio: 0, count: 0 }
  for (let k = Math.max(0, Math.ceil(0.6 * need) - 1); k <= Math.min(ranked.length - 2, Math.floor(1.4 * need)); k++) {
    const ratio = ranked[k] / ranked[k + 1]
    if (ratio > cliff.ratio) cliff = { ratio, count: k + 1 }
  }
  if (cliff.ratio >= 1.8 && cliff.count !== need) {
    return fallback(
      `the audio has about ${cliff.count} clear pauses between turns (about ${cliff.count + 1} turns) but the transcript has ${turns.length} turns; the audio and the transcript are not the same dialogue`,
    )
  }

  const chosenSet = new Set(chosen)
  const lengths = chosen.map((j) => speech.gaps[j].len).sort((x, y) => x - y)
  const shortestChosen = lengths[0]
  const typical = lengths[Math.floor(lengths.length / 2)]
  const longestOther = Math.max(0, ...speech.gaps.filter((_, j) => !chosenSet.has(j)).map((g) => g.len))
  const outranked = lengths.filter((len) => len < longestOther).length
  const notes = []
  let confidence = 'high'
  if (shortestChosen < longestOther) {
    if (outranked > 0.2 * need) {
      return fallback(
        `turn gaps cannot be told apart from pauses inside turns (${outranked} of ${need} chosen gaps are shorter than the longest ordinary pause, ${longestOther.toFixed(2)} s)`,
      )
    }
    confidence = 'medium'
    notes.push(`${outranked} of ${need} boundaries sit on gaps shorter than the longest pause inside a turn (${longestOther.toFixed(2)} s); chosen by position in the transcript`)
  } else if (shortestChosen < 1.5 * longestOther) {
    confidence = 'medium'
    notes.push(`turn gaps are only slightly longer than pauses inside turns (shortest turn gap ${shortestChosen.toFixed(2)} s, longest other pause ${longestOther.toFixed(2)} s)`)
  }
  if (typical < 0.2) {
    confidence = 'medium'
    notes.push(`turn gaps are very short (typically ${typical.toFixed(2)} s)`)
  } else if (shortestChosen < 0.3 * typical) {
    confidence = 'medium'
    notes.push(`one turn gap is only ${shortestChosen.toFixed(2)} s against a typical ${typical.toFixed(2)} s`)
  }

  const raw = turns.map((turn, k) => {
    const before = k > 0 ? speech.gaps[chosen[k - 1]] : null
    const after = k < need ? speech.gaps[chosen[k]] : null
    return {
      i: turn.i,
      start: before ? before.end - PAD_S : from - PAD_S,
      end: after ? after.start + PAD_S : to + PAD_S,
    }
  })
  return finish('silence-gaps', confidence, raw, notes)
}
