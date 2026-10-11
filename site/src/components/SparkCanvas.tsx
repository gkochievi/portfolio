import { useEffect, useRef } from 'react'

// Spark burst — the click feedback boulder.ge uses everywhere, ported from
// its effects/sparkBurst.js + components/SparkCanvas.jsx with the physics
// and shapes verbatim: click somewhere, small hand-drawn shapes scatter
// outward, stall at a radius, hang for a beat, then drop with gravity. One
// canvas + one delegated, capture-phase `pointerdown` listener on `document`
// covers every button and link on the page — nothing is wired per component.
//
// Mounted once, near the root. The only thing the theme changes is the
// particle colour, so the component watches `data-theme` on <html> and swaps
// it live rather than keeping two configs.

const DARK_COLOR = '#dfdef8'
const BRIGHT_COLOR = '#5f4cf0'

type Range = [number, number]

type ShapeDef = {
  name: string
  vb: [number, number, number, number]
  d: string
  align?: boolean
}

type Shape = ShapeDef & { path: Path2D; norm: number; cx: number; cy: number }

type SparkConfig = {
  count: Range
  speed: Range
  size: Range
  radius: Range
  hang: Range
  swap: Range
  spin: Range
  spawnOffset: Range
  drag: number
  gravity: number
  fallDrag: number
  stallSpeed: number
  swapPunch: number
  color: string | string[]
  enabled: number[]
  maxParticles: number
  originSelector: string
}

type Particle = {
  ox: number
  oy: number
  x: number
  y: number
  vx: number
  vy: number
  size: number
  limit: number
  hang: number
  spin: number
  rot: number
  heading: number
  shape: number
  color: string
  swapEvery: number
  swapIn: number
  punch: number
  phase: number // 0 burst, 1 hang, 2 fall
  timer: number
}

