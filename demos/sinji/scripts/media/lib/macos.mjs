/**
 * Thin wrappers around the macOS audio tools build-media relies on:
 * `afconvert` (transcode and decode) and `afinfo` (duration).
 * No ffmpeg and no npm audio package is needed.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

export const AFCONVERT = '/usr/bin/afconvert'
export const AFINFO = '/usr/bin/afinfo'

/** Throws a readable error when the tools are missing (any non-macOS machine). */
export function requireMacAudioTools() {
  if (process.platform !== 'darwin' || !existsSync(AFCONVERT) || !existsSync(AFINFO)) {
    throw new Error('build-media needs macOS: it uses the built-in `afconvert` and `afinfo` (there is no ffmpeg fallback).')
  }
}

function run(tool, args) {
  const result = spawnSync(tool, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const detail = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim().split('\n').slice(-2).join(' ')
    throw new Error(`${tool.split('/').pop()} failed (exit ${result.status}): ${detail || 'no output'}`)
  }
  return result.stdout
}

/**
 * Transcode any input afconvert can read to mono AAC in an .m4a container.
 * The output sample rate is stated explicitly: without it afconvert rejects
 * low-rate inputs (8 kHz telephone audio) at these bitrates.
 */
export function encodeAac(src, dest, { bitrate, sampleRate }) {
  run(AFCONVERT, ['-f', 'm4af', '-d', `aac@${sampleRate}`, '-b', String(bitrate), '-c', '1', src, dest])
}

/** Decode to 16-bit little-endian mono PCM WAV at `sampleRate` (for analysis only). */
export function decodePcm(src, dest, sampleRate = 16000) {
  run(AFCONVERT, ['-f', 'WAVE', '-d', `LEI16@${sampleRate}`, '-c', '1', src, dest])
}

/** Duration in seconds, as afinfo reports it (priming frames already excluded for AAC). */
export function durationOf(file) {
  const out = run(AFINFO, [file])
  const match = /estimated duration:\s*([\d.]+)\s*sec/.exec(out)
  if (!match) throw new Error(`afinfo gave no duration for ${file}`)
  return Number(match[1])
}

/**
 * afconvert stamps the current time into the mp4 header (movie, track and media
 * headers), so the same input would give a different file on every run. Zero
 * those fields: reruns are byte-identical and git sees no change.
 */
export function zeroMp4Timestamps(file) {
  const buf = readFileSync(file)
  const containers = new Set(['moov', 'trak', 'mdia'])
  const headers = new Set(['mvhd', 'tkhd', 'mdhd'])
  const walk = (start, end) => {
    let offset = start
    while (offset + 8 <= end) {
      let size = buf.readUInt32BE(offset)
      const type = buf.toString('latin1', offset + 4, offset + 8)
      let body = offset + 8
      if (size === 1) {
        size = Number(buf.readBigUInt64BE(offset + 8))
        body = offset + 16
      } else if (size === 0) {
        size = end - offset
      }
      if (size < 8 || offset + size > end) break
      if (headers.has(type)) {
        const version = buf[body]
        buf.fill(0, body + 4, body + 4 + (version === 1 ? 16 : 8)) // creation + modification time
      } else if (containers.has(type)) {
        walk(body, offset + size)
      }
      offset += size
    }
  }
  walk(0, buf.length)
  writeFileSync(file, buf)
}
