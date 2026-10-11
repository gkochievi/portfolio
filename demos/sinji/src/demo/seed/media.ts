/**
 * Optional media manifest, written by the media step (`media-manifest.json`
 * next to this file): measured segment timings, waveform peaks and audio URLs
 * for the canned calls, and durations for voice previews and TTS clips.
 *
 * Everything works without it: calls then have no audio (null `audio_url`),
 * estimated timings and placeholder peaks. It is read with `import.meta.glob`
 * so a missing file is not a build error.
 */
import type { Segment } from '@/types'
import { placeholderPeaks, round2, type CallMedia } from './build'

export interface ManifestCall {
  /** Relative to BASE_URL, e.g. `media/calls/cc_mtb_01.m4a`. */
  audio_url: string
  duration_s: number
  peaks: number[]
  segments: Array<{ i: number; start: number; end: number }>
}

export interface MediaManifest {
  calls?: Record<string, ManifestCall>
  voices?: Record<string, { preview_url: string; duration_s: number }>
  clips?: Record<string, { audio_url: string; duration_s: number }>
}

const found = import.meta.glob<MediaManifest>('./media-manifest.json', { eager: true, import: 'default' })

export const manifest: MediaManifest = Object.values(found)[0] ?? {}

/** Segments with measured timings merged in (when the manifest has this call), plus the call's media. */
export function resolveCallMedia(
  id: string,
  base: Segment[],
  timed: boolean,
): { segments: Segment[]; media: CallMedia } {
  if (!timed) return { segments: base, media: { audio_url: null, duration_s: null, peaks: null } }
  const entry = manifest.calls?.[id]
  const segments = entry
    ? base.map((segment) => {
        const measured = entry.segments.find((m) => m.i === segment.i)
        return measured ? { ...segment, start: measured.start, end: measured.end } : segment
      })
    : base
  const lastEnd = segments.reduce((max, s) => Math.max(max, s.end ?? 0), 0)
  const duration_s = entry?.duration_s ?? round2(lastEnd + 1.4)
  return {
    segments,
    media: {
      audio_url: entry?.audio_url ?? null,
      duration_s,
      peaks: entry?.peaks ?? placeholderPeaks(segments, duration_s, id),
    },
  }
}

/** Voice preview path (`public/media/tts/<voice_id>-preview.m4a`). */
export const previewPath = (voiceId: string): string => manifest.voices?.[voiceId]?.preview_url ?? `media/tts/${voiceId}-preview.m4a`

/** Seeded TTS clip path and duration. */
export function clipMedia(clipId: string, text: string): { audio_url: string; duration_s: number } {
  const entry = manifest.clips?.[clipId]
  return {
    audio_url: entry?.audio_url ?? `media/tts/${clipId}.m4a`,
    duration_s: entry?.duration_s ?? round2(Math.max(2, text.length * 0.068)),
  }
}
