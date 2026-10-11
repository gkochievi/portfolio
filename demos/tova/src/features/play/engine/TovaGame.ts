/**
 * The round engine: a port of the source's canvas engine, re-skinned to the
 * Tova brand. Every player gets the same physics; the fairness plan is unchanged.
 *
 * Every round is planned up front (buildPlan) so every player gets exactly the
 * same catchable budget (maxGood) and penalty budget (maxBad) on an identical
 * 4-stage ramp. Only the arrangement is random.
 */
import type { CatchTally, Difficulty, ItemDef, ItemType, SpeedLevel } from '@/types'

/** The canvas palette (from `@/lib/brand`). */
export interface EngineColors {
  primary: string
  primaryEdge: string
  accent: string
  accentInk: string
  onAccent: string
  panel: string
  ink: string
  muted: string
  danger: string
  frost: string
}

/** An item as the engine needs it: `label` is the localised name drawn under the coin. */
export interface EngineItem extends ItemDef {
  label?: string
}

export interface EngineOptions {
  items: EngineItem[]
  duration: number
  maxGood: number
  maxBad: number
  difficulty: Difficulty
  /** 1 = base, 2 = x1.5, 3 = x2 fall speed. */
  speedLevel: SpeedLevel
  colors: EngineColors
  /** Decorative motion off (frost drift, bonus rings, rising floats). */
  reducedMotion: boolean
  /** Every frame: whole seconds left (ceil), the score, and the exact seconds left. */
  onTick: (remainingSeconds: number, score: number, exactRemaining: number) => void
  onEnd: (finalScore: number) => void
}

type Enh = 0 | 1 | 2

interface Falling {
  def: EngineItem
  x: number
  y: number
  vx: number
  vy: number
  r: number
  rot: number
  vrot: number
  /** Enhancement level: 0 normal, 1 = x1.5, 2 = x2. */
  enh: Enh
  /** Exact signed points awarded if caught. */
  value: number
}

interface FloatText {
  text: string
  x: number
  y: number
  ttl: number
  good: boolean
  big: boolean
}

/** A static coin pre-rendered to an offscreen canvas and blitted each frame. */
interface CachedToken {
  canvas: HTMLCanvasElement
  w: number
  h: number
  cx: number
  cy: number
}

/** A pre-planned spawn: which item, its enhancement, exact points, when and how fast. */
interface PlannedSpawn {
  def: EngineItem
  enh: Enh
  value: number
  time: number
  vy: number
}

interface FrostDot {
  x: number
  y: number
  r: number
  v: number
  a: number
}

type HazardGlyph = 'icicle' | 'pinecone' | 'storm'

const MONO = "'JetBrains Mono Variable', ui-monospace, monospace"
const SANS = "'Onest Variable', 'Noto Sans Georgian Variable', system-ui, sans-serif"

/** Weighted pick (weight floor 1), as in the source. */
export function pickWeighted<T extends { weight: number }>(defs: T[]): T {
  const total = defs.reduce((sum, d) => sum + Math.max(1, d.weight), 0)
  let r = Math.random() * total
  for (const d of defs) {
    r -= Math.max(1, d.weight)
    if (r <= 0) return d
  }
  return defs[defs.length - 1] as T
}

/** Which glyph a hazard gets: by name first, else by type. */
export function hazardGlyph(name: string, type: ItemType): HazardGlyph {
  const n = name.toLowerCase()
  if (/pine|cone|გირჩ/.test(n)) return 'pinecone'
  if (/storm|cloud|ქარიშხ|ღრუბ/.test(n)) return 'storm'
  if (/icicle|ice|ლოლუ|ყინ/.test(n)) return 'icicle'
  return type === 'MAJOR' ? 'storm' : 'icicle'
}

export class TovaGame {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private opts: EngineOptions
  private images = new Map<string, HTMLImageElement>()

  private w = 0
  private h = 0
  private dpr = 1

  private items: Falling[] = []
  private floats: FloatText[] = []
  private frost: FrostDot[] = []
  private paddleX = 0
  private targetX = 0
  private paddleW = 100
  private readonly paddleH = 16

