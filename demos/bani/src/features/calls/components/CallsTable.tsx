import { ChevronRight, Play } from 'lucide-react'
import { Fragment } from 'react'

import { Badge, Checkbox, EmptyState, Skeleton, SourceBadge, StatusChip, Table, TBody, Td, Th, THead, Tr } from '@/components/ui'
import { cn } from '@/lib/cn'
import { fmtDateTime, fmtDuration, fmtTime } from '@/lib/format'
import type { UnifiedCdr } from '@/types'
import { recordingLegId } from '../lib/legs'
import { assetForLeg } from '../lib/recordings'
import { hopCount, nextSort, type ColumnFilters, type ColumnId, type SortState } from '../lib/rows'
import { TransferChain } from './TransferChain'
import { STATUS_TONE, useCallLabels } from './useCallLabels'
import { MiniWave } from './Waveform'

interface ColumnDef {
  id: ColumnId
  align?: 'left' | 'right'
  width: string
}

const COLUMNS: ColumnDef[] = [
  { id: 'timestamp', width: 'min-w-[168px]' },
  { id: 'caller', width: 'min-w-[112px]' },
  { id: 'called', width: 'min-w-[112px]' },
  { id: 'transferred', width: 'min-w-[150px]' },
  { id: 'transferFrom', width: 'min-w-[104px]' },
  { id: 'transferTo', width: 'min-w-[104px]' },
  { id: 'duration', align: 'right', width: 'min-w-[88px]' },
  { id: 'billable', align: 'right', width: 'min-w-[88px]' },
  { id: 'status', width: 'min-w-[120px]' },
  { id: 'disposition', width: 'min-w-[150px]' },
  { id: 'origDevice', width: 'min-w-[150px]' },
  { id: 'destDevice', width: 'min-w-[150px]' },
  { id: 'hangupBy', width: 'min-w-[104px]' },
  { id: 'source', width: 'min-w-[112px]' },
]
const COL_COUNT = COLUMNS.length + 2

export interface CallsTableProps {
  rows: UnifiedCdr[]
  loading: boolean
  sort: SortState
  onSort: (sort: SortState) => void
  filters: ColumnFilters
  onFilter: (id: ColumnId, value: string) => void
  selected: Set<string>
  onToggle: (id: string) => void
  onTogglePage: (checked: boolean) => void
  expanded: Set<string>
  onExpand: (id: string) => void
  activeId: string | null
  onOpen: (row: UnifiedCdr, tab: 'details' | 'recording') => void
  emptyTitle: string
  emptyBody: string
  emptyAction?: React.ReactNode
}