// ── Shapes — six hand-drawn marks, each normalized from its own viewBox so
// different aspect ratios all render at a consistent visual size. `align`
// points a shape along its direction of travel instead of spinning freely
// (used for the long stroke mark).
const SHAPES: ShapeDef[] = [
  {
    name: 'circle',
    vb: [0, 0, 100, 100.14],
    d: 'M81.91,80.08c-17.47,17.29-41.21,25.17-67.39,16.55C3.9,93.13,1.02,75.06.74,63.29c-.18-7.4-1.61-14.79.06-22.02l7.93-18.93c6.2-4.97,11.13-10.74,18.74-14.42C38.64,2.53,51.93.32,65.02,0c10.32-.25,18.91,5.14,21.91,12.76,8.83,3.86,5.4,11.94,11.16,13.87,4.98,17.17.02,34.25-12.68,48.33-1.32,1.47-1.78,3.39-3.51,5.1ZM44.46,85.72c23.73-4.83,41.12-27.54,41.95-48.2.3-7.4-3.52-13.9-9.07-19.73l-2.15-5.13c-3.1-.11-5.08-2.85-7.53-3.85-15.54-2.22-32.22,3.42-40.85,14.15-9.18,11.43-9.74,23.22-9.64,36.43-1.69,3.92-1.13,10.16,2.37,13.9,4.19,4.47,5.43,11.62,13.06,14.84l11.86-2.41Z',
  },
  {
    name: 'ex',
    vb: [0, 0, 100, 99.99],
    d: 'M90.75,91.94c-1.77,1.14-6.62,2.7-7.32,4.69l-2.48,1.19v1.96c-2.05.74-4.52-.47-5.94-1.89-10.27-10.33-17.98-21.21-26.91-32.86l-25.47,26.57c-2.31,2.41-5.18,4.12-8.92,5.42-1.2,1.39-3.08,2.17-4.79,2.56-7.89,1.81-6.5-11.22-.47-16.34l5.87-4.99c3.97-3.37,7.97-6.68,12.03-10.12l14.15-12.01-22.24-25.81C11.25,22.16,5.01,14.14.86,4.94.22,3.52-.99.77,1.54,0c1.34.34,3.74,1.32,6.18.28l13.13,10.62c3.21,2.59,4.48,6.56,8.77,8.4,3.17,1.36,4.96,2.69,4.12,5.42,3.1-.08,3.62,1.78,4.89,2.98,5.35,5.08,12.09,8.99,15.72,14.89,5.84-3.9,9.02-8.22,14.25-12.12l20.3-15.12c2.83-2.11,7.47-3.2,11.11-1.73l-14.11,13.23-23.65,24.06c2.17,2,1.73,4.59-.97,7.22,9.8,8.72,18.22,17.83,25.61,27.7,1.12,1.49,6.1,3.56,3.87,6.12Z',
  },
  {
    name: 'square',
    vb: [0, 0, 100, 100],
    d: 'M88.88,95.81l-41.39,3.09c-14.27,1.06-28,1.5-42.05.66-1.94-5.02-1.25-9.92-1.25-15.17l-.03-35.08c-.02-16.82-6.34-40.66-3.35-42.4C14.87-1.28,49.56,4.37,70.64.7c7.04-1.23,13.65-1.03,19.93,2.13.5,2.51.98,4.56.61,7.49-.45-.86-.79-2.24-2.53-2.18,2.7,15.08,5.23,29.53,6.03,44.71l.77,14.71c.04.73,1.84,1,2.69.71l1.82,14.83c.57,4.65-4.99,12.26-11.08,12.72ZM52.76,88.57c11.03-.6,20.69-2.76,31.34-1.15-.79-3.75,1.31-5.61,3.5-7.4l-1.27-30.49c-.56-13.51-2.3-26.2-6.71-39.16-19.67-1.42-40.26,1.68-59.7,1.08-1.96-.06-4.41.85-5.92,2.27,3.23,19.53,3.94,39.3,3.68,59.23-.05,4,.44,6.94-.65,10.74-.58,2.03.82,5,.99,6.77l34.74-1.89Z',
  },
  {
    name: 'stroke',
    vb: [0, 0, 118.71, 30.02],
    align: true,
    d: 'M118.36,11.96c-10.02-3.41-20.47-5.9-30.9-8.17-.31-.06-.46.32-.17.43,2.3.93,4.61,1.83,6.9,2.77.01.01.02.01.03.02.31.18,1.85.72,1.53,1.07-.78,1.25-1.65,1.58-2.61,1.49-.28-.02-.4.31-.15.43.22.1.43.21.65.32.11.06.15.19.1.29-.43.85-1.63,1.82-2.7,1.3-.02,0-.03-.01-.04-.01-5.8-1.7-11.79-2.93-17.76-4.14-.32-.06-.46.34-.15.44,6.43,2.04,12.86,4.18,18.71,7.28.62.34,1.2.57,1.39,1.23.01.05,0,.1-.02.14-1.22,2.54-3.78,1.9-6.2,1.11-15.13-4.42-30.68-8.2-46.77-8.44-.31,0-.37.39-.06.45,11.92,2.4,52.28,13.36,41.44,19.54-.02.01-.03.01-.04.02-.98.85-2.28.39-3.41.08-.02,0-.03-.01-.04-.01C53.77,19.43,27.13,15.55.27,16.53c-.32.01-.37-.4-.06-.45,25.81-4.57,51.98.95,75.96,9.66.29.1.51-.24.26-.4-13.69-8.54-30.64-12.28-46.92-15.18-.01,0-.03-.01-.04-.02-.65-.23-3.16.05-2.9-.8.43-.59,1.02-1.18,1.75-1.48.03-.01.07-.01.1-.02,17.75-.97,35.4,1.28,52.28,5.98.32.09.49-.31.19-.42-7.48-2.87-15.19-5.3-23.01-7.33h-.01c-2.13-.74-6.04-.51-2.45-2.78.05-.03.1-.05.16-.05,8.46,0,16.86,2.36,25.11,4.06.3.06.46-.3.19-.43-2.24-1.05-4.52-2.04-6.9-2.82h.01c-.16-.3,1.19-1.34,1.37-1.42.11-.06.28-.08.49-.07.29.01.39-.33.12-.43l-.96-.39c-.13-.05-.18-.19-.12-.31.24-.46,1.2-1.22,1.61-1.37.05-.02.09-.02.14-.02-.02-.02-.05-.03-.07-.04.3,0,.6.04.88.13.28.09,10.38,1.69,11.47,1.88.28.05.55.1.82.16.16.03,7.79,1.86,8.02,1.92,7.19,1.91,14.43,4.01,20.83,7.47.27.14.06.5-.23.4Z',
  },
  {
    name: 'tick',
    vb: [0, 0, 100, 100],
    d: 'M0,29.46c11.46,2.32,13.44.25,15.18,5.57l8.67,26.45c1.02,3.1,3.09,5.47,7.78,5.9l13.71-22.57c4.11-6.76,9.61-10.42,12.59-16.05,3.43-6.47,11.94-11.07,17.28-16.56l7.13-7.33c3.8-3.91,14.63-6.9,17.56-3.2,1.25,1.58-13.22,13.59-20.74,24.74l-7.67,8.58-16.16,25.36-14.48,31.57-9.28,5.56c-2.87,1.72-7.98,2.1-11.65,2.5-5.77-7.24-7.45-14.54-9.89-22.22C5.02,61.99.06,46.69,0,29.46Z',
  },
  {
    name: 'triangle',
    vb: [0, 0, 100, 100],
    d: 'M60.09,94.07c-15.33,1.42-29.24,3.85-43.64,5.81l-15.23.12c-4.23-20.18,3.51-22.13,9.15-31.25l5.02-8.11,11.12-19.48c2.49-4.37,5.26-7.87,7.3-12.7,1.89-4.46,7.43-8.97,6.75-14.5-.58-4.74-3.34-9.19-1.46-13.98,5.26.95,13.2,3.02,15.64,8.47,1.3,2.89-.27,6.82,1.77,9.52l22.7,30.06c5.56,7.37,9.96,11.96,15.55,22.26,1.48,2.73,5.73,4.03,5.19,7.8-1.28,8.99-4.04,7.25-8.99,13.11l-30.88,2.85ZM64.6,82.52c6.07-.34,11.36-1.59,17.22-.19.74-6.48-1.79-10.95-4.78-15.71-7.09-11.28-14.13-22.05-22.01-32.8-2.36-3.22-3.62-6.96-7.49-9.08l-23.79,43.47c-3.1,5.66-6.23,11.1-5.78,17.84,4.15,1.64,8.05-1.4,12.04-1.62l34.58-1.92Z',
  },
]
// Path2D is built once, on first use (never at import, so a non-browser
// import of this module costs nothing).
let prepared: Shape[] | null = null
function preparedShapes(): Shape[] {
  if (!prepared) {
    prepared = SHAPES.map((s) => {
      const [x, y, w, h] = s.vb
      return { ...s, path: new Path2D(s.d), norm: 1 / Math.max(w, h), cx: x + w / 2, cy: y + h / 2 }
    })
  }
  return prepared
}

