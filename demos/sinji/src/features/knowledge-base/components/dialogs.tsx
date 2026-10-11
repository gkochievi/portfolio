import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Callout, Dialog, Field, Input, SegmentedControl, Select, Skeleton, Textarea, toast } from '@/components/ui'
import { errorMessage, fieldError } from '@/api/client'
import { estimateTokens } from '@/demo/lib/text'
import { useFormat } from '@/lib/format'
import type { KbChunk, KbDocType, KbDocument } from '@/types'
import { useKbDocument, useKbTags, useUpdateChunk, useUpdateDocument } from '../api'
import { KB_DOC_TYPES } from '../types'
import { MetadataEditor, TagsInput, metaToRows, rowsToMeta, type MetaRow } from './fields'

export function useDocTypeOptions() {
  const { t } = useTranslation('kb')
  return KB_DOC_TYPES.map((value) => ({ value, label: t(`docTypes.${value}`) }))
}

/* ------------------------------------------------------- edit document */

function EditForm({ doc, onClose }: { doc: KbDocument; onClose: () => void }) {
  const { t } = useTranslation('kb')
  const fmt = useFormat()
  const tags = useKbTags()
  const update = useUpdateDocument()
  const typeOptions = useDocTypeOptions()

  const [title, setTitle] = useState(doc.title)
  const [docType, setDocType] = useState<KbDocType>(doc.doc_type)
  const [tagList, setTagList] = useState(doc.tags)
  const [meta, setMeta] = useState<MetaRow[]>(metaToRows(doc.metadata))
  const [content, setContent] = useState(doc.content_text)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const contentChanged = content.trim() !== doc.content_text.trim()

  const save = async () => {
    const next: Record<string, string> = {}
    if (!title.trim()) next.title = t('validation.titleRequired')
    if (!content.trim()) next.content = t('validation.contentRequired')
    const parsed = rowsToMeta(meta)
    if (parsed.error) next.metadata = t(`validation.${parsed.error}`)
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      await update.mutateAsync({ id: doc.id, title, doc_type: docType, tags: tagList, metadata: parsed.value, content_text: content })
      toast.success(contentChanged ? t('edit.savedRechunk') : t('edit.saved'))
      onClose()
    } catch (error) {
      setErrors({
        title: fieldError(error, 'title') ?? '',
        content: fieldError(error, 'content_text') ?? '',
        form: errorMessage(error, t('edit.failed')),
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
        <Field label={t('fields.title')} error={errors.title || undefined}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('fields.docType')}>
            <Select value={docType} onValueChange={(v) => setDocType(v as KbDocType)} options={typeOptions} />
          </Field>
          <Field label={t('fields.tags')} optional>
            <TagsInput value={tagList} onChange={setTagList} suggestions={tags.data} />
          </Field>
        </div>
        <Field label={t('fields.metadata')} hint={t('fields.metadataHint')} error={errors.metadata}>
          <MetadataEditor rows={meta} onChange={setMeta} />
        </Field>
        <Field
          label={t('fields.content')}
          hint={t('edit.contentHint', { chars: fmt.number(content.length), tokens: fmt.number(estimateTokens(content)) })}
          error={errors.content || undefined}
        >
          <Textarea rows={12} value={content} onChange={(e) => setContent(e.target.value)} className="min-h-48 font-sans text-[14px] leading-relaxed" />
        </Field>
        {contentChanged ? (
          <Callout tone="warning" title={t('edit.rechunkTitle')}>
            {t('edit.rechunkBody', { count: doc.chunk_count })}
          </Callout>
        ) : null}
        {errors.form ? <Callout tone="danger">{errors.form}</Callout> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose} disabled={update.isPending}>
          {t('actions.cancel')}
        </Button>
        <Button variant="primary" loading={update.isPending} onClick={() => void save()}>
          {contentChanged ? t('edit.saveRechunk') : t('actions.save')}
        </Button>
      </div>
    </div>
  )
}

export function EditDocumentDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation('kb')
  const doc = useKbDocument(id)
  return (
    <Dialog open={Boolean(id)} onOpenChange={(open) => !open && onClose()} title={t('edit.title')} description={t('edit.description')} size="xl">
      {doc.isError ? (
        <Callout tone="danger">{errorMessage(doc.error, t('edit.loadFailed'))}</Callout>
      ) : doc.data && doc.data.id === id ? (
        <EditForm key={doc.data.id} doc={doc.data} onClose={onClose} />
      ) : (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-48" />
        </div>
      )}
    </Dialog>
  )
}

/* -------------------------------------------------------------- retag */

export function RetagDialog({
  open,
  count,
  busy,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  count: number
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (tags: string[], mode: 'add' | 'replace') => void
}) {
  const { t } = useTranslation('kb')
  const tags = useKbTags()
  const [list, setList] = useState<string[]>([])
  const [mode, setMode] = useState<'add' | 'replace'>('add')
  const [error, setError] = useState('')

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('retag.title')}
      description={t('retag.description', { count })}
      locked={busy}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('actions.cancel')}
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={() => {
              if (list.length === 0) return setError(t('validation.tagsRequired'))
              setError('')
              onSubmit(list, mode)
            }}
          >
            {t('retag.apply')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <SegmentedControl
          value={mode}
          onValueChange={(v) => setMode(v as 'add' | 'replace')}
          options={[
            { value: 'add', label: t('retag.add') },
            { value: 'replace', label: t('retag.replace') },
          ]}
        />
        <Field label={t('fields.tags')} error={error || undefined} hint={mode === 'replace' ? t('retag.replaceHint') : t('retag.addHint')}>
          <TagsInput value={list} onChange={setList} suggestions={tags.data} />
        </Field>
      </div>
    </Dialog>
  )
}

/* ---------------------------------------------------------- edit chunk */

export function ChunkEditDialog({ chunk, onClose }: { chunk: KbChunk | null; onClose: () => void }) {
  const { t } = useTranslation('kb')
  return (
    <Dialog
      open={Boolean(chunk)}
      onOpenChange={(open) => !open && onClose()}
      title={t('chunks.editTitle', { n: (chunk?.chunk_index ?? 0) + 1 })}
      description={t('chunks.editDescription')}
      size="lg"
    >
      {chunk ? <ChunkEditForm key={chunk.id} chunk={chunk} onClose={onClose} /> : null}
    </Dialog>
  )
}

function ChunkEditForm({ chunk, onClose }: { chunk: KbChunk; onClose: () => void }) {
  const { t } = useTranslation('kb')
  const fmt = useFormat()
  const update = useUpdateChunk()
  const [content, setContent] = useState(chunk.content)
  const [error, setError] = useState('')

  const save = async () => {
    if (!content.trim()) return setError(t('validation.chunkRequired'))
    try {
      await update.mutateAsync({ id: chunk.id, content })
      toast.success(t('chunks.saved'))
      onClose()
    } catch (e) {
      setError(errorMessage(e, t('chunks.saveFailed')))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label={t('chunks.content')} error={error || undefined} hint={t('chunks.editHint', { tokens: fmt.number(estimateTokens(content)) })}>
        <Textarea rows={10} value={content} onChange={(e) => setContent(e.target.value)} className="font-sans text-[14px] leading-relaxed" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={update.isPending}>
          {t('actions.cancel')}
        </Button>
        <Button variant="primary" loading={update.isPending} onClick={() => void save()}>
          {t('actions.save')}
        </Button>
      </div>
    </div>
  )
}
