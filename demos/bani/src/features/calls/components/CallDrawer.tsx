import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'

import {
  Badge,
  CopyButton,
  DescriptionList,
  Drawer,
  EmptyState,
  ErrorState,
  SkeletonText,
  SourceBadge,
  StatusChip,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { errorMessage } from '@/api/client'
import { fmtDateTime, fmtDuration } from '@/lib/format'
import type { UnifiedCdr } from '@/types'
import { useRecordingLookup } from '../api'
import { recordingLegId } from '../lib/legs'
import { RecordingPlayer } from './RecordingPlayer'
import { TransferChain } from './TransferChain'
import { STATUS_TONE, useCallLabels } from './useCallLabels'

export type DrawerTab = 'details' | 'raw' | 'recording'

export function CallDrawer({
  row,
  tab,
  onTabChange,
  onClose,
}: {
  row: UnifiedCdr | null
  tab: DrawerTab
  onTabChange: (tab: DrawerTab) => void
  onClose: () => void
}) {
  const { t, labels, lang } = useCallLabels()
  const legId = row ? (recordingLegId(row) ?? row.rawData.id) : null
  // Prefetch when the leg is flagged as recorded (for the green dot); otherwise look up only when the tab is opened.
  const lookup = useRecordingLookup(legId, row?.source ?? 'core', !!row && (tab === 'recording' || row.hasRecording))
  const found = lookup.data?.found === true

  const raw = useMemo(() => (row ? JSON.stringify(row.rawData, null, 2) : ''), [row])
  const dash = '—'

  return (
    <Drawer
      open={!!row}
      onOpenChange={(o) => !o && onClose()}
      width={480}
      title={
        row ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[16px] tabular">
            {row.callerNumber || dash}
            <ArrowRight size={15} className="text-muted" aria-hidden />
            {row.calledNumber || dash}
          </span>
        ) : (
          t('drawer.title')
        )
      }
      subtitle={row ? fmtDateTime(row.timestamp, lang, { seconds: true }) : undefined}
    >
      {row && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source={row.source} />
            <StatusChip tone={STATUS_TONE[row.status]}>{labels.status(row.status)}</StatusChip>
            {(row.segmentCount ?? 1) > 1 && <Badge>{t('legs', { count: row.segmentCount })}</Badge>}
            {row.transfer?.wasTransferred && (
              <StatusChip tone="bronze" size="sm">
                {labels.reason(row.transfer.reason ?? 'transfer')}
              </StatusChip>
            )}
          </div>

          <Tabs value={tab} onValueChange={(v) => onTabChange(v as DrawerTab)}>
            <TabsList>
              <TabsTrigger value="details">{t('tabs.details')}</TabsTrigger>
              <TabsTrigger value="raw">{t('tabs.raw')}</TabsTrigger>
              <TabsTrigger value="recording">
                <span className="inline-flex items-center gap-1.5">
                  {t('tabs.recording')}
                  {found && <span className="h-2 w-2 rounded-full bg-success" aria-label={t('recording.found')} title={t('recording.found')} />}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4 space-y-5">
              <DescriptionList
                columns={1}
                items={[
                  { label: t('details.timestamp'), value: fmtDateTime(row.timestamp, lang, { seconds: true }), mono: true },
                  { label: t('details.source'), value: <SourceBadge source={row.source} /> },
                  { label: t('details.caller'), value: row.callerNumber || dash, mono: true },
                  { label: t('details.called'), value: row.calledNumber || dash, mono: true },
                  { label: t('details.final'), value: row.finalNumber || dash, mono: true },
                  { label: t('details.duration'), value: fmtDuration(row.duration), mono: true },
                  { label: t('details.billable'), value: fmtDuration(row.agentTalkSeconds ?? row.billableSeconds), mono: true },
                  { label: t('details.status'), value: <StatusChip tone={STATUS_TONE[row.status]} size="sm">{labels.status(row.status)}</StatusChip> },
                  { label: t('details.disposition'), value: row.disposition || dash },
                  { label: t('details.origDevice'), value: row.originatingDevice || dash, mono: true },
                  { label: t('details.destDevice'), value: row.terminatingDevice || dash, mono: true },
                  { label: t('details.accountCode'), value: row.accountCode || dash, mono: true },
                  { label: t('details.context'), value: row.context || dash, mono: true },
                  { label: t('details.hangupBy'), value: row.hangupBy || dash, mono: true },
                ]}
              />
              {row.transfer?.wasTransferred && <TransferChain row={row} />}
            </TabsContent>

            <TabsContent value="raw" className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12.5px] text-muted">
                  {(row.segmentCount ?? 1) > 1 ? t('raw.answerLeg', { count: row.segmentCount }) : t('raw.single')}
                </p>
                <CopyButton value={raw} label={t('raw.copy')} />
              </div>
              <pre
                tabIndex={0}
                className="scrollbar-thin max-h-[56vh] overflow-auto rounded-[10px] border border-line bg-sunken p-3 font-mono text-[12px] leading-relaxed text-ink"
              >
                {raw}
              </pre>
            </TabsContent>

            <TabsContent value="recording" className="mt-4">
              {lookup.isLoading || (lookup.isFetching && !lookup.data) ? (
                <div aria-busy className="space-y-3">
                  <p className="text-[13px] text-muted">{t('recording.searching')}</p>
                  <SkeletonText lines={3} />
                </div>
              ) : lookup.isError ? (
                <ErrorState error={errorMessage(lookup.error)} onRetry={() => void lookup.refetch()} />
              ) : lookup.data?.found ? (
                <div className="space-y-2">
                  <RecordingPlayer key={legId} recordings={lookup.data.recordings} />
                  <p className="text-[12px] text-muted">{t('recording.searchedIn', { ms: lookup.data.searchTimeMs })}</p>
                </div>
              ) : (
                <EmptyState
                  compact
                  title={t('recording.none')}
                  body={
                    <span className="block space-y-1">
                      <span className="block">{t(`recording.reasons.${lookup.data?.reason ?? 'no_recording'}`)}</span>
                      <span className="block font-mono text-[12px] text-muted">{t('recording.searchedIn', { ms: lookup.data?.searchTimeMs ?? 0 })}</span>
                    </span>
                  }
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </Drawer>
  )
}
