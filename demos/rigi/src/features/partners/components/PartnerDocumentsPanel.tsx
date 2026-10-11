/**
 * CROSS-GROUP CONTRACT. Owner: partners.
 * Consumed by: partners (PartnerDetailPage ?tab=documents) and licensing
 * (AccountantPartnerPage, with canUpload=true, canDelete=false).
 * Uploads are simulated: the file input only reads name, size and type; the
 * stored version points at a bundled sample file.
 */
import { Download, Eye, FilePlus2, FileText, Trash2, Upload } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { fieldErrorsOf } from '@/api/client'
import {
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  DateText,
  Dialog,
  EmptyState,
  Field,
  Input,
  NativeSelect,
  Skeleton,
  Textarea,
} from '@/components/ui'
import { formatBytes } from '@/lib/format'
import type { DocumentKind, DocumentVersion, PartnerDocument } from '@/types'

import { useDeleteDocument, usePartnerDocuments, useUploadDocument, useUploadVersion } from '../api'
import { documentUploadSchema, documentVersionSchema } from '../lib/schema'

export interface PartnerDocumentsPanelProps {
  partnerId: string
  /** Upload a new document or a new version (superadmin, accountant). */
  canUpload: boolean
  /** Delete a document (superadmin only). */
  canDelete: boolean
}

const KINDS: DocumentKind[] = ['contract', 'technical']
const sampleUrl = (file: string) => `${import.meta.env.BASE_URL}${file}`

type UploadTarget = { mode: 'new' } | { mode: 'version'; doc: PartnerDocument }

interface Picked {
  filename: string
  sizeBytes: number
  mimeType: string
}

