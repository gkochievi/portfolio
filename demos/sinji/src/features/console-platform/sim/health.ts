/**
 * The server-health simulator: a deterministic function of time (seeded
 * sinusoids for the working day plus hashed noise), so the same range always
 * draws the same history and a new point simply extends it. Pure: no store, no
 * bus; the handler and the live ticker feed it context.
 */
import type { DemoDb, HealthRange, HealthSample, TenantLoad } from '@/types'

export const RANGE_SPEC: Record<HealthRange, { ms: number; step: number }> = {
  '1h': { ms: 3_600_000, step: 15_000 },
  '6h': { ms: 21_600_000, step: 60_000 },
  '24h': { ms: 86_400_000, step: 300_000 },
  '7d': { ms: 604_800_000, step: 1_800_000 },
  '30d': { ms: 2_592_000_000, step: 7_200_000 },
}

export const RANGES: HealthRange[] = ['1h', '6h', '24h', '7d', '30d']

export const BOOT_AT = Date.now()
const REF = Date.UTC(2026, 8, 1)
const BASE_UPTIME_S = 12.4 * 86_400

function hash(n: number, salt: number): number {
  let x = (Math.imul(n | 0, 374761393) + Math.imul(salt | 0, 668265263)) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

const noise = (t: number, salt: number, bucket = 15_000): number => hash(Math.floor(t / bucket), salt) * 2 - 1

/** 0..1 working-day load in Tbilisi time (UTC+4), lighter at weekends. */
function dayCurve(t: number): number {
  const hour = (t / 3_600_000 + 4) % 24
  const morning = Math.exp(-(((hour - 11.5) / 3.3) ** 2))
  const afternoon = 0.85 * Math.exp(-(((hour - 15.5) / 2.8) ** 2))
  const evening = 0.25 * Math.exp(-(((hour - 20) / 2.5) ** 2))
  const dow = Math.floor(t / 86_400_000 + 4) % 7
  const weekend = dow === 0 || dow === 6 ? 0.5 : 1
  return Math.min(1, (morning + afternoon + evening) * weekend)
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100

export interface SampleContext {
  /** Jobs running right now (recordings being transcribed or analysed). */
  jobsNow: number
}

export function sampleAt(t: number, ctx: SampleContext = { jobsNow: 0 }, now = Date.now()): HealthSample {
  const day = dayCurve(t)
  const wave = Math.sin(t / 1_020_000)
  const cpu = clamp(14 + 34 * day + 5 * wave + noise(t, 1) * 4.5, 3, 97)
  const memTotal = 16384
  const memUsed = clamp(8900 + 1500 * day + 260 * Math.sin(t / 21_600_000) + noise(t, 2) * 90, 4000, memTotal - 300)
  const swap = clamp(180 + 90 * day + noise(t, 3) * 25, 0, 2048)
  const grow = Math.max(0, (t - REF) / 86_400_000)
  const mounts = [
    { mount: '/', total_gb: 120, used_gb: 54.2 + grow * 0.06 },
    { mount: '/var/lib/postgresql', total_gb: 500, used_gb: 188 + grow * 0.35 },
    { mount: '/srv/media', total_gb: 1000, used_gb: 412 + grow * 1.1 },
  ].map((d) => ({ ...d, used_gb: r1(d.used_gb), pct: r1((d.used_gb / d.total_gb) * 100) }))
  const audio = Math.max(0, noise(t, 4) + 0.15) * (0.5 + day)
  const live = Math.abs(t - now) < 20_000 ? ctx.jobsNow : 0
  const jobs = Math.max(0, Math.round(day * 3.2 + Math.max(0, noise(t, 5)) * 2.2)) + live
  const poolSize = 20
  return {
    ts: new Date(t).toISOString(),
    cpu_pct: r1(cpu),
    load1: r2(clamp((cpu / 100) * 3.6 + noise(t, 6) * 0.25, 0.05, 12)),
    mem_used_mb: Math.round(memUsed),
    mem_total_mb: memTotal,
    swap_used_mb: Math.round(swap),
    disk: mounts,
    disk_read_mbs: r1(clamp(1.8 + 14 * audio + noise(t, 7) * 0.8, 0.1, 140)),
    disk_write_mbs: r1(clamp(1.2 + 9 * audio + noise(t, 8) * 0.6, 0.1, 120)),
    net_in_mbs: r2(clamp(0.35 + 2.6 * day + 1.8 * audio + noise(t, 9) * 0.2, 0.02, 80)),
    net_out_mbs: r2(clamp(0.6 + 4.1 * day + 2.2 * audio + noise(t, 10) * 0.3, 0.02, 90)),
    api_rss_mb: Math.round(clamp(740 + 130 * day + 40 * Math.sin(t / 7_200_000) + noise(t, 11) * 12, 300, 4000)),
    api_cpu_pct: r1(clamp(cpu * 0.52 + noise(t, 12) * 2, 1, 95)),
    db_size_mb: Math.round(4180 + grow * 14 + noise(t, 13, 3_600_000) * 2),
    db_pool_used: Math.round(clamp(2 + 7 * day + noise(t, 14) * 1.8 + live * 0.5, 0, poolSize)),
    db_pool_size: poolSize,
    active_jobs: jobs,
    uptime_s: Math.round(BASE_UPTIME_S + (t - BOOT_AT) / 1000),
  }
}

/** The grid of points for one range, ending with a point at `now`. */
export function seriesFor(range: HealthRange, ctx: SampleContext, now = Date.now()): HealthSample[] {
  const { ms, step } = RANGE_SPEC[range]
  const start = Math.ceil((now - ms) / step) * step
  const points: HealthSample[] = []
  for (let t = start; t < now - step / 3; t += step) points.push(sampleAt(t, ctx, now))
  points.push(sampleAt(now, ctx, now))
  return points
}

/* ------------------------------------------------------------ workspace load */

/** Per-workspace load for a range, derived from usage rows and recordings plus a quiet baseline. */
export function tenantLoads(db: DemoDb, range: HealthRange, now = Date.now()): TenantLoad[] {
  const { ms } = RANGE_SPEC[range]
  const since = now - ms
  const hours = ms / 3_600_000
  const minuteBucket = Math.floor(now / 60_000)
  const rows = db.tenants.map((tenant, idx) => {
    const usage = db.llmUsage.filter((u) => u.client_id === tenant.id && Date.parse(u.created_at) >= since)
    const recs = db.recordings.filter((r) => r.client_id === tenant.id && Date.parse(r.created_at) >= since)
    const audio = recs.filter((r) => r.source === 'audio')
    const weight = tenant.is_active ? 1 + tenant.users * 0.35 + tenant.documents * 0.04 : 0.05
    const flutter = 0.92 + hash(minuteBucket, idx + 40) * 0.16
    const baseline = Math.round(9 * weight * hours * flutter)
    const requests = baseline + usage.length * 3 + recs.length * 6
    const failed = usage.filter((u) => !u.ok).length
    const errors = failed + Math.round(requests * 0.004 * (0.6 + hash(idx, 77)))
    const latencies = usage.map((u) => u.latency_ms)
    const avgUsage = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0
    const avg = Math.round(96 + 70 * hash(idx, 91) + Math.min(avgUsage, 1500) * 0.18)
    const audioMs = audio.reduce((sum, r) => sum + (r.duration_s ?? 0) * 1000, 0)
    return {
      client_id: tenant.id,
      requests,
      errors,
      avg_ms: avg,
      max_ms: Math.round(avg * (6 + 4 * hash(idx, 92)) + (latencies.length ? Math.max(...latencies) * 0.4 : 0)),
      bytes_in: Math.round(requests * 1800 + audioMs * 16),
      bytes_out: Math.round(requests * 5200),
      ai_calls: usage.length,
      ai_tokens: usage.reduce((sum, u) => sum + u.total_tokens, 0),
      audio_jobs: audio.length,
      audio_ms: Math.round(audioMs),
      score: requests + usage.length * 20 + audio.length * 100,
    }
  })
  const total = rows.reduce((sum, r) => sum + r.score, 0) || 1
  return rows.map(({ score, ...row }) => ({ ...row, load_share_pct: r1((score / total) * 100) }))
}
