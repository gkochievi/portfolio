/**
 * Pure audio operations for the editor. Layers hold plain Float32Array channels;
 * every operation returns new arrays (history keeps references, so undo is cheap).
 */

export interface Layer {
  id: string
  name: string
  channels: Float32Array[]
  sampleRate: number
  /** Seconds from the start of the project. */
  offset: number
  /** Decibels. */
  gain: number
  muted: boolean
  solo: boolean
}

export type ChannelOp = 'swap' | 'mono' | 'left' | 'right' | 'invert' | 'stereo'

export const dbToLinear = (db: number): number => Math.pow(10, db / 20)

export const layerLength = (layer: Layer): number => layer.channels[0]?.length ?? 0
export const layerDuration = (layer: Layer): number => layerLength(layer) / layer.sampleRate
export const layerEnd = (layer: Layer): number => layer.offset + layerDuration(layer)
export const projectDuration = (layers: Layer[]): number => layers.reduce((max, l) => Math.max(max, layerEnd(l)), 0)

/** Which layers are heard: solo wins; otherwise everything not muted. */
export function isAudible(layer: Layer, layers: Layer[]): boolean {
  const anySolo = layers.some((l) => l.solo)
  return anySolo ? layer.solo : !layer.muted
}

export const effectiveGain = (layer: Layer, layers: Layer[]): number => (isAudible(layer, layers) ? dbToLinear(layer.gain) : 0)

/** Sample range of a project-time selection inside a layer, or the whole layer when there is none. */
export function rangeFor(layer: Layer, selection: { a: number; b: number } | null): [number, number] | null {
  const length = layerLength(layer)
  if (!selection) return length > 0 ? [0, length] : null
  const a = Math.max(0, Math.min(length, Math.round((selection.a - layer.offset) * layer.sampleRate)))
  const b = Math.max(0, Math.min(length, Math.round((selection.b - layer.offset) * layer.sampleRate)))
  return b - a >= 1 ? [a, b] : null
}

export function cutRange(channels: Float32Array[], a: number, b: number): Float32Array[] {
  return channels.map((ch) => {
    const out = new Float32Array(ch.length - (b - a))
    out.set(ch.subarray(0, a), 0)
    out.set(ch.subarray(b), a)
    return out
  })
}

export const trimRange = (channels: Float32Array[], a: number, b: number): Float32Array[] => channels.map((ch) => ch.slice(a, b))

export function silenceRange(channels: Float32Array[], a: number, b: number): Float32Array[] {
  return channels.map((ch) => {
    const out = ch.slice()
    out.fill(0, a, b)
    return out
  })
}

export function reverseRange(channels: Float32Array[], a: number, b: number): Float32Array[] {
  return channels.map((ch) => {
    const out = ch.slice()
    const part = out.subarray(a, b)
    part.reverse()
    return out
  })
}

export function fadeRange(channels: Float32Array[], a: number, b: number, direction: 'in' | 'out'): Float32Array[] {
  const n = Math.max(1, b - a - 1)
  return channels.map((ch) => {
    const out = ch.slice()
    for (let i = a; i < b; i += 1) {
      const x = (i - a) / n
      const g = direction === 'in' ? Math.sin((x * Math.PI) / 2) : Math.cos((x * Math.PI) / 2)
      out[i] = (out[i] as number) * g
    }
    return out
  })
}

export function gainRange(channels: Float32Array[], a: number, b: number, db: number): Float32Array[] {
  const g = dbToLinear(db)
  return channels.map((ch) => {
    const out = ch.slice()
    for (let i = a; i < b; i += 1) out[i] = (out[i] as number) * g
    return out
  })
}

export function peakOf(channels: Float32Array[], a: number, b: number): number {
  let peak = 0
  for (const ch of channels) {
    for (let i = a; i < b; i += 1) {
      const v = Math.abs(ch[i] as number)
      if (v > peak) peak = v
    }
  }
  return peak
}

/** Scale so the loudest sample in the range sits at `targetDb` (default -1 dBFS). Null if the range is silent. */
export function normaliseRange(channels: Float32Array[], a: number, b: number, targetDb = -1): Float32Array[] | null {
  const peak = peakOf(channels, a, b)
  if (peak < 1e-5) return null
  return gainRange(channels, a, b, 20 * Math.log10(dbToLinear(targetDb) / peak))
}

/** Channel operations over a range (or the whole layer). Returns null if the op does not apply. */
export function channelOp(channels: Float32Array[], op: ChannelOp, a: number, b: number): Float32Array[] | null {
  const left = channels[0]
  const right = channels[1]
  if (!left) return null
  if (op === 'stereo') return right ? null : [left.slice(), left.slice()]
  if (op === 'invert') {
    return channels.map((ch) => {
      const out = ch.slice()
      for (let i = a; i < b; i += 1) out[i] = -(out[i] as number)
      return out
    })
  }
  if (!right) return null
  if (op === 'swap') {
    const l = left.slice()
    const r = right.slice()
    for (let i = a; i < b; i += 1) {
      l[i] = right[i] as number
      r[i] = left[i] as number
    }
    return [l, r]
  }
  if (op === 'mono') {
    const out = new Float32Array(left.length)
    for (let i = 0; i < left.length; i += 1) out[i] = ((left[i] as number) + (right[i] as number)) / 2
    return [out]
  }
  const source = op === 'left' ? left : right
  const l = left.slice()
  const r = right.slice()
  for (let i = a; i < b; i += 1) {
    l[i] = source[i] as number
    r[i] = source[i] as number
  }
  return [l, r]
}

/** Sum the audible layers (offset + gain) into one buffer. */
export function mixdown(layers: Layer[], sampleRate: number): { channels: Float32Array[]; sampleRate: number } {
  const audible = layers.filter((l) => isAudible(l, layers))
  const stereo = audible.some((l) => l.channels.length > 1)
  const length = Math.max(1, ...audible.map((l) => Math.round(l.offset * sampleRate) + layerLength(l)))
  const out = Array.from({ length: stereo ? 2 : 1 }, () => new Float32Array(length))
  for (const layer of audible) {
    const g = dbToLinear(layer.gain)
    const start = Math.round(layer.offset * sampleRate)
    out.forEach((target, c) => {
      const source = layer.channels[Math.min(c, layer.channels.length - 1)] as Float32Array
      for (let i = 0; i < source.length; i += 1) target[start + i] = (target[start + i] as number) + (source[i] as number) * g
    })
  }
  return { channels: out, sampleRate }
}

/** 16-bit PCM WAV. */
export function encodeWav(channels: Float32Array[], sampleRate: number): Blob {
  const count = channels.length
  const length = channels[0]?.length ?? 0
  const bytes = length * count * 2
  const view = new DataView(new ArrayBuffer(44 + bytes))
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + bytes, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, count, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * count * 2, true)
  view.setUint16(32, count * 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, bytes, true)
  let p = 44
  for (let i = 0; i < length; i += 1) {
    for (let c = 0; c < count; c += 1) {
      const s = Math.max(-1, Math.min(1, (channels[c] as Float32Array)[i] as number))
      view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      p += 2
    }
  }
  return new Blob([view.buffer], { type: 'audio/wav' })
}
