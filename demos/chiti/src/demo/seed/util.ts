/**
 * Seed helpers. Every seeded timestamp is authored relative to SEED_ANCHOR
 * (Monday 2026-10-05 15:00 Asia/Tbilisi) and rebased to "now" by the store.
 * Phones only come from the obviously fake +995 555 00 xx xx series.
 */
import type { LocalizedText, MessageFile } from '@/types'

import { SEED_ANCHOR } from '../clock'

export const SEC = 1_000
export const MIN = 60 * SEC
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR
export const ANCHOR_MS = Date.parse(SEED_ANCHOR)
/** Asia/Tbilisi is UTC+4 all year (no DST). */
export const TBILISI_OFFSET_MS = 4 * HOUR
/** Shared password of every demo account. */
export const DEMO_PASSWORD = 'chiti-demo'

/** ISO string `offsetMs` after the anchor. */
export function at(offsetMs: number): string {
  return new Date(ANCHOR_MS + offsetMs).toISOString()
}

/** ISO string `ms` before the anchor. */
export function ago(ms: number): string {
  return at(-ms)
}

export function L(en: string, ka: string, ru?: string): LocalizedText {
  return ru === undefined ? { en, ka } : { en, ka, ru }
}

export function pad(n: number, width = 3): string {
  return String(n).padStart(width, '0')
}

/** `+995 555 00 xx xx`, from the fake series only. */
export function fakePhone(n: number): string {
  const d = pad(((n % 10_000) + 10_000) % 10_000, 4)
  return `+995 555 00 ${d.slice(0, 2)} ${d.slice(2)}`
}

export function digits(text: string): string {
  return text.replace(/\D/g, '')
}

/** UTC ms of Tbilisi midnight `daysAgo` days before the anchor day. */
export function localDayStartMs(daysAgo: number): number {
  const local = ANCHOR_MS + TBILISI_OFFSET_MS
  return local - (local % DAY) - TBILISI_OFFSET_MS - daysAgo * DAY
}

/** FNV-1a, for deterministic per-id variation. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function chatMedia(file: string): string {
  return `${import.meta.env.BASE_URL}media/chat/${file}`
}

/** Bundled chat media (public/media/chat), drawn locally. */
export const MEDIA = {
  bottles: { file: 'wine-bottles.svg', mimeType: 'image/svg+xml', size: 1370 },
  broken: { file: 'broken-bottle.svg', mimeType: 'image/svg+xml', size: 1350 },
  receipt: { file: 'receipt.svg', mimeType: 'image/svg+xml', size: 1658 },
  gift: { file: 'gift-box.svg', mimeType: 'image/svg+xml', size: 1223 },
  tasting: { file: 'tasting-table.svg', mimeType: 'image/svg+xml', size: 2166 },
  travel: { file: 'travel-box.svg', mimeType: 'image/svg+xml', size: 999 },
  invoice: { file: 'invoice-VZ-INV-0412.pdf', mimeType: 'application/pdf', size: 927 },
  priceList: { file: 'vazi-autumn-price-list.pdf', mimeType: 'application/pdf', size: 962 },
  voice1: { file: 'voice-note-1.wav', mimeType: 'audio/wav', size: 64044 },
  voice2: { file: 'voice-note-2.wav', mimeType: 'audio/wav', size: 88044 },
} as const

export type MediaKey = keyof typeof MEDIA

export function mediaFile(key: MediaKey): MessageFile {
  const item = MEDIA[key]
  return { url: chatMedia(item.file), name: item.file, mimeType: item.mimeType, size: item.size }
}
