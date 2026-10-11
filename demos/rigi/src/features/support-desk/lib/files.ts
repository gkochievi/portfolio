import type { Attachment } from '@/types'

// Text samples are compiled into the bundle, so previewing one never touches the network.
import callLogCsv from '../../../../public/samples/call-log.csv?raw'
import ivrFlowTxt from '../../../../public/samples/ivr-flow.txt?raw'

const SAMPLE_TEXT: Record<string, string> = {
  'samples/call-log.csv': callLogCsv,
  'samples/ivr-flow.txt': ivrFlowTxt,
}

/** Contents of a bundled text sample, or null when the attachment has none. */
export function sampleText(a: Pick<Attachment, 'sampleFile'>): string | null {
  return SAMPLE_TEXT[a.sampleFile.replace(/^\//, '')] ?? null
}

export type PreviewKind = 'image' | 'pdf' | 'text' | 'download'

/** Bundled sample behind an attachment, addressed through BASE_URL. */
export function sampleUrl(a: Pick<Attachment, 'sampleFile'>): string {
  return `${import.meta.env.BASE_URL}${a.sampleFile.replace(/^\//, '')}`
}

export function previewKind(a: Pick<Attachment, 'mimeType' | 'filename'>): PreviewKind {
  const mime = a.mimeType.toLowerCase()
  const name = a.filename.toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('text/') || name.endsWith('.csv') || name.endsWith('.txt')) return 'text'
  return 'download'
}
