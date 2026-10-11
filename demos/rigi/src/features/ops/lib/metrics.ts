/**
 * System-health history metrics and ranges. Pure constants shared by the
 * mock handler (series generator) and the UI (metric picker).
 */
import type { HealthDependency } from '@/types'

export type MetricUnit = 'load' | 'bytes' | 'ms' | 'up' | 'count'

export interface MetricDef {
  key: string
  unit: MetricUnit
  /** Typical value. */
  base: number
  /** Amplitude of the daily sine, as a fraction of base. */
  daily: number
  /** Noise, as a fraction of base. */
  noise: number
  /** Spikes during incidents of this dependency. */
  dependency?: HealthDependency
}

const MB = 1024 * 1024
const GB = 1024 * MB

export const HEALTH_METRICS: MetricDef[] = [
  { key: 'cpu.load1', unit: 'load', base: 0.62, daily: 0.45, noise: 0.35 },
  { key: 'cpu.load5', unit: 'load', base: 0.58, daily: 0.4, noise: 0.18 },
  { key: 'cpu.load15', unit: 'load', base: 0.55, daily: 0.35, noise: 0.08 },
  { key: 'mem.process_rss_bytes', unit: 'bytes', base: 312 * MB, daily: 0.06, noise: 0.03 },
  { key: 'mem.heap_used_bytes', unit: 'bytes', base: 148 * MB, daily: 0.12, noise: 0.08 },
  { key: 'mem.system_free_bytes', unit: 'bytes', base: 5.6 * GB, daily: 0.08, noise: 0.03 },
  { key: 'eventloop.lag_p50_ms', unit: 'ms', base: 1.3, daily: 0.2, noise: 0.25 },
  { key: 'eventloop.lag_p99_ms', unit: 'ms', base: 9.5, daily: 0.3, noise: 0.45 },
  { key: 'disk.free_bytes', unit: 'bytes', base: 61 * GB, daily: 0.004, noise: 0.002 },
  { key: 'dep.postgres.latency_ms', unit: 'ms', base: 3.2, daily: 0.25, noise: 0.3, dependency: 'postgres' },
  { key: 'dep.jobqueue.latency_ms', unit: 'ms', base: 6.5, daily: 0.2, noise: 0.3, dependency: 'jobqueue' },
  { key: 'dep.smtp.latency_ms', unit: 'ms', base: 88, daily: 0.15, noise: 0.25, dependency: 'smtp' },
  { key: 'dep.imap.latency_ms', unit: 'ms', base: 142, daily: 0.15, noise: 0.25, dependency: 'imap' },
  { key: 'dep.attachments.latency_ms', unit: 'ms', base: 1.8, daily: 0.1, noise: 0.3, dependency: 'attachments' },
  { key: 'dep.postgres.up', unit: 'up', base: 1, daily: 0, noise: 0, dependency: 'postgres' },
  { key: 'dep.jobqueue.up', unit: 'up', base: 1, daily: 0, noise: 0, dependency: 'jobqueue' },
  { key: 'dep.smtp.up', unit: 'up', base: 1, daily: 0, noise: 0, dependency: 'smtp' },
  { key: 'dep.imap.up', unit: 'up', base: 1, daily: 0, noise: 0, dependency: 'imap' },
  { key: 'jobs.failed_24h', unit: 'count', base: 2, daily: 0.3, noise: 0.6 },
  { key: 'partner_sync.stale_over_48h', unit: 'count', base: 1, daily: 0, noise: 0.7 },
  { key: 'system_log.errors_15m', unit: 'count', base: 1.5, daily: 0.5, noise: 0.9 },
]

export const METRIC_KEYS = HEALTH_METRICS.map((m) => m.key)

export function metricDef(key: string): MetricDef | undefined {
  return HEALTH_METRICS.find((m) => m.key === key)
}

/** i18n-safe key (i18next splits on dots). */
export function metricI18nKey(key: string): string {
  return key.replace(/\./g, '_')
}

export type HistoryRange = '1h' | '24h' | '7d' | '30d'

export const HISTORY_RANGES: { value: HistoryRange; ms: number; bucket: '1m' | '5m' | '1h'; bucketMs: number }[] = [
  { value: '1h', ms: 3_600_000, bucket: '1m', bucketMs: 60_000 },
  { value: '24h', ms: 86_400_000, bucket: '5m', bucketMs: 300_000 },
  { value: '7d', ms: 7 * 86_400_000, bucket: '1h', bucketMs: 3_600_000 },
  { value: '30d', ms: 30 * 86_400_000, bucket: '1h', bucketMs: 3_600_000 },
]

export const DEFAULT_METRIC = 'cpu.load1'

export const HEALTH_DEPENDENCIES: HealthDependency[] = ['postgres', 'jobqueue', 'smtp', 'imap', 'attachments']
