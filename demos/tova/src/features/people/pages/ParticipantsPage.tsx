/** /admin/participants (all staff): the lead list, newest first, debounced ?q= search, client-side Excel export. */
import { FileSpreadsheet, Mail, Phone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  SearchInput,
  Skeleton,
  toast,
  type Column,
} from '@/components/ui'
import { useLang } from '@/i18n'
import { formatDateTime, formatNumber } from '@/lib/format'
import type { ParticipantRow } from '@/types'
import { useDebounced, useParticipants } from '../api'
import { downloadBlob, exportFileName, participantsWorkbook } from '../exportParticipants'

const MOBILE_PAGE = 20

function Clip({ value, className }: { value: string; className?: string }) {
  if (!value) return <span className="text-muted">—</span>
  return (
    <span className={`block truncate ${className ?? ''}`} title={value}>
      {value}
    </span>
  )
}

export default function ParticipantsPage() {
  const { t } = useTranslation('people')
  const lang = useLang()
  const [searchParams, setSearchParams] = useSearchParams()
  const [text, setText] = useState(() => searchParams.get('q') ?? '')
  const q = useDebounced(text.trim(), 250)
  const participants = useParticipants(q)
  const [exporting, setExporting] = useState(false)
  const [mobileLimit, setMobileLimit] = useState(MOBILE_PAGE)

  // Mirror the settled search into ?q= (replace, so typing does not flood history).
  useEffect(() => {
    if ((searchParams.get('q') ?? '') === q) return
    const next = new URLSearchParams(searchParams)
    if (q) next.set('q', q)
    else next.delete('q')
    setSearchParams(next, { replace: true })
    setMobileLimit(MOBILE_PAGE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const rows = participants.data
  const searching = Boolean(q)

  function exportXlsx() {
    if (!rows?.length) {
      toast(t('participants.exportEmpty'))
      return
    }
    setExporting(true)
    try {
      const file = exportFileName()
      downloadBlob(participantsWorkbook(rows, t), file)
      toast.success(t('participants.exported', { file }))
    } catch {
      toast.error(t('errors.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  const columns = useMemo<Column<ParticipantRow>[]>(
    () => [
      {
        id: 'firstName',
        header: t('fields.firstName'),
        cell: (row) => <Clip value={row.firstName} className="max-w-[9rem] font-medium text-ink" />,
        sortValue: (row) => row.firstName.toLowerCase(),
      },
      {
        id: 'lastName',
        header: t('fields.lastName'),
        cell: (row) => <Clip value={row.lastName} className="max-w-[10rem] font-medium text-ink" />,
        sortValue: (row) => row.lastName.toLowerCase(),
      },
      { id: 'email', header: t('fields.email'), cell: (row) => <Clip value={row.email} className="max-w-[13rem]" /> },
      {
        id: 'phone',
        header: t('fields.phone'),
        cell: (row) => <Clip value={row.phone} className="max-w-[9rem] whitespace-nowrap tabular-nums" />,
        hideBelow: 'lg',
      },
      { id: 'company', header: t('fields.company'), cell: (row) => <Clip value={row.company} className="max-w-[10rem]" />, hideBelow: 'lg' },
      { id: 'position', header: t('fields.position'), cell: (row) => <Clip value={row.position} className="max-w-[10rem]" />, hideBelow: 'lg' },
      {
        id: 'best',
        header: t('participants.best'),
        cell: (row) => <span className="font-mono font-semibold tabular-nums text-primary">{formatNumber(row.best, lang)}</span>,
        sortValue: (row) => row.best,
        align: 'right',
      },
      {
        id: 'plays',
        header: t('participants.plays'),
        cell: (row) => <span className="tabular-nums text-muted">{formatNumber(row.plays, lang)}</span>,
        sortValue: (row) => row.plays,
        align: 'right',
      },
      {
        id: 'registeredAt',
        header: t('participants.registeredAt'),
        cell: (row) => <span className="whitespace-nowrap tabular-nums text-muted">{formatDateTime(row.createdAt, lang)}</span>,
        sortValue: (row) => row.createdAt,
      },
    ],
    [t, lang],
  )

  const empty = searching ? (
    <EmptyState compact title={t('participants.noMatchTitle', { q })} description={t('participants.noMatchDescription')} />
  ) : (
    <EmptyState title={t('participants.emptyTitle')} description={t('participants.emptyDescription')} />
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-baseline gap-2">
            {t('participants.title')}
            {rows && !searching && (
              <span className="font-mono text-base font-normal tabular-nums text-muted">
                ({formatNumber(rows.length, lang)})
              </span>
            )}
          </span>
        }
        description={t('participants.description')}
        actions={
          <Button
            size="sm"
            variant="accent"
            loading={exporting}
            disabled={!rows}
            leftIcon={<FileSpreadsheet className="size-4" />}
            onClick={exportXlsx}
          >
            {exporting ? t('participants.exporting') : t('participants.export')}
          </Button>
        }
      />

      <FilterBar>
        <div className="w-full sm:max-w-sm">
          <SearchInput
            value={text}
            onChange={setText}
            placeholder={t('participants.searchPlaceholder')}
            aria-label={t('common:actions.search')}
          />
        </div>
        {rows && searching && (
          <Badge tone="primary">{t('participants.matches', { count: rows.length })}</Badge>
        )}
        <span className="ml-auto hidden items-center gap-2 text-xs text-muted sm:inline-flex">
          <span className="size-2 rounded-full bg-success animate-live-dot" aria-hidden />
          {t('participants.live')}
        </span>
      </FilterBar>

      {participants.isError ? (
        <ErrorState error={participants.error} onRetry={() => void participants.refetch()} />
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              rows={rows}
              getRowId={(row) => row.id}
              loading={participants.isLoading}
              empty={empty}
            />
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {!rows ? (
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 w-full rounded-card" />)
            ) : rows.length === 0 ? (
              empty
            ) : (
              <>
                {rows.slice(0, mobileLimit).map((row) => (
                  <Card key={row.id} padding="sm" className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-ink [overflow-wrap:anywhere]">
                          {`${row.firstName} ${row.lastName}`.trim()}
                        </p>
                        {(row.position || row.company) && (
                          <p className="break-words text-sm text-muted [overflow-wrap:anywhere]">
                            {[row.position, row.company].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-lg font-semibold tabular-nums text-primary">{formatNumber(row.best, lang)}</p>
                        <p className="text-xs tabular-nums text-muted">
                          {t('participants.plays')}: {formatNumber(row.plays, lang)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 text-sm">
                      {row.email ? (
                        <span className="flex min-w-0 items-center gap-2 text-ink">
                          <Mail className="size-4 shrink-0 text-muted" aria-hidden />
                          <span className="truncate">{row.email}</span>
                        </span>
                      ) : null}
                      {row.phone ? (
                        <span className="flex items-center gap-2 tabular-nums text-ink">
                          <Phone className="size-4 shrink-0 text-muted" aria-hidden />
                          {row.phone}
                        </span>
                      ) : null}
                      {!row.email && !row.phone && <span className="text-muted">{t('participants.noContact')}</span>}
                    </div>
                    <p className="text-xs tabular-nums text-muted">
                      {t('participants.registeredAt')}: {formatDateTime(row.createdAt, lang)}
                    </p>
                  </Card>
                ))}
                {rows.length > mobileLimit && (
                  <Button variant="secondary" block onClick={() => setMobileLimit((limit) => limit + MOBILE_PAGE)}>
                    {t('participants.showMore')}
                  </Button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