export function PartnerDocumentsPanel({ partnerId, canUpload, canDelete }: PartnerDocumentsPanelProps) {
  const { t } = useTranslation('partners')
  const docs = usePartnerDocuments(partnerId)
  const remove = useDeleteDocument(partnerId)
  const [upload, setUpload] = useState<UploadTarget | null>(null)
  const [preview, setPreview] = useState<DocumentVersion | null>(null)
  const [toDelete, setToDelete] = useState<PartnerDocument | null>(null)

  if (docs.isLoading) return <Skeleton className="h-48 w-full" />
  if (docs.isError || !docs.data) {
    return (
      <EmptyState
        title={t('documents.loadError')}
        action={<Button variant="secondary" onClick={() => docs.refetch()}>{t('common:actions.retry')}</Button>}
      />
    )
  }

  const confirmDelete = () => {
    if (!toDelete) return
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success(t('documents.deleted'))
        setToDelete(null)
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : t('errors.generic')),
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">{t('documents.title')}</h3>
          <p className="text-[13px] text-muted">{t('documents.description')}</p>
        </div>
        {canUpload ? (
          <Button icon={<Upload />} onClick={() => setUpload({ mode: 'new' })}>
            {t('documents.upload')}
          </Button>
        ) : null}
      </div>

      {docs.data.map((group) => (
        <section key={group.kind} aria-label={t(`common:documentKind.${group.kind}`)}>
          <p className="eyebrow mb-2">{t(`common:documentKind.${group.kind}`)}</p>
          {group.documents.length === 0 ? (
            <p className="rounded-lg border border-dashed border-hairline-strong px-4 py-5 text-center text-[13px] text-muted">
              {t('documents.empty', { kind: t(`common:documentKind.${group.kind}`).toLowerCase() })}
            </p>
          ) : (
            <div className="space-y-3">
              {group.documents.map((doc) => {
                const versions = [...doc.versions].sort((a, b) => b.versionNo - a.versionNo)
                const current = versions[0]
                return (
                  <Card key={doc.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3">
                      <div className="min-w-0">
                        <h4 className="flex flex-wrap items-center gap-2 font-display text-[15px] font-semibold">
                          <FileText className="size-4 shrink-0 stroke-[1.75] text-muted" aria-hidden />
                          <span className="min-w-0 break-words">{doc.title}</span>
                          {current ? <Badge tone="primary" dot={false}>{t('documents.current', { n: current.versionNo })}</Badge> : null}
                        </h4>
                        <p className="mt-0.5 text-[13px] text-muted">{t('documents.versionCount', { count: versions.length })}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {current ? (
                          <>
                            <Button size="sm" variant="secondary" icon={<Eye />} onClick={() => setPreview(current)}>{t('documents.preview')}</Button>
                            <Button asChild size="sm" variant="secondary" icon={<Download />}>
                              <a href={sampleUrl(current.sampleFile)} download={current.filename}>{t('documents.download')}</a>
                            </Button>
                          </>
                        ) : null}
                        {canUpload ? (
                          <Button size="sm" variant="outline" icon={<FilePlus2 />} onClick={() => setUpload({ mode: 'version', doc })}>{t('documents.newVersion')}</Button>
                        ) : null}
                        {canDelete ? (
                          <Button size="sm" variant="destructive-ghost" icon={<Trash2 />} onClick={() => setToDelete(doc)} aria-label={t('documents.delete')}>
                            <span className="sr-only sm:not-sr-only">{t('common:actions.delete')}</span>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <CardBody className="p-0">
                      <ul className="divide-y divide-hairline" aria-label={t('documents.versions')}>
                        {versions.map((v) => (
                          <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]">
                            <span className="num w-8 font-mono font-medium">v{v.versionNo}</span>
                            <span className="min-w-0 flex-1 basis-48">
                              <span className="block truncate font-medium">{v.filename}</span>
                              {v.note ? <span className="block truncate text-xs text-muted">{v.note}</span> : null}
                            </span>
                            <span className="num text-muted">{formatBytes(v.sizeBytes)}</span>
                            <span className="text-muted"><DateText value={v.createdAt} /> · {t('documents.uploadedBy', { name: v.uploadedByName })}</span>
                            <span className="flex gap-1">
                              <Button size="xs" variant="ghost" icon={<Eye />} onClick={() => setPreview(v)} aria-label={`${t('documents.preview')} v${v.versionNo}`} />
                              <Button asChild size="xs" variant="ghost" icon={<Download />} aria-label={`${t('documents.download')} v${v.versionNo}`}>
                                <a href={sampleUrl(v.sampleFile)} download={v.filename} />
                              </Button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardBody>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      ))}

      <UploadDialog partnerId={partnerId} target={upload} onClose={() => setUpload(null)} />
      <PreviewDialog version={preview} onClose={() => setPreview(null)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('documents.deleteTitle', { title: toDelete?.title ?? '' })}
        description={t('documents.deleteDescription', { count: toDelete?.versions.length ?? 0 })}
        confirmLabel={t('common:actions.delete')}
        tone="danger"
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ upload */

function UploadDialog({ partnerId, target, onClose }: { partnerId: string; target: UploadTarget | null; onClose: () => void }) {
  const { t } = useTranslation('partners')
  const createDoc = useUploadDocument(partnerId)
  const addVersion = useUploadVersion(partnerId)
  const fileRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<DocumentKind>('contract')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [picked, setPicked] = useState<Picked | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const pending = createDoc.isPending || addVersion.isPending

  const reset = () => {
    setKind('contract')
    setTitle('')
    setNote('')
    setPicked(null)
    setErrors({})
    if (fileRef.current) fileRef.current.value = ''
  }
  const close = () => {
    reset()
    onClose()
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    // Only name, size and type are read; the content never leaves the input.
    const file = e.target.files?.[0]
    if (!file) return setPicked(null)
    setPicked({ filename: file.name, sizeBytes: file.size, mimeType: file.type })
    setErrors((prev) => ({ ...prev, filename: '', sizeBytes: '' }))
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''))
  }

  const isVersion = target?.mode === 'version'

  async function submit() {
    if (!target) return
    const payload = { kind, title: title.trim(), filename: picked?.filename ?? '', sizeBytes: picked?.sizeBytes ?? 0, mimeType: picked?.mimeType ?? '', note: note.trim() }
    const parsed = isVersion ? documentVersionSchema.safeParse(payload) : documentUploadSchema.safeParse(payload)
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0])
        if (!next[key]) next[key] = t(issue.message)
      }
      if (next.sizeBytes && !next.filename) next.filename = next.sizeBytes
      setErrors(next)
      return
    }
    try {
      if (target.mode === 'version') {
        const doc = await addVersion.mutateAsync({ docId: target.doc.id, ...documentVersionSchema.parse(payload) })
        toast.success(t('documents.versionUploaded', { n: doc.versions.at(-1)?.versionNo ?? 1 }))
      } else {
        await createDoc.mutateAsync(documentUploadSchema.parse(payload))
        toast.success(t('documents.uploaded'))
      }
      close()
    } catch (error) {
      const fields = fieldErrorsOf(error)
      if (Object.keys(fields).length === 0) toast.error(error instanceof Error ? error.message : t('errors.generic'))
      else setErrors(fields)
    }
  }

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(o) => !o && close()}
      title={target?.mode === 'version' ? t('documents.versionTitle', { title: target.doc.title }) : t('documents.uploadTitle')}
      description={t('documents.uploadDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={pending}>{t('common:actions.cancel')}</Button>
          <Button onClick={submit} loading={pending} icon={<Upload />}>{t('common:actions.upload')}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate className="space-y-4">
        {isVersion ? null : (
          <>
            <Field label={t('documents.kind')} htmlFor="d-kind">
              <NativeSelect
                id="d-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as DocumentKind)}
                options={KINDS.map((k) => ({ value: k, label: t(`common:documentKind.${k}`) }))}
              />
            </Field>
            <Field label={t('documents.docTitle')} required htmlFor="d-title" error={errors.title}>
              <Input id="d-title" value={title} invalid={Boolean(errors.title)} onChange={(e) => setTitle(e.target.value)} />
            </Field>
          </>
        )}
        <Field label={t('documents.file')} hint={t('documents.fileHint')} required htmlFor="d-file" error={errors.filename || errors.sizeBytes}>
          <input
            ref={fileRef}
            id="d-file"
            type="file"
            onChange={onFile}
            className="block w-full cursor-pointer rounded-md border border-hairline-strong bg-panel text-[13px] text-muted file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-hairline-strong file:bg-sunken file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-ink"
          />
        </Field>
        {picked ? <p className="num -mt-2 text-xs text-muted">{picked.filename} · {formatBytes(picked.sizeBytes)}</p> : null}
        <Field label={t('documents.note')} htmlFor="d-note" error={errors.note}>
          <Textarea id="d-note" rows={2} value={note} placeholder={t('documents.notePlaceholder')} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  )
}

/* ----------------------------------------------------------------- preview */

function PreviewDialog({ version, onClose }: { version: DocumentVersion | null; onClose: () => void }) {
  const { t } = useTranslation('partners')
  const ext = version?.sampleFile.toLowerCase().split('.').pop() ?? ''
  const url = version ? sampleUrl(version.sampleFile) : ''
  return (
    <Dialog
      open={Boolean(version)}
      onOpenChange={(o) => !o && onClose()}
      title={version ? t('documents.previewTitle', { filename: version.filename }) : ''}
      size="xl"
      footer={
        version ? (
          <>
            <Button asChild variant="secondary" icon={<Download />}>
              <a href={url} download={version.filename}>{t('documents.download')}</a>
            </Button>
            <Button onClick={onClose}>{t('common:actions.close')}</Button>
          </>
        ) : undefined
      }
    >
      {version ? (
        ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'svg' ? (
          <img src={url} alt={version.filename} className="mx-auto max-h-[60vh] max-w-full rounded border border-hairline" />
        ) : ext === 'pdf' || ext === 'txt' ? (
          <iframe src={url} title={version.filename} className="h-[60vh] w-full rounded border border-hairline bg-white" />
        ) : (
          <p className="py-8 text-center text-[13px] text-muted">{t('documents.noPreview')}</p>
        )
      ) : null}
    </Dialog>
  )
}