// boulder.ge's "bright mode" CONFIG verbatim; setColor() swaps only the
// colour when the theme flips (the two configs differed in nothing else).
const DEFAULT_CONFIG: SparkConfig = {
  count: [6, 12],
  speed: [414, 798],
  size: [6, 15],
  radius: [111, 230],
  hang: [9, 33],
  swap: [32, 69],
  spin: [-13.0, 13.0],
  spawnOffset: [4, 16],
  drag: 0.9,
  gravity: 6000,
  fallDrag: 0.985,
  stallSpeed: 40,
  swapPunch: 1.3,
  color: BRIGHT_COLOR,
  enabled: [0, 1, 2, 3, 4, 5],
  maxParticles: 600,
  originSelector: 'button, a, [role="button"], input[type="submit"], .spark-origin',
}

// A finger is not a click until it lets go without travelling: every phone
// flick begins with a pointerdown, and bursting on it spent the first second
// of every scroll animating a full-screen canvas. Mouse and pen still fire
// on DOWN, where press feedback belongs.
const TOUCH_SLOP = 10

type SparkBurst = { setColor: (color: string) => void; destroy: () => void }

function createSparkBurst(canvas: HTMLCanvasElement, overrides: Partial<SparkConfig> = {}): SparkBurst | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const CONFIG: SparkConfig = { ...DEFAULT_CONFIG, ...overrides }
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const SHAPES_READY = preparedShapes()

  let W = 0
  let H = 0
  let dpr = 1
  let particles: Particle[] = []
  let pool: Particle[] = []
  let running = false
  let last = 0
  let raf = 0
  let touchStart: { id: number; x: number; y: number } | null = null

  const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
  const pickShape = () => {
    const e = CONFIG.enabled
    return e.length ? e[(Math.random() * e.length) | 0] : 0
  }
  const pickColor = () =>
    Array.isArray(CONFIG.color) ? CONFIG.color[(Math.random() * CONFIG.color.length) | 0] : CONFIG.color

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    W = window.innerWidth
    H = window.innerHeight
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function spawn(ox: number, oy: number) {
    if (reduced || !CONFIG.enabled.length) return

    const n = Math.round(rand(CONFIG.count[0], CONFIG.count[1]))
    for (let i = 0; i < n; i++) {
      if (particles.length >= CONFIG.maxParticles) break

      const p = pool.pop() ?? ({} as Particle)
      const angle = Math.random() * Math.PI * 2
      const off = rand(CONFIG.spawnOffset[0], CONFIG.spawnOffset[1])
      const spd = rand(CONFIG.speed[0], CONFIG.speed[1])

      p.ox = ox
      p.oy = oy
      p.x = ox + Math.cos(angle) * off
      p.y = oy + Math.sin(angle) * off
      p.vx = Math.cos(angle) * spd
      p.vy = Math.sin(angle) * spd
      p.size = rand(CONFIG.size[0], CONFIG.size[1])
      p.limit = rand(CONFIG.radius[0], CONFIG.radius[1])
      p.hang = rand(CONFIG.hang[0], CONFIG.hang[1]) / 1000
      p.spin = rand(CONFIG.spin[0], CONFIG.spin[1])
      p.rot = Math.random() * Math.PI * 2
      p.heading = angle
      p.shape = pickShape()
      p.color = pickColor()
      p.swapEvery = rand(CONFIG.swap[0], CONFIG.swap[1]) / 1000
      p.swapIn = p.swapEvery
      p.punch = 1
      p.phase = 0
      p.timer = 0

      particles.push(p)
    }
    start()
  }

  function step(dt: number) {
    const dragStep = Math.pow(CONFIG.drag, dt * 60)
    const fallStep = Math.pow(CONFIG.fallDrag, dt * 60)

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]

      p.swapIn -= dt
      if (p.swapIn <= 0) {
        const e = CONFIG.enabled
        let next = pickShape()
        if (e.length > 1 && next === p.shape) next = e[(e.indexOf(next) + 1) % e.length]
        p.shape = next
        p.punch = CONFIG.swapPunch
        p.swapIn = p.swapEvery
      }
      p.punch += (1 - p.punch) * Math.min(1, dt * 18)

      if (p.phase === 0) {
        p.vx *= dragStep
        p.vy *= dragStep
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.rot += p.spin * dt
        p.heading = Math.atan2(p.vy, p.vx)

        const reached = Math.hypot(p.x - p.ox, p.y - p.oy) >= p.limit
        const stalled = Math.hypot(p.vx, p.vy) < CONFIG.stallSpeed
        if (reached || stalled) {
          p.phase = 1
          p.timer = p.hang
          p.vx = 0
          p.vy = 0
        }
      } else if (p.phase === 1) {
        p.rot += p.spin * 0.25 * dt
        p.timer -= dt
        if (p.timer <= 0) p.phase = 2
      } else {
        p.vy += CONFIG.gravity * dt
        p.vx *= fallStep
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.rot += p.spin * 1.4 * dt
        p.heading = Math.atan2(p.vy, p.vx)

        if (p.y - p.size > H) {
          particles.splice(i, 1)
          pool.push(p)
        }
      }
    }
  }

  function draw() {
    ctx!.clearRect(0, 0, W, H)
    for (const p of particles) {
      const sh = SHAPES_READY[p.shape]
      const k = p.size * p.punch * sh.norm
      ctx!.save()
      ctx!.translate(p.x, p.y)
      ctx!.rotate(sh.align ? p.heading : p.rot)
      ctx!.scale(k, k)
      ctx!.translate(-sh.cx, -sh.cy)
      ctx!.fillStyle = p.color
      ctx!.fill(sh.path)
      ctx!.restore()
    }
  }

  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05) // clamp for tab switches
    last = now
    step(dt)
    draw()

    if (particles.length) raf = requestAnimationFrame(frame)
    else {
      running = false
      raf = 0
      ctx!.clearRect(0, 0, W, H)
    }
  }

  function start() {
    if (running) return
    running = true
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  // Buttons and links burst from their own centre, empty space at the
  // cursor. `[data-no-sparks]` opts a subtree out.
  function burstAt(e: PointerEvent) {
    const t = e.target instanceof Element ? e.target : null
    if (t?.closest('[data-no-sparks]')) return
    let x = e.clientX
    let y = e.clientY
    const origin = t?.closest(CONFIG.originSelector)
    if (origin) {
      const r = origin.getBoundingClientRect()
      x = r.left + r.width / 2
      y = r.top + r.height / 2
    }
    spawn(x, y)
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    if (e.pointerType === 'touch') {
      touchStart = { id: e.pointerId, x: e.clientX, y: e.clientY }
      return
    }
    burstAt(e)
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerType !== 'touch' || !touchStart || touchStart.id !== e.pointerId) return
    const moved = Math.hypot(e.clientX - touchStart.x, e.clientY - touchStart.y)
    touchStart = null
    if (moved <= TOUCH_SLOP) burstAt(e)
  }

  function onPointerCancel(e: PointerEvent) {
    if (touchStart && touchStart.id === e.pointerId) touchStart = null
  }

  window.addEventListener('resize', resize)
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('pointerup', onPointerUp, true)
  document.addEventListener('pointercancel', onPointerCancel, true)
  resize()

  return {
    setColor(color: string) {
      CONFIG.color = color
    },
    destroy() {
      window.removeEventListener('resize', resize)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('pointercancel', onPointerCancel, true)
      cancelAnimationFrame(raf)
      particles = []
      pool = []
    },
  }
}

const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark'

export default function SparkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const spark = createSparkBurst(canvas, { color: isDark() ? DARK_COLOR : BRIGHT_COLOR })
    if (!spark) return undefined

    const observer = new MutationObserver(() => {
      spark.setColor(isDark() ? DARK_COLOR : BRIGHT_COLOR)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      observer.disconnect()
      spark.destroy()
    }
  }, [])

  return <canvas ref={canvasRef} className="spark-canvas" aria-hidden="true" />
}

export { SparkCanvas }
