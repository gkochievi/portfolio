/** /admin/events/:eventId/prizes: the prizes published for one event. */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { Pencil, Plus, Trophy } from 'lucide-react'

import { Button, Card, EmptyState, ErrorState, IconButton, InlineConfirm, Skeleton, toast, toastError } from '@/components/ui'
import { assetUrl } from '@/lib/assets'
import type { Prize } from '@/types'
import { useContentSync, usePrizeCrud, usePrizes } from '../api'
import { PrizeSheet } from '../components/PrizeSheet'
import { ContentHeader, useCanEdit } from '../components/shared'

export default function PrizesAdminPage() {
  const { eventId = '' } = useParams()
  const { t } = useTranslation('content')
  const canEdit = useCanEdit()
  useContentSync()
  const prizes = usePrizes(eventId)
  const { remove } = usePrizeCrud(eventId)
  const [sheet, setSheet] = useState<{ open: boolean; prize: Prize | null }>({ open: false, prize: null })

  const rows = prizes.data
  const nextSortOrder = (rows ?? []).reduce((max, p) => Math.max(max, p.sortOrder), 0) + 1
  const openCreate = () => setSheet({ open: true, prize: null })

  const onDelete = async (prize: Prize) => {
    try {
      await remove.mutateAsync(prize.id)
      toast.success(t('prizes.toasts.deleted', { name: prize.label }))
    } catch (error) {
      toastError(error)
    }
  }

  return (
    <div>
      <ContentHeader
        eventId={eventId}
        title={t('prizes.title')}
        description={t('prizes.description')}
        actions={
          canEdit ? (
            <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={openCreate}>
              {t('prizes.add')}
            </Button>
          ) : null
        }
      />

      {prizes.isError ? (
        <ErrorState error={prizes.error} onRetry={() => void prizes.refetch()} />
      ) : !rows ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-card" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title={t('prizes.empty.title')}
            description={t('prizes.empty.description')}
            action={
              canEdit ? (
                <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={openCreate}>
                  {t('prizes.add')}
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((prize, index) => {
            const src = assetUrl(prize.imageUrl)
            return (
              <li key={prize.id} className="animate-drop-in" style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
                <Card padding="none" className="flex h-full flex-col overflow-hidden">
                  <div className="relative aspect-[4/3] bg-sunken">
                    {src ? (
                      <img src={src} alt={prize.label} className="size-full object-contain" loading="lazy" />
                    ) : (
                      <div className="grid size-full place-items-center" aria-label={t('prizes.noImage')} role="img">
                        <Trophy aria-hidden className="size-14 text-muted" strokeWidth={1.5} />
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded-chip bg-panel px-1.5 py-0.5 font-mono text-xs tabular-nums text-muted shadow-card">
                      {t('prizes.order', { n: prize.sortOrder })}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <h3 className="font-display text-base leading-snug text-ink">{prize.label}</h3>
                    <p className="text-sm text-muted">{prize.description ?? t('prizes.noDescription')}</p>
                    {canEdit ? (
                      <div className="mt-auto flex items-center justify-end gap-1 pt-3">
                        <IconButton
                          label={t('common:actions.edit')}
                          icon={<Pencil className="size-4" />}
                          size="sm"
                          onClick={() => setSheet({ open: true, prize })}
                        />
                        <InlineConfirm iconOnly question={t('prizes.deleteQuestion')} onConfirm={() => onDelete(prize)} />
                      </div>
                    ) : null}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {canEdit ? (
        <PrizeSheet
          eventId={eventId}
          open={sheet.open}
          prize={sheet.prize}
          nextSortOrder={nextSortOrder}
          onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        />
      ) : null}
    </div>
  )
}
