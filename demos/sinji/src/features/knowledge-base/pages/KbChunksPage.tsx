import { Boxes, FileText, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { errorMessage } from '@/api/client'
import { Badge, Button, Callout, ConfirmDialog, EmptyState, IconButton, Panel, SearchInput, Skeleton, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useFormat } from '@/lib/format'
import { useGloss } from '@/lib/gloss'
import { useCanEdit } from '@/lib/session'
import type { KbChunk } from '@/types'
import { isInFlight, useDeleteChunk, useKbChunks, useKbDocument, useKbDocuments, useReembedDocument } from '../api'
import { ChunkEditDialog } from '../components/dialogs'
import { DocTypeBadge, StatusCell } from '../components/fields'

/** Chunk inspector: pick a document, read, edit or delete its chunks. OWNED BY: knowledge-base. */
export default function KbChunksPage() {
  const { t } = useTranslation('kb')
  const fmt = useFormat()
  const gloss = useGloss()
  const canEdit = useCanEdit()
  const [params, setParams] = useSearchParams()
  const docId = params.get('doc')

  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])

  const list = useKbDocuments({ q: query, page_size: 50 })
  const doc = useKbDocument(docId)
  const chunks = useKbChunks(docId)
  const removeChunk = useDeleteChunk()
  const reembed = useReembedDocument()

  const [editing, setEditing] = useState<KbChunk | null>(null)
  const [deleting, setDeleting] = useState<KbChunk | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const pick = (id: string) => setParams({ doc: id }, { replace: true })
  const totalTokens = (chunks.data ?? []).reduce((sum, c) => sum + c.token_count, 0)
  const inFlight = doc.data ? isInFlight(doc.data.status) : false

  return (
    <div className="grid gap-6 lg:grid-cols-[19rem_1fr]">
      <Panel title={t('chunks.pickTitle')} icon={<FileText />} bodyClassName="flex flex-col gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder={t('chunks.pickSearch')} />
        <div className="scrollbar-thin -mx-1 max-h-72 overflow-y-auto px-1 lg:max-h-[34rem]" role="listbox" aria-label={t('chunks.pickTitle')}>
          {list.isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : list.isError ? (
            <Callout tone="danger">{errorMessage(list.error)}</Callout>
          ) : list.data && list.data.items.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted">{t('chunks.pickNone')}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {list.data?.items.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={d.id === docId}
                    onClick={() => pick(d.id)}
                    className={cn(
                      'flex w-full flex-col gap-1 rounded-ctl border border-transparent px-2.5 py-2 text-left transition-colors hover:bg-sunken',
                      d.id === docId && 'border-primary/40 bg-primary/8',
                    )}
                  >
                    <span className="line-clamp-2 text-sm font-medium">{gloss.pick(d.title, d.title_en)}</span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      <DocTypeBadge type={d.doc_type} />
                      <span className="tabular">{t('chunks.countShort', { count: d.chunk_count })}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <div className="min-w-0">
        {!docId ? (
          <EmptyState icon={<Boxes />} title={t('chunks.noDocTitle')} body={t('chunks.noDocBody')} />
        ) : doc.isError ? (
          <Callout tone="danger" title={t('chunks.docMissing')}>
            {errorMessage(doc.error)}
          </Callout>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-card border border-line bg-panel p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                {doc.data ? (
                  <>
                    <h2 className="font-display text-xl font-semibold">{gloss.pick(doc.data.title, doc.data.title_en)}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
                      <DocTypeBadge type={doc.data.doc_type} />
                      <StatusCell status={doc.data.status} error={doc.data.error} restructuring={doc.data.restructure === 'running'} />
                      <span className="tabular">{t('chunks.summary', { chunks: fmt.number(chunks.data?.length ?? doc.data.chunk_count), tokens: fmt.number(totalTokens) })}</span>
                    </div>
                  </>
                ) : (
                  <Skeleton className="h-12 w-72" />
                )}
              </div>
              {canEdit && doc.data ? (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw />}
                  disabled={inFlight || reembed.isPending}
                  onClick={() =>
                    reembed.mutate(doc.data.id, { onSuccess: () => toast.success(t('documents.reembedStarted')), onError: (e) => toast.error(errorMessage(e)) })
                  }
                >
                  {t('documents.reembed')}
                </Button>
              ) : null}
            </div>

            {inFlight ? <Callout tone="info">{t('chunks.inFlight')}</Callout> : null}
            {doc.data?.status === 'error' ? <Callout tone="danger">{doc.data.error ?? t('chunks.failed')}</Callout> : null}

            {chunks.isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-28" />
                ))}
              </div>
            ) : chunks.isError ? (
              <Callout tone="danger" action={<Button size="sm" onClick={() => void chunks.refetch()}>{t('actions.retry')}</Button>}>
                {errorMessage(chunks.error)}
              </Callout>
            ) : chunks.data && chunks.data.length === 0 ? (
              <EmptyState compact title={t('chunks.emptyTitle')} body={inFlight ? t('chunks.emptyProcessing') : t('chunks.emptyBody')} />
            ) : (
              <ol className="flex flex-col gap-3">
                {chunks.data?.map((chunk) => {
                  const long = chunk.content.length > 420
                  const expanded = open.has(chunk.id)
                  return (
                    <li key={chunk.id} className="rounded-card border border-line bg-panel p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">#{chunk.chunk_index + 1}</span>
                        <Badge size="sm" shape="tag">
                          {t('chunks.tokens', { count: chunk.token_count })}
                        </Badge>
                        <Badge size="sm" tone={chunk.has_embedding ? 'success' : 'warning'}>
                          {chunk.has_embedding ? t('chunks.embedded') : t('chunks.notEmbedded')}
                        </Badge>
                        {canEdit ? (
                          <span className="ml-auto flex gap-1">
                            <IconButton label={t('chunks.edit', { n: chunk.chunk_index + 1 })} icon={<Pencil />} size="sm" onClick={() => setEditing(chunk)} />
                            <IconButton label={t('chunks.delete', { n: chunk.chunk_index + 1 })} icon={<Trash2 />} size="sm" onClick={() => setDeleting(chunk)} />
                          </span>
                        ) : null}
                      </div>
                      <p className={cn('whitespace-pre-wrap break-words text-[14px] leading-relaxed', long && !expanded && 'line-clamp-5')}>{chunk.content}</p>
                      {long ? (
                        <button
                          type="button"
                          className="mt-2 text-xs font-medium text-primary hover:underline"
                          onClick={() =>
                            setOpen((prev) => {
                              const next = new Set(prev)
                              if (next.has(chunk.id)) next.delete(chunk.id)
                              else next.add(chunk.id)
                              return next
                            })
                          }
                        >
                          {expanded ? t('chunks.less') : t('chunks.more')}
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        )}
      </div>

      <ChunkEditDialog chunk={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('chunks.deleteTitle', { n: (deleting?.chunk_index ?? 0) + 1 })}
        body={t('chunks.deleteBody')}
        confirmLabel={t('actions.delete')}
        danger
        onConfirm={async () => {
          if (!deleting) return
          try {
            await removeChunk.mutateAsync(deleting.id)
            toast.success(t('chunks.deleted'))
          } catch (e) {
            toast.error(errorMessage(e))
          }
          setDeleting(null)
        }}
      />
    </div>
  )
}
