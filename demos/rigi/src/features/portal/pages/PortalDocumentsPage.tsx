/** /partner/documents: read-only versioned documents with preview and download. Owner: portal. */
import { useMemo, useState } from 'react'
import { Download, Eye, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { buttonVariants, Badge, Button, Card, CardHeader, DataTable, DateText, Dialog, EmptyState, PageHeader, Section, Skeleton, type Column } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatBytes } from '@/lib/format'
import type { DocumentKind, DocumentVersion, PartnerDocument } from '@/types'

import { usePortalDocuments } from '../api'

const KINDS: DocumentKind[] = ['contract', 'technical']

function fileUrl(version: DocumentVersion): string {
  return `${import.meta.env.BASE_URL}${version.sampleFile}`
}

type PreviewKind = 'frame' | 'image' | null

function previewKind(version: DocumentVersion): PreviewKind {
  if (version.mimeType === 'application/pdf' || version.mimeType.startsWith('text/plain')) return 'frame'
  if (version.mimeType.startsWith('image/')) return 'image'
  return null
}

export default function PortalDocumentsPage() {
  const { t } = useTranslation('portal')
  const documents = usePortalDocuments()
  const [preview, setPreview] = useState<DocumentVersion | null>(null)

  const groups = useMemo(
    () => KINDS.map((kind) => ({ kind, docs: (documents.data ?? []).filter((d) => d.kind === kind) })).filter((g) => g.docs.length > 0),
    [documents.data],
  )

  const columns: Column<DocumentVersion>[] = [
    { key: 'versionNo', header: t('documents.columns.version'), width: '88px', cell: (v) => <span className="num font-mono text-[13px]">v{v.versionNo}</span> },
    { key: 'filename', header: t('documents.columns.file'), cell: (v) => <span className="break-all font-mono text-[13px]">{v.filename}</span> },
    { key: 'sizeBytes', header: t('documents.columns.size'), hideBelow: 'sm', align: 'right', cell: (v) => <span className="num">{formatBytes(v.sizeBytes)}</span> },
    { key: 'createdAt', header: t('documents.columns.date'), hideBelow: 'md', cell: (v) => <DateText value={v.createdAt} /> },
    { key: 'note', header: t('documents.columns.note'), hideBelow: 'lg', cell: (v) => <span className="text-muted">{v.note || '—'}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">{t('common:fields.actions')}</span>,
      align: 'right',
      cell: (v) => (
        <div className="flex justify-end gap-1.5">
          {previewKind(v) ? (
            <Button size="xs" variant="outline" icon={<Eye aria-hidden />} onClick={() => setPreview(v)}>
              {t('documents.preview')}
            </Button>
          ) : null}
          <a href={fileUrl(v)} download={v.filename} className={cn(buttonVariants({ variant: 'outline', size: 'xs' }))}>
            <Download aria-hidden />
            {t('documents.download')}
          </a>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader eyebrow={t('documents.eyebrow')} title={t('documents.title')} description={t('documents.description')} />

      {documents.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : documents.error ? (
        <EmptyState
          title={t('documents.error')}
          action={
            <Button variant="outline" onClick={() => void documents.refetch()}>
              {t('common:actions.retry')}
            </Button>
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState icon={<FileText />} title={t('documents.empty.title')} description={t('documents.empty.description')} />
      ) : (
        groups.map((g) => (
          <Section key={g.kind} title={t(`common:documentKind.${g.kind}`)}>
            <div className="space-y-4">
              {g.docs.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} columns={columns} />
              ))}
            </div>
          </Section>
        ))
      )}

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)} title={preview?.filename ?? ''} size="xl" description={preview?.note || undefined}>
        {preview ? (
          previewKind(preview) === 'image' ? (
            <img src={fileUrl(preview)} alt={preview.filename} className="mx-auto max-h-[70vh] max-w-full rounded-md border border-hairline bg-white object-contain" />
          ) : previewKind(preview) === 'frame' ? (
            <iframe title={preview.filename} src={fileUrl(preview)} className="h-[70vh] w-full rounded-md border border-hairline bg-white" />
          ) : (
            <p className="text-sm text-muted">{t('documents.noPreview')}</p>
          )
        ) : null}
      </Dialog>
    </>
  )
}

function DocumentCard({ doc, columns }: { doc: PartnerDocument; columns: Column<DocumentVersion>[] }) {
  const { t } = useTranslation('portal')
  const latest = doc.versions[doc.versions.length - 1]
  const rows = [...doc.versions].reverse()
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {doc.title}
            {latest ? <Badge tone="accent" dot={false}>{t('documents.current', { n: latest.versionNo })}</Badge> : null}
          </span>
        }
        description={doc.versions.length === 1 ? t('documents.versionOne') : t('documents.versions', { count: doc.versions.length })}
      />
      <DataTable caption={doc.title} columns={columns} rows={rows} getRowId={(v) => v.id} pageSize={0} />
    </Card>
  )
}