  private score = 0
  private elapsed = 0
  private plan: PlannedSpawn[] = []
  private planIdx = 0
  private last = 0
  private raf = 0
  private running = false
  private keys = new Set<string>()
  private observer: ResizeObserver | null = null

  /** What the player caught, keyed by item id, split by enhancement level. */
  private catches = new Map<string, CatchTally>()
  /** Pre-rendered static coins, keyed by `${id}|${enh}|${radius}`. */
  private tokenCache = new Map<string, CachedToken>()
  /** Rolling frame time + adaptive lite flag: drop the costly effects when the device can't keep up. */
  private avgDt = 0.016
  private lite = false

  constructor(canvas: HTMLCanvasElement, opts: EngineOptions) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not available')
    this.ctx = ctx
    this.opts = opts
    this.buildPlan()
    this.preload()
    this.resize()
    this.seedFrost()
    this.paddleX = this.w / 2
    this.targetX = this.w / 2

    window.addEventListener('resize', this.resize)
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.resize())
      this.observer.observe(canvas)
    }
    canvas.addEventListener('pointermove', this.onPointer)
    canvas.addEventListener('pointerdown', this.onPointer)
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('keyup', this.onKeyUp)
    this.draw() // idle frame
  }

  private preload() {
    for (const o of this.opts.items) {
      if (o.imageUrl) {
        const img = new Image()
        img.decoding = 'async'
        img.src = o.imageUrl
        this.images.set(o.id, img)
      }
    }
  }

  private seedFrost() {
    const count = Math.round(Math.min(34, Math.max(14, (this.w * this.h) / 16000)))
    this.frost = Array.from({ length: count }, () => {
      const layer = Math.random()
      return {
        x: Math.random(),
        y: Math.random(),
        r: 1 + layer * 1.6,
        v: 0.012 + layer * 0.03,
        a: 0.14 + layer * 0.2,
      }
    })
  }

  private resize = () => {
    const rect = this.canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    if (Math.abs(rect.width - this.w) < 0.5 && Math.abs(rect.height - this.h) < 0.5 && this.dpr === Math.min(window.devicePixelRatio || 1, 2)) return
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.w = rect.width
    this.h = rect.height
    this.canvas.width = Math.floor(this.w * this.dpr)
    this.canvas.height = Math.floor(this.h * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.paddleW = Math.min(Math.max(this.w * 0.2, 76), 140)
    this.paddleX = Math.min(Math.max(this.paddleX, this.paddleW / 2), this.w - this.paddleW / 2)
    this.targetX = Math.min(Math.max(this.targetX, this.paddleW / 2), this.w - this.paddleW / 2)
    // Token radius scales with width: cached coins are now stale.
    this.tokenCache.clear()
    if (!this.running) this.draw()
  }

  private onPointer = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect()
    this.targetX = e.clientX - rect.left
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      this.keys.add(e.key)
      e.preventDefault()
    }
  }
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key)
  }

  /** Swap the palette (theme flip mid-round). */
  setColors(colors: EngineColors) {
    this.opts = { ...this.opts, colors }
    this.tokenCache.clear()
    if (!this.running) this.draw()
  }

  start() {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }

  destroy() {
    this.running = false
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.resize)
    this.observer?.disconnect()
    this.canvas.removeEventListener('pointermove', this.onPointer)
    this.canvas.removeEventListener('pointerdown', this.onPointer)
    window.removeEventListener('keydown', this.onKey)
    window.removeEventListener('keyup', this.onKeyUp)
  }

  /** The planned catchable / penalty totals (for tests and the dev console). */
  get budget(): { good: number; bad: number; spawns: number } {
    let good = 0
    let bad = 0
    for (const p of this.plan) {
      if (p.value >= 0) good += p.value
      else bad -= p.value
    }
    return { good, bad, spawns: this.plan.length }
  }

  // Build the whole round up front so every player gets the SAME fair budget
  // (exactly maxGood catchable points and maxBad avoidable points) on an
  // identical 4-stage difficulty curve; only the arrangement is random.
  private buildPlan() {
    const { items, duration, maxGood, maxBad, difficulty } = this.opts
    const good = items.filter((o) => o.points > 0)
    const bad = items.filter((o) => o.points < 0)
    const diff = difficulty === 'hard' ? 1.3 : difficulty === 'easy' ? 0.78 : 1
    // Organiser "game speed" lever: 1 = base, 2 = x1.5, 3 = x2 fall speed.
    const speed = this.opts.speedLevel === 3 ? 2 : this.opts.speedLevel === 2 ? 1.5 : 1
    const rnd = Math.random

    const enhFor = (): Enh => {
      const r = rnd()
      if (r < 0.05) return 2
      if (r < 0.18) return 1
      return 0
    }

    // A list whose |value| sums to exactly `budget` (last item trimmed to fit).
    const side = (defs: EngineItem[], budget: number, sign: 1 | -1) => {
      const out: { def: EngineItem; enh: Enh; value: number }[] = []
      if (defs.length === 0 || budget <= 0) return out
      let spent = 0
      let guard = 0
      while (spent < budget && guard++ < 4000) {
        const def = pickWeighted(defs)
        const enh = enhFor()
        const mult = enh === 2 ? 2 : enh === 1 ? 1.5 : 1
        let mag = Math.max(1, Math.round(Math.abs(def.points) * mult))
        if (spent + mag > budget) mag = budget - spent
        out.push({ def, enh, value: sign * mag })
        spent += mag
      }
      return out
    }

    const stages = 4
    const stageLen = duration / stages
    const fallMult = [1, 1.28, 1.6, 2.0] // pressure ramps each stage
    const goodW = [0.3, 0.27, 0.23, 0.2] // points come early
    const badW = [0.1, 0.2, 0.32, 0.38] // danger piles up late
    const baseVy = 140
    const startPad = 0.4
    // Keep spawning almost to the end so the final seconds aren't empty. Late
    // spawns get a fall-speed floor (spawnPlanned) so they still reach the
    // paddle before the round ends and the full budget stays catchable.
    const endPad = Math.min(1.5, duration * 0.04)

    const assign = (list: { def: EngineItem; enh: Enh; value: number }[], weights: number[]): PlannedSpawn[] => {
      const res: PlannedSpawn[] = []
      if (list.length === 0) return res
      const counts = weights.map((w) => Math.round(w * list.length))
      let fix = list.length - counts.reduce((a, b) => a + b, 0)
      for (let i = 0; fix !== 0; i = (i + 1) % counts.length) {
        counts[i] = (counts[i] ?? 0) + (fix > 0 ? 1 : -1)
        fix += fix > 0 ? -1 : 1
      }
      let k = 0
      for (let s = 0; s < stages; s++) {
        const s0 = s * stageLen + startPad
        const s1 = Math.min(duration - endPad, (s + 1) * stageLen)
        const span = Math.max(0.1, s1 - s0)
        for (let c = 0; c < (counts[s] ?? 0) && k < list.length; c++, k++) {
          const item = list[k]!
          res.push({
            def: item.def,
            enh: item.enh,
            value: item.value,
            time: s0 + rnd() * span,
            vy: baseVy * (fallMult[s] ?? 1) * diff * speed * (0.9 + rnd() * 0.25),
          })
        }
      }
      return res
    }

    this.plan = [...assign(side(good, maxGood, 1), goodW), ...assign(side(bad, maxBad, -1), badW)].sort(
      (a, b) => a.time - b.time,
    )
    this.planIdx = 0
  }

  private spawnPlanned(ps: PlannedSpawn) {
    const base = Math.min(Math.max(this.w * 0.055, 18), 32)
    const r = ps.enh ? base * (ps.enh === 2 ? 1.22 : 1.12) : base
    // Floor the fall speed for late spawns so they cross the whole field and
    // reach the paddle before the round ends; otherwise items thrown in the
    // last seconds would be unreachable and the budget couldn't be earned.
    let vy = ps.vy
    const remaining = this.opts.duration - this.elapsed
    if (this.h > 0 && remaining > 0.2) {
      const needed = (this.h + r) / Math.max(0.5, remaining - 0.25)
      vy = Math.min(Math.max(vy, needed), 1600)
    }
    this.items.push({
      def: ps.def,
      x: r + Math.random() * (this.w - 2 * r),
      y: -r,
      vx: (Math.random() - 0.5) * 40,
      vy,
      r,
      rot: 0,
      vrot: (Math.random() - 0.5) * 2,
      enh: ps.enh,
      value: ps.value,
    })
  }

  private loop = (now: number) => {
    if (!this.running) return
    const dt = Math.min((now - this.last) / 1000, 0.05)
    this.last = now

    // Adaptive quality: smooth the frame time and, with hysteresis, drop the
    // costly effects below ~38fps (recover above ~50fps).
    this.avgDt = this.avgDt * 0.9 + dt * 0.1
    if (!this.lite && this.avgDt > 0.026) this.lite = true
    else if (this.lite && this.avgDt < 0.02) this.lite = false

    this.elapsed += dt
    const remaining = Math.max(0, this.opts.duration - this.elapsed)

    // keyboard paddle movement
    const keySpeed = 520
    if (this.keys.has('ArrowLeft')) this.targetX -= keySpeed * dt
    if (this.keys.has('ArrowRight')) this.targetX += keySpeed * dt
    this.targetX = Math.min(Math.max(this.targetX, this.paddleW / 2), this.w - this.paddleW / 2)
    // ease the paddle toward the target
    this.paddleX += (this.targetX - this.paddleX) * Math.min(1, dt * 16)

    // emit planned spawns whose time has come
    while (this.planIdx < this.plan.length && this.plan[this.planIdx]!.time <= this.elapsed) {
      this.spawnPlanned(this.plan[this.planIdx]!)
      this.planIdx++
    }

    this.update(dt)
    this.draw()

    this.opts.onTick(Math.ceil(remaining), this.score, remaining)

    if (remaining <= 0) {
      this.running = false
      cancelAnimationFrame(this.raf)
      this.opts.onEnd(this.score)
      return
    }
    this.raf = requestAnimationFrame(this.loop)
  }

  private update(dt: number) {
    const paddleTop = this.h - 46
    const left = this.paddleX - this.paddleW / 2
    const right = this.paddleX + this.paddleW / 2

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]!
      it.x += it.vx * dt
      it.y += it.vy * dt
      it.rot += it.vrot * dt

      // keep inside horizontally
      if (it.x < it.r) {
        it.x = it.r
        it.vx = Math.abs(it.vx) * 0.4
      } else if (it.x > this.w - it.r) {
        it.x = this.w - it.r
        it.vx = -Math.abs(it.vx) * 0.4
      }

      // paddle collision
      const bottomEdge = it.y + it.r * 0.5
      const inX = it.x >= left - it.r * 0.4 && it.x <= right + it.r * 0.4
      const atPaddle = bottomEdge >= paddleTop && it.y < this.h
      if (inX && atPaddle) {
        this.collect(it)
        this.items.splice(i, 1)
        continue
      }

      // off the bottom: missed
      if (it.y - it.r > this.h) this.items.splice(i, 1)
    }

    // frost dots drift (decorative; still under reduced motion and lite mode)
    if (!this.opts.reducedMotion && !this.lite) {
      for (const d of this.frost) {
        d.y += d.v * dt
        if (d.y > 1.02) {
          d.y = -0.02
          d.x = Math.random()
        }
      }
    }

    // floating texts
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]!
      if (!this.opts.reducedMotion) f.y -= 40 * dt
      f.ttl -= dt
      if (f.ttl <= 0) this.floats.splice(i, 1)
    }
  }

  /** What the player caught this round, by enhancement level. Stored on the Play. */
  getBreakdown(): CatchTally[] {
    return [...this.catches.values()].filter((c) => c.l1 + c.l2 + c.l3 > 0)
  }

  private tally(it: Falling) {
    let c = this.catches.get(it.def.id)
    if (!c) {
      c = { name: it.def.name, type: it.def.type, l1: 0, l2: 0, l3: 0 }
      this.catches.set(it.def.id, c)
    }
    if (it.enh === 2) c.l3++
    else if (it.enh === 1) c.l2++
    else c.l1++
  }

  private collect(it: Falling) {
    const value = it.value
    this.score += value
    this.tally(it)
    const tag = it.enh === 2 ? ' ×2' : it.enh === 1 ? ' ×1.5' : ''
    this.floats.push({
      text: (value >= 0 ? '+' : '−') + Math.abs(value) + tag,
      x: it.x,
      y: it.y,
      ttl: 1,
      good: value >= 0,
      big: it.enh > 0,
    })
  }

  /* ------------------------------------------------------------- drawing */

  private draw() {
    const ctx = this.ctx
    const c = this.opts.colors
    ctx.clearRect(0, 0, this.w, this.h)

    // sparse frost dots over the CSS sky gradient
    ctx.save()
    ctx.fillStyle = c.frost
    for (const d of this.frost) {
      ctx.globalAlpha = d.a
      ctx.beginPath()
      ctx.arc(d.x * this.w, d.y * this.h, d.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // coins: the static token is baked once and blitted; only the bonus ring animates
    for (const it of this.items) {
      const tok = this.getToken(it)
      if (tok) {
        ctx.drawImage(tok.canvas, it.x - tok.cx, it.y - tok.cy, tok.w, tok.h)
      } else {
        ctx.save()
        ctx.translate(it.x, it.y)
        this.paintStatic(it)
        ctx.restore()
      }
      if (it.enh > 0 && !this.lite) {
        ctx.save()
        ctx.translate(it.x, it.y)
        if (it.def.points >= 0) this.drawBonusRing(it.enh, it.r)
        else this.drawThreatRing(it.enh, it.r)
        ctx.restore()
      }
    }

    // "+N x1.5" floats as small chips
    for (const f of this.floats) {
      ctx.save()
      ctx.globalAlpha = Math.max(0, Math.min(1, f.ttl * 1.4))
      const px = f.big ? 18 : 15
      ctx.font = `700 ${px}px ${MONO}`
      const tw = ctx.measureText(f.text).width
      const padX = 7
      const bw = tw + padX * 2
      const bh = px + 10
      const bx = f.x - bw / 2
      const by = f.y - bh / 2
      ctx.fillStyle = f.good ? c.accent : c.danger
      roundRect(ctx, bx, by, bw, bh, 6)
      ctx.fill()
      ctx.fillStyle = f.good ? c.onAccent : c.panel
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(f.text, f.x, f.y + 1)
      ctx.restore()
    }

    this.drawPaddle()
  }

  /** The static coin (art or glyph + ring + label), centred at the current origin. */
  private paintStatic(it: Falling) {
    const ctx = this.ctx
    const c = this.opts.colors
    const R = it.r
    const good = it.def.points >= 0
    const ring = Math.max(2.5, R * 0.12)
    const img = it.def.imageUrl ? this.images.get(it.def.id) : undefined

    // disc
    ctx.beginPath()
    ctx.arc(0, 0, R, 0, Math.PI * 2)
    ctx.fillStyle = c.panel
    ctx.fill()

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(0, 0, R - ring * 0.5, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, -R, -R, R * 2, R * 2)
      ctx.restore()
    } else if (good) {
      // no art: the first letter in display type
      const letter = Array.from((it.def.label ?? it.def.name).trim())[0]?.toUpperCase() ?? '?'
      ctx.fillStyle = c.primary
      ctx.font = `800 ${Math.round(R * 0.95)}px 'Unbounded Variable', ${SANS}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(letter, 0, R * 0.06)
    } else {
      this.drawHazardGlyph(hazardGlyph(it.def.name, it.def.type), R)
    }

    // ring: ink = normal, persimmon = bonus, danger = hazard
    ctx.beginPath()
    ctx.arc(0, 0, R - ring / 2, 0, Math.PI * 2)
    ctx.lineWidth = ring
    ctx.strokeStyle = good ? (it.enh > 0 ? c.accent : c.ink) : c.danger
    ctx.stroke()

    // hazard: diagonal slash with a panel underlay so the glyph stays legible
    if (!good) {
      const k = (R - ring) * 0.72
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-k, k)
      ctx.lineTo(k, -k)
      ctx.strokeStyle = c.panel
      ctx.lineWidth = ring * 1.9
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-k, k)
      ctx.lineTo(k, -k)
      ctx.strokeStyle = c.danger
      ctx.lineWidth = ring * 0.9
      ctx.stroke()
    }

    // bonus tag
    if (good && it.enh > 0) {
      const tag = it.enh === 2 ? '×2' : '×1.5'
      const px = Math.max(9, Math.round(R * 0.42))
      ctx.font = `700 ${px}px ${MONO}`
      const tw = ctx.measureText(tag).width + 8
      const th = px + 5
      ctx.fillStyle = c.accent
      roundRect(ctx, R * 0.35, -R - th * 0.35, tw, th, 4)
      ctx.fill()
      ctx.fillStyle = c.onAccent
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(tag, R * 0.35 + tw / 2, -R - th * 0.35 + th / 2 + 0.5)
    }

    this.drawName(it.def.label ?? it.def.name, R)
  }

  /** The cached static coin, baked on first use (waits for images to decode). */
  private getToken(it: Falling): CachedToken | null {
    const R = it.r
    const key = `${it.def.id}|${it.enh}|${Math.round(R)}`
    const hit = this.tokenCache.get(key)
    if (hit) return hit

    const img = it.def.imageUrl ? this.images.get(it.def.id) : undefined
    if (it.def.imageUrl && !(img && img.complete && img.naturalWidth > 0)) {
      // still loading (or failed): draw live; a failed image falls back to the letter
      if (img && img.complete) this.images.delete(it.def.id)
      else return null
    }

    const raw = it.def.label ?? it.def.name ?? ''
    const label = raw.length > 16 ? `${raw.slice(0, 15)}…` : raw
    const fontPx = Math.max(10, Math.round(R * 0.44))
    this.ctx.save()
    this.ctx.font = `600 ${fontPx}px ${SANS}`
    const nameW = label ? this.ctx.measureText(label).width : 0
    this.ctx.restore()

    const pad = Math.ceil(R * 0.7) + 6
    const nameH = label ? Math.ceil(fontPx * 1.4) : 0
    const halfW = Math.max(R + pad, nameW / 2 + 6)
    const topExtent = R + pad
    const bottomExtent = Math.max(R + pad, R + 6 + nameH + 4)
    const W = Math.ceil(halfW * 2)
    const H = Math.ceil(topExtent + bottomExtent)
    const cx = W / 2
    const cy = Math.ceil(topExtent)

    const off = document.createElement('canvas')
    off.width = Math.max(1, Math.ceil(W * this.dpr))
    off.height = Math.max(1, Math.ceil(H * this.dpr))
    const octx = off.getContext('2d')
    if (!octx) return null
    octx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    octx.translate(cx, cy)

    // paintStatic draws through this.ctx: swap it for the bake (synchronous).
    const real = this.ctx
    this.ctx = octx
    this.paintStatic(it)
    this.ctx = real

    const tok: CachedToken = { canvas: off, w: W, h: H, cx, cy }
    this.tokenCache.set(key, tok)
    return tok
  }

  private drawHazardGlyph(kind: HazardGlyph, R: number) {
    const ctx = this.ctx
    const s = R / 28
    ctx.save()
    ctx.fillStyle = this.opts.colors.danger
    ctx.strokeStyle = this.opts.colors.danger
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    if (kind === 'icicle') {
      // a ledge with three hanging spikes
      ctx.beginPath()
      ctx.moveTo(-15 * s, -12 * s)
      ctx.lineTo(15 * s, -12 * s)
      ctx.lineTo(11 * s, -6 * s)
      ctx.lineTo(7 * s, 6 * s)
      ctx.lineTo(4 * s, -5 * s)
      ctx.lineTo(1 * s, 16 * s)
      ctx.lineTo(-3 * s, -5 * s)
      ctx.lineTo(-6 * s, 4 * s)
      ctx.lineTo(-9 * s, -6 * s)
      ctx.closePath()
      ctx.fill()
    } else if (kind === 'pinecone') {
      // scaled cone with a stem
      ctx.lineWidth = Math.max(1.4, 1.8 * s)
      ctx.beginPath()
      ctx.ellipse(0, 3 * s, 9 * s, 13 * s, 0, 0, Math.PI * 2)
      ctx.globalAlpha = 0.22
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.stroke()
      for (const yy of [-4, 2, 8, 13]) {
        const half = yy > 10 ? 4 : 7
        ctx.beginPath()
        ctx.moveTo(-half * s, (yy - 3) * s)
        ctx.lineTo(0, yy * s)
        ctx.lineTo(half * s, (yy - 3) * s)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(0, -10 * s)
      ctx.lineTo(2 * s, -15 * s)
      ctx.stroke()
    } else {
      // storm cloud with a bolt
      ctx.lineWidth = Math.max(1.4, 1.8 * s)
      ctx.beginPath()
      ctx.arc(-7 * s, -2 * s, 6.5 * s, Math.PI * 0.5, Math.PI * 1.5)
      ctx.arc(1 * s, -7 * s, 8 * s, Math.PI * 1.05, Math.PI * 1.95)
      ctx.arc(8 * s, -1 * s, 5.5 * s, Math.PI * 1.5, Math.PI * 0.5)
      ctx.closePath()
      ctx.globalAlpha = 0.22
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(2 * s, 5 * s)
      ctx.lineTo(-3 * s, 12 * s)
      ctx.lineTo(1 * s, 12 * s)
      ctx.lineTo(-2 * s, 19 * s)
      ctx.lineTo(5 * s, 10 * s)
      ctx.lineTo(1 * s, 10 * s)
      ctx.lineTo(4 * s, 5 * s)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }

  /** Bonus coin: a slow persimmon ring that breathes outside the coin (no glow). */
  private drawBonusRing(level: number, R: number) {
    if (this.opts.reducedMotion) return
    const ctx = this.ctx
    const t = this.elapsed
    const pulse = 0.5 + 0.5 * Math.sin(t * 5)
    ctx.save()
    ctx.strokeStyle = this.opts.colors.accent
    ctx.lineWidth = level === 2 ? 2.4 : 1.8
    ctx.globalAlpha = 0.35 + pulse * 0.5
    ctx.setLineDash([5, 5])
    ctx.rotate(t * (level === 2 ? 1.1 : 0.7))
    ctx.beginPath()
    ctx.arc(0, 0, R + 5 + pulse * 2, 0, Math.PI * 2)
    ctx.stroke()
    if (level === 2) {
      ctx.setLineDash([])
      ctx.globalAlpha = 0.25 + pulse * 0.3
      ctx.beginPath()
      ctx.arc(0, 0, R + 11 + pulse * 2, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }

  /** Enhanced hazard: an expanding danger ripple. */
  private drawThreatRing(level: number, R: number) {
    if (this.opts.reducedMotion) return
    const ctx = this.ctx
    const cycle = (this.elapsed % 1.1) / 1.1
    ctx.save()
    ctx.strokeStyle = this.opts.colors.danger
    ctx.lineWidth = 2
    ctx.globalAlpha = (1 - cycle) * (level === 2 ? 0.7 : 0.45)
    ctx.beginPath()
    ctx.arc(0, 0, R + 3 + cycle * (level === 2 ? 22 : 14), 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  private drawName(name: string, R: number) {
    if (!name) return
    const ctx = this.ctx
    const label = name.length > 16 ? `${name.slice(0, 15)}…` : name
    ctx.save()
    ctx.font = `600 ${Math.max(10, Math.round(R * 0.44))}px ${SANS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 3
    ctx.strokeStyle = this.opts.colors.panel
    ctx.strokeText(label, 0, R + 6)
    ctx.fillStyle = this.opts.colors.ink
    ctx.fillText(label, 0, R + 6)
    ctx.restore()
  }

  /** A flat glacier paddle with a persimmon centre notch. */
  private drawPaddle() {
    const ctx = this.ctx
    const c = this.opts.colors
    const y = this.h - 46
    const w = this.paddleW
    const x = this.paddleX - w / 2
    const h = this.paddleH
    ctx.save()
    // darker bottom edge, like the arcade keys
    ctx.fillStyle = c.primaryEdge
    roundRect(ctx, x, y + 3, w, h, 8)
    ctx.fill()
    ctx.fillStyle = c.primary
    roundRect(ctx, x, y, w, h, 8)
    ctx.fill()
    // persimmon notch
    const nw = Math.max(14, w * 0.16)
    ctx.fillStyle = c.accent
    roundRect(ctx, this.paddleX - nw / 2, y - 2, nw, 7, 3)
    ctx.fill()
    ctx.restore()
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}
