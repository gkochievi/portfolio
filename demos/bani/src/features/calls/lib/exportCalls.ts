/**
 * The two downloads of the Call Explorer:
 *   exportRowsToXlsx    the filtered rows (with transfer info) as a real .xlsx
 *   downloadRecordings  a ZIP of the audio bytes + _manifest.txt for the selected calls
 */
import { fmtDateTime } from '@/lib/format'
import type { RecordingAsset, RecordingBundleResponse, UnifiedCdr } from '@/types'
import { dataUrlToBytes, saveBytes, slug } from './files'
import type { RowLabels } from './rows'
import { buildXlsx, XLSX_MIME, type XlsxCell } from './xlsx'
import { createZip } from './zip'

export type Translate = (key: string, options?: Record<string, unknown>) => string

const stampName = (d = new Date()): string => d.toISOString().slice(0, 19).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-')

export function exportRowsToXlsx(rows: UnifiedCdr[], t: Translate, labels: RowLabels): number {
  const yes = t('export.yes')
  const no = t('export.no')
  const columns = [
    { header: t('cols.timestamp'), width: 20 },
    { header: t('cols.source'), width: 14 },
    { header: t('cols.caller'), width: 16 },
    { header: t('cols.called'), width: 16 },
    { header: t('details.final'), width: 16 },
    { header: t('export.durationSec'), width: 14, numeric: true },
    { header: t('export.billableSec'), width: 14, numeric: true },
    { header: t('cols.status'), width: 14 },
    { header: t('cols.disposition'), width: 24 },
    { header: t('cols.origDevice'), width: 24 },
    { header: t('cols.destDevice'), width: 24 },
    { header: t('details.accountCode'), width: 14 },
    { header: t('details.context'), width: 18 },
    { header: t('cols.hangupBy'), width: 16 },
    { header: t('export.legs'), width: 8, numeric: true },
    { header: t('cols.transferred'), width: 12 },
    { header: t('export.transferReason'), width: 18 },
    { header: t('export.transferHops'), width: 10, numeric: true },
    { header: t('cols.transferFrom'), width: 16 },
    { header: t('cols.transferTo'), width: 16 },
    { header: t('export.transferChain'), width: 40 },
    { header: t('export.recording'), width: 12 },
    { header: t('export.callId'), width: 30 },
  ]
  const body: XlsxCell[][] = rows.map((r) => {
    const tr = r.transfer
    const moved = !!tr?.wasTransferred
    return [
      fmtDateTime(r.timestamp, labels.lang, { seconds: true }),
      labels.source(r.source),
      r.callerNumber,
      r.calledNumber,
      r.finalNumber ?? '',
      r.duration,
      r.agentTalkSeconds ?? r.billableSeconds,
      labels.status(r.status),
      r.disposition,
      r.originatingDevice ?? '',
      r.terminatingDevice ?? '',
      r.accountCode ?? '',
      r.context ?? '',
      r.hangupBy ?? '',
      r.segmentCount ?? 1,
      moved ? yes : no,
      moved ? labels.reason(tr!.reason ?? 'transfer') : '',
      moved ? tr!.transferCount : 0,
      moved ? (tr!.transferFrom ?? '') : '',
      moved ? (tr!.transferTo ?? '') : '',
      moved ? tr!.chain.join(' > ') : '',
      r.hasRecording ? yes : no,
      r.id,
    ]
  })
  const bytes = buildXlsx({ name: t('export.sheet'), columns, rows: body })
  saveBytes(`bani-calls-${stampName()}.xlsx`, bytes, XLSX_MIME)
  return rows.length
}

/* ------------------------------------------------------------ recordings ZIP */

const ASSET_LOADERS: Record<RecordingAsset['id'], () => Promise<{ default: string }>> = {
  'rec-a': () => import('../media/rec-a.wav?inline'),
  'rec-b': () => import('../media/rec-b.wav?inline'),
  'rec-c': () => import('../media/rec-c.wav?inline'),
}

const assetBytes = new Map<string, Uint8Array>()

async function loadAsset(id: RecordingAsset['id']): Promise<Uint8Array> {
  const cached = assetBytes.get(id)
  if (cached) return cached
  const mod = await ASSET_LOADERS[id]()
  const bytes = dataUrlToBytes(mod.default)
  assetBytes.set(id, bytes)
  return bytes
}

export interface BundleContext {
  /** Leg id sent to the server -> the table row it came from. */
  rows: Map<string, UnifiedCdr>
  format: 'original' | 'mp3'
  labels: RowLabels
  t: Translate
}

export function manifestText(bundle: RecordingBundleResponse, ctx: BundleContext): string {
  const { t, labels } = ctx
  const lines: string[] = [
    t('zip.manifestTitle'),
    `${t('zip.manifestGenerated')}: ${fmtDateTime(new Date().toISOString(), labels.lang, { seconds: true })}`,
    `${t('zip.manifestFormat')}: ${ctx.format === 'mp3' ? t('zip.formatMp3Note') : t('zip.formatOriginal')}`,
    '',
    `${t('zip.manifestIncluded')} (${bundle.included.length})`,
  ]
  for (const inc of bundle.included) {
    const row = ctx.rows.get(inc.callId)
    const who = row ? `${row.callerNumber} > ${row.calledNumber}  ${fmtDateTime(row.timestamp, labels.lang, { seconds: true })}` : inc.callId
    lines.push(`  ${inc.fileName}  |  ${who}`)
  }
  lines.push('', `${t('zip.manifestSkipped')} (${bundle.skipped.length})`)
  for (const sk of bundle.skipped) {
    const row = ctx.rows.get(sk.callId)
    const who = row ? `${row.callerNumber} > ${row.calledNumber}  ${fmtDateTime(row.timestamp, labels.lang, { seconds: true })}` : sk.callId
    lines.push(`  ${who}  |  ${t(`zip.reasons.${sk.reason}`)}`)
  }
  return lines.join('\r\n') + '\r\n'
}

/** Build and save the ZIP for a server-approved bundle. Rejects only on unexpected failures. */
export async function downloadRecordings(bundle: RecordingBundleResponse, ctx: BundleContext): Promise<string> {
  const entries = [] as { name: string; data: Uint8Array }[]
  for (const inc of bundle.included) {
    entries.push({ name: inc.fileName, data: await loadAsset(inc.assetId) })
  }
  entries.push({ name: '_manifest.txt', data: new TextEncoder().encode(manifestText(bundle, ctx)) })
  const fileName = `bani-recordings-${stampName()}.zip`
  saveBytes(slug(fileName), createZip(entries), 'application/zip')
  return fileName
}
