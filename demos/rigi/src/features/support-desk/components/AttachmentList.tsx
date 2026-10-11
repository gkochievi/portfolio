import { useState } from 'react'
import { Download, File, FileImage, FileSpreadsheet, FileText, Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Banner, Button, Dialog, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatBytes } from '@/lib/format'
import type { Attachment } from '@/types'

import { previewKind, sampleText, sampleUrl } from '../lib/files'

const PREVIEW_LINES = 40

function iconFor(a: Attachment) {
  const kind = previewKind(a)
  if (kind === 'image') return FileImage
  if (kind === 'pdf') return FileText
  if (a.filename.toLowerCase().endsWith('.csv')) return FileSpreadsheet
  return kind === 'text' ? FileText : File
}

function HoverCard({ attachment }: { attachment: Attachment }) {
  const kind = previewKind(attachment)
  return (
    <div className="max-w-[220px] space-y-1.5">
      {kind === 'image' ? (
        <img src={sampleUrl(attachment)} alt="" className="max-h-32 w-full rounded-sm bg-white object-contain" />
      ) : null}
      <div className="break-all font-medium">{attachment.filename}</div>
      <div className="opacity-70">
        {formatBytes(attachment.sizeBytes)} · {attachment.mimeType}
      </div>
    </div>
  )
}

function TextPreview({ attachment }: { attachment: Attachment }) {
  const { t } = useTranslation('support-desk')
  const text = sampleText(attachment)
  if (text === null) return <Banner tone="danger">{t('attachments.loadFailed')}</Banner>
  const lines = text.split(/\r?\n/)
  const shown = lines.slice(0, PREVIEW_LINES)
  return (
    <div>
      <pre className="max-h-[50vh] overflow-auto rounded-md border border-hairline bg-sunken p-3 font-mono text-xs leading-5 text-ink">
        {shown.join('\n')}
      </pre>
      {lines.length > PREVIEW_LINES ? (
        <p className="mt-2 text-xs text-muted">{t('attachments.firstLines', { count: PREVIEW_LINES, total: lines.length })}</p>
      ) : null}
    </div>
  )
}

export function DocumentPreviewDialog({ attachment, onClose }: { attachment: Attachment | null; onClose: () => void }) {
  const { t } = useTranslation(['support-desk', 'common'])
  const kind = attachment ? previewKind(attachment) : 'download'
  const url = attachment ? sampleUrl(attachment) : ''
  return (
    <Dialog
      open={attachment !== null}
      onOpenChange={(open) => !open && onClose()}
      size="xl"
      title={attachment?.filename ?? ''}
      description={attachment ? `${formatBytes(attachment.sizeBytes)} · ${attachment.mimeType}` : undefined}
      footer={
        attachment ? (
          <>
            <Button variant="secondary" asChild icon={<Download />}>
              <a href={url} download={attachment.filename}>
                {t('common:actions.download')}
              </a>
            </Button>
            <Button onClick={onClose}>{t('common:actions.close')}</Button>
          </>
        ) : null
      }
    >
      {attachment ? (
        kind === 'image' ? (
          <div className="flex max-h-[60vh] justify-center overflow-auto rounded-md border border-hairline bg-white p-2">
            <img src={url} alt={attachment.filename} className="h-auto max-w-full object-contain" />
          </div>
        ) : kind === 'pdf' ? (
          <iframe title={attachment.filename} src={url} className="h-[60vh] w-full rounded-md border border-hairline bg-white" />
        ) : kind === 'text' ? (
          <TextPreview attachment={attachment} />
        ) : (
          <Banner tone="info" title={t('attachments.noPreviewTitle')}>
            {t('attachments.noPreview')}
          </Banner>
        )
      ) : null}
    </Dialog>
  )
}

/** Attachment chips with a hover preview; a click opens the document preview. */
export function AttachmentList({ attachments, compact, className }: { attachments: Attachment[]; compact?: boolean; className?: string }) {
  const [open, setOpen] = useState<Attachment | null>(null)
  if (attachments.length === 0) return null
  return (
    <>
      <ul className={cn('flex flex-wrap gap-2', className)}>
        {attachments.map((a) => {
          const Icon = iconFor(a)
          return (
            <li key={a.id}>
              <Tooltip content={<HoverCard attachment={a} />} side="top">
                <button
                  type="button"
                  onClick={() => setOpen(a)}
                  className="inline-flex max-w-full items-center gap-2 rounded-md border border-hairline-strong bg-panel px-2.5 py-1.5 text-left text-[13px] text-ink transition-colors duration-150 hover:bg-row-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                >
                  <Icon className="size-4 shrink-0 stroke-[1.75] text-muted" aria-hidden />
                  <span className="min-w-0 truncate font-medium">{a.filename}</span>
                  {compact ? null : <span className="num shrink-0 text-xs text-muted">{formatBytes(a.sizeBytes)}</span>}
                </button>
              </Tooltip>
            </li>
          )
        })}
      </ul>
      <DocumentPreviewDialog attachment={open} onClose={() => setOpen(null)} />
    </>
  )
}

export function PaperclipMark({ label }: { label: string }) {
  return <Paperclip className="size-3.5 shrink-0 stroke-[1.75] text-muted" aria-label={label} />
}
