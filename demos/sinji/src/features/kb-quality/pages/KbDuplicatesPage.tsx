import { CopyCheck, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge, Button, Callout, ConfirmDialog, EmptyState, IconButton, Panel, Skeleton, toast } from '@/components/ui'
import { useFormat } from '@/lib/format'
import { useCanEdit } from '@/lib/session'
import { useDeleteDocument, useDuplicates } from '../api'
import { errorText, ScoreBar } from '../components/bits'

interface Pending {
  id: string
  title: string
}

function DocLink({ id, title }: { id: string; title: string }) {
  return (
    <Link to={`/workspace/kb/chunks?doc=${encodeURIComponent(id)}`} className="min-w-0 truncate font-medium hover:text-primary hover:underline">
      {title}
    </Link>
  )
}

export default function KbDuplicatesPage() {
  const { t } = useTranslation('kbQuality')
  const f = useFormat()
  const canEdit = useCanEdit()
  const report = useDuplicates()
  const remove = useDeleteDocument()
  const [pending, setPending] = useState<Pending | null>(null)

  const data = report.data
  const nothing = data && data.exact.length === 0 && data.near.length === 0

  const confirmDelete = async () => {
    if (!pending) return
    try {
      await remove.mutateAsync(pending.id)
      toast.success(t('duplicates.deleted', { title: pending.title }))
    } catch (error) {
      toast.error(errorText(error, t('common.actionError')))
    }
  }

  const deleteButton = (doc: Pending) =>
    canEdit ? (
      <IconButton
        label={t('duplicates.deleteNamed', { title: doc.title })}
        icon={<Trash2 className="size-4" />}
        variant="ghost"
        size="sm"
        onClick={() => setPending(doc)}
      />
    ) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted">
          {t('duplicates.description')}
          {data ? <span className="ml-1 text-subtle">{t('duplicates.scanned', { when: f.relative(data.scanned_at) })}</span> : null}
        </p>
        <Button
          variant="secondary"
          size="sm"
          loading={report.isFetching}
          icon={<RefreshCw className="size-4" />}
          onClick={() => void report.refetch()}
        >
          {t('common.refresh')}
        </Button>
      </div>

      {report.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : report.isError ? (
        <Callout tone="danger" title={t('common.loadError')} action={<Button size="sm" onClick={() => void report.refetch()}>{t('common.retry')}</Button>}>
          {errorText(report.error, t('common.loadError'))}
        </Callout>
      ) : nothing ? (
        <EmptyState icon={<CopyCheck className="size-5" />} title={t('duplicates.noneTitle')} body={t('duplicates.noneBody')} />
      ) : data ? (
        <>
          <Panel
            title={t('duplicates.exactTitle')}
            description={t('duplicates.exactHint')}
            actions={<Badge tone={data.exact.length ? 'warning' : 'success'}>{data.exact.length}</Badge>}
          >
            {data.exact.length === 0 ? (
              <p className="text-sm text-muted">{t('duplicates.exactNone')}</p>
            ) : (
              <ul className="space-y-4">
                {data.exact.map((group) => (
                  <li key={group.checksum} className="rounded-ctl border border-line">
                    <div className="flex items-center justify-between border-b border-line bg-sunken px-4 py-2 text-xs text-muted">
                      <span>{t('duplicates.sameText', { count: group.documents.length })}</span>
                      <span className="font-mono">{group.checksum}</span>
                    </div>
                    <ul className="divide-y divide-line">
                      {group.documents.map((doc) => (
                        <li key={doc.id} className="flex items-center gap-3 px-4 py-2.5">
                          <DocLink id={doc.id} title={doc.title} />
                          <span className="ml-auto hidden text-xs text-muted sm:inline">{t('duplicates.updated', { when: f.date(doc.updated_at) })}</span>
                          {doc.keep ? (
                            <Badge tone="success">{t('duplicates.keep')}</Badge>
                          ) : (
                            <>
                              <Badge tone="warning">{t('duplicates.duplicate')}</Badge>
                              {deleteButton({ id: doc.id, title: doc.title })}
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title={t('duplicates.nearTitle')}
            description={t('duplicates.nearHint')}
            actions={<Badge tone={data.near.length ? 'warning' : 'success'}>{data.near.length}</Badge>}
          >
            {data.near.length === 0 ? (
              <p className="text-sm text-muted">{t('duplicates.nearNone')}</p>
            ) : (
              <ul className="space-y-3">
                {data.near.map((pair) => (
                  <li key={`${pair.a.id}-${pair.b.id}`} className="rounded-ctl border border-line p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <ScoreBar value={pair.similarity} className="max-w-48" />
                      <span className="tabular font-display text-xl">{f.number(pair.similarity * 100, 1)}%</span>
                      <span className="text-xs text-muted">{t('duplicates.similarity')}</span>
                    </div>
                    <ul className="space-y-1">
                      {[pair.a, pair.b].map((doc) => (
                        <li key={doc.id} className="flex items-center gap-2">
                          <DocLink id={doc.id} title={doc.title} />
                          <span className="ml-auto" />
                          {deleteButton(doc)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
        title={t('duplicates.confirmTitle')}
        body={t('duplicates.confirmBody', { title: pending?.title ?? '' })}
        confirmLabel={t('common.delete')}
        danger
        onConfirm={confirmDelete}
      />
    </div>
  )
}