export function CallsTable(props: CallsTableProps) {
  const { rows, loading, sort, onSort, filters, onFilter, selected, onToggle, onTogglePage, expanded, onExpand, activeId, onOpen } = props
  const { t, labels, lang } = useCallLabels()
  const pageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const pageSome = rows.some((r) => selected.has(r.id))
  const dash = <span className="text-faint">{'—'}</span>

  return (
    <Table wrapperClassName="max-h-[640px]" className="min-w-[1700px]">
      <THead>
        <tr>
          <Th className="w-10">
            <Checkbox
              aria-label={t('table.selectPage')}
              checked={pageSelected ? true : pageSome ? 'indeterminate' : false}
              onCheckedChange={onTogglePage}
              disabled={rows.length === 0}
            />
          </Th>
          <Th className="w-[112px]">{t('cols.recording')}</Th>
          {COLUMNS.map((c) => (
            <Th
              key={c.id}
              align={c.align}
              className={c.width}
              sort={sort.column === c.id ? sort.dir : null}
              onSort={() => onSort(nextSort(sort, c.id))}
            >
              {t(`cols.${c.id}`)}
            </Th>
          ))}
        </tr>
        <tr>
          <th className="border-b border-line bg-sunken" />
          <th className="border-b border-line bg-sunken" />
          {COLUMNS.map((c) => (
            <th key={c.id} className="border-b border-line bg-sunken px-3 pb-2 pt-0 font-normal last:pr-4">
              <input
                type="text"
                value={filters[c.id] ?? ''}
                onChange={(e) => onFilter(c.id, e.target.value)}
                placeholder={t('table.filter')}
                aria-label={t('table.filterColumn', { column: t(`cols.${c.id}`) })}
                className={cn(
                  'h-7 w-full rounded-[6px] border border-line bg-panel px-2 font-mono text-[12px] text-ink placeholder:font-sans placeholder:text-faint',
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
                  c.align === 'right' && 'text-right',
                )}
              />
            </th>
          ))}
        </tr>
      </THead>
      <TBody>
        {loading &&
          Array.from({ length: 8 }, (_, i) => (
            <tr key={i}>
              {Array.from({ length: COL_COUNT }, (_, j) => (
                <Td key={j}>
                  <Skeleton className="h-4 w-full max-w-[120px]" />
                </Td>
              ))}
            </tr>
          ))}
        {!loading && rows.length === 0 && (
          <tr>
            <td colSpan={COL_COUNT} className="p-0">
              <div className="sticky left-0 w-full max-w-[100vw] py-6">
                <EmptyState title={props.emptyTitle} body={props.emptyBody} action={props.emptyAction} />
              </div>
            </td>
          </tr>
        )}
        {!loading &&
          rows.map((row) => {
            const legs = row.segmentCount ?? 1
            const isOpen = expanded.has(row.id)
            const tr = row.transfer
            const moved = !!tr?.wasTransferred
            const legId = recordingLegId(row)
            return (
              <Fragment key={row.id}>
                <Tr selected={activeId === row.id} onClick={() => onOpen(row, 'details')}>
                  <Td onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      aria-label={t('table.selectRow')}
                      checked={selected.has(row.id)}
                      onCheckedChange={() => onToggle(row.id)}
                    />
                  </Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    {row.hasRecording && legId ? (
                      <button
                        type="button"
                        onClick={() => onOpen(row, 'recording')}
                        aria-label={t('table.playRecording')}
                        title={t('table.playRecording')}
                        className="group/play inline-flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-1 hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary">
                          <Play size={11} fill="currentColor" className="translate-x-px" />
                        </span>
                        <MiniWave peaks={assetForLeg(legId).peaks} className="w-[34px]" />
                      </button>
                    ) : (
                      <span title={t('table.noRecording')}>{dash}</span>
                    )}
                  </Td>
                  <Td mono className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      {legs > 1 ? (
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-label={t('table.toggleLegs', { count: legs })}
                          onClick={(e) => {
                            e.stopPropagation()
                            onExpand(row.id)
                          }}
                          className="inline-flex items-center gap-0.5 rounded-full border border-line bg-panel py-px pl-0.5 pr-1.5 font-sans text-[11.5px] text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
                        >
                          <ChevronRight size={13} className={cn('transition-transform duration-[160ms]', isOpen && 'rotate-90')} />
                          {t('legs', { count: legs })}
                        </button>
                      ) : null}
                      {fmtDateTime(row.timestamp, lang, { seconds: true })}
                    </span>
                  </Td>
                  <Td mono>{row.callerNumber || dash}</Td>
                  <Td mono>{row.calledNumber || dash}</Td>
                  <Td>
                    {moved ? (
                      <span className="inline-flex items-center gap-1.5">
                        <StatusChip tone="bronze" size="sm" icon={false}>
                          {labels.reason(tr!.reason ?? 'transfer')}
                        </StatusChip>
                        <span className="font-mono text-[12px] tabular text-muted" title={t('table.hops', { count: hopCount(row) })}>
                          {'×'}
                          {hopCount(row)}
                        </span>
                      </span>
                    ) : (
                      dash
                    )}
                  </Td>
                  <Td mono>{moved && tr!.transferFrom ? tr!.transferFrom : dash}</Td>
                  <Td mono>{moved && tr!.transferTo ? tr!.transferTo : dash}</Td>
                  <Td mono align="right">
                    {fmtDuration(row.duration)}
                  </Td>
                  <Td mono align="right">
                    {fmtDuration(row.agentTalkSeconds ?? row.billableSeconds)}
                  </Td>
                  <Td>
                    <StatusChip tone={STATUS_TONE[row.status]} size="sm">
                      {labels.status(row.status)}
                    </StatusChip>
                  </Td>
                  <Td className="max-w-[200px] truncate" title={row.disposition}>
                    {row.disposition || dash}
                  </Td>
                  <Td mono className="max-w-[200px] truncate" title={row.originatingDevice}>
                    {row.originatingDevice || dash}
                  </Td>
                  <Td mono className="max-w-[200px] truncate" title={row.terminatingDevice}>
                    {row.terminatingDevice || dash}
                  </Td>
                  <Td mono>{row.hangupBy || dash}</Td>
                  <Td>
                    <SourceBadge source={row.source} />
                  </Td>
                </Tr>
                {isOpen && legs > 1 && (
                  <tr>
                    <td colSpan={COL_COUNT} className="border-b border-line bg-sunken/50 p-0">
                      <div className="sticky left-0 w-full max-w-[100vw] space-y-4 px-5 py-4">
                        {moved && <TransferChain row={row} />}
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-muted">
                            {t('legsTable.title')} <Badge>{legs}</Badge>
                          </div>
                          <Table compact wrapperClassName="rounded-[8px] border border-line bg-panel" className="max-w-[880px]">
                            <THead>
                              <tr>
                                <Th>#</Th>
                                <Th>{t('legsTable.time')}</Th>
                                <Th>{t('cols.caller')}</Th>
                                <Th>{t('cols.called')}</Th>
                                <Th>{t('details.final')}</Th>
                                <Th>{t('legsTable.devices')}</Th>
                                <Th align="right">{t('legsTable.talk')}</Th>
                                <Th>{t('cols.status')}</Th>
                              </tr>
                            </THead>
                            <TBody>
                              {(row.segments ?? []).map((leg, i) => (
                                <Tr key={leg.id}>
                                  <Td mono muted>
                                    {i + 1}
                                  </Td>
                                  <Td mono>{fmtTime(leg.timestamp, lang, { seconds: true })}</Td>
                                  <Td mono>{leg.callerNumber || dash}</Td>
                                  <Td mono>{leg.calledNumber || dash}</Td>
                                  <Td mono>{leg.finalNumber || dash}</Td>
                                  <Td mono>
                                    {leg.originatingDevice || '—'} {'→'} {leg.terminatingDevice || '—'}
                                  </Td>
                                  <Td mono align="right">
                                    {fmtDuration(leg.billableSeconds)}
                                  </Td>
                                  <Td>
                                    <StatusChip tone={STATUS_TONE[leg.status]} size="sm">
                                      {labels.status(leg.status)}
                                    </StatusChip>
                                  </Td>
                                </Tr>
                              ))}
                            </TBody>
                          </Table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
      </TBody>
    </Table>
  )
}
