/** Web Audio playback and decoding for the editor. Nothing is fetched; every buffer comes from memory. */
import { effectiveGain, layerLength, type Layer } from './dsp'

type Ctor = typeof AudioContext

export class Player {
  private ctx: AudioContext | null = null
  private nodes = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>()
  private startedAt = 0
  private from = 0
  playing = false

  get context(): AudioContext {
    if (!this.ctx) {
      const Context: Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: Ctor }).webkitAudioContext
      this.ctx = new Context()
    }
    return this.ctx
  }

  get sampleRate(): number {
    return this.context.sampleRate
  }

  async decode(data: ArrayBuffer): Promise<{ channels: Float32Array[]; sampleRate: number }> {
    const buffer = await this.context.decodeAudioData(data)
    const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, c) => buffer.getChannelData(c).slice())
    return { channels, sampleRate: buffer.sampleRate }
  }

  async play(layers: Layer[], from: number, until: number | null): Promise<void> {
    const ctx = this.context
    if (ctx.state === 'suspended') await ctx.resume()
    this.halt()
    const when = ctx.currentTime + 0.04
    for (const layer of layers) {
      const length = layerLength(layer)
      if (!length) continue
      const buffer = ctx.createBuffer(layer.channels.length, length, layer.sampleRate)
      layer.channels.forEach((ch, c) => buffer.copyToChannel(ch as Float32Array<ArrayBuffer>, c))
      const begin = Math.max(from, layer.offset)
      const intoLayer = begin - layer.offset
      if (intoLayer >= buffer.duration) continue
      const span = until === null ? undefined : until - begin
      if (span !== undefined && span <= 0) continue
      const src = ctx.createBufferSource()
      src.buffer = buffer
      const gain = ctx.createGain()
      gain.gain.value = effectiveGain(layer, layers)
      src.connect(gain).connect(ctx.destination)
      src.start(when + Math.max(0, layer.offset - from), intoLayer, span)
      this.nodes.set(layer.id, { src, gain })
    }
    this.from = from
    this.startedAt = when
    this.playing = true
  }

  /** Playhead in project seconds. */
  position(): number {
    return this.playing ? this.from + Math.max(0, this.context.currentTime - this.startedAt) : this.from
  }

  /** Stop and return where playback was. */
  stop(): number {
    const at = this.position()
    this.halt()
    this.playing = false
    this.from = at
    return at
  }

  /** Apply gain / mute / solo changes without restarting. */
  setLive(layers: Layer[]): void {
    for (const layer of layers) {
      const node = this.nodes.get(layer.id)
      if (node) node.gain.gain.value = effectiveGain(layer, layers)
    }
  }

  private halt(): void {
    for (const { src } of this.nodes.values()) {
      try {
        src.stop()
      } catch {
        /* already stopped */
      }
      src.disconnect()
    }
    this.nodes.clear()
  }

  dispose(): void {
    this.halt()
    void this.ctx?.close().catch(() => undefined)
    this.ctx = null
    this.playing = false
  }
}

/** Decode the bundled demo clip (inlined into the bundle as a data URL; never fetched). */
export function dataUrlToArrayBuffer(url: string): ArrayBuffer {
  const base64 = url.slice(url.indexOf(',') + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}
