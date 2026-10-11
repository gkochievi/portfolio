import { FileText, Mic } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ScorePill, type ScoreTone } from '@/components/brand'
import { Badge, StatusChip, type Tone } from '@/components/ui'
import { scoreBand } from '@/lib/scoring'
import type { Agreement, RecordingStatus, ScoreBands } from '@/types'

const statusTone: Record<RecordingStatus, Tone> = {
  pending: 'neutral',
  transcribing: 'info',
  ready: 'primary',
  analyzing: 'accent',
  done: 'success',
  error: 'danger',
}

export function RecordingStatusChip({ status }: { status: RecordingStatus }) {
  const { t } = useTranslation('workbench')
  return (
    <StatusChip tone={statusTone[status]} pulse={status === 'transcribing' || status === 'analyzing'}>
      {t(`status.${status}`)}
    </StatusChip>
  )
}

export function SourceIcon({ source, className }: { source: 'audio' | 'text'; className?: string }) {
  const { t } = useTranslation('workbench')
  const Icon = source === 'audio' ? Mic : FileText
  return <Icon className={className ?? 'size-4 shrink-0 text-muted'} strokeWidth={1.75} aria-label={t(`source.${source}`)} role="img" />
}

/** Score pill coloured by the workspace's own bands. */
export function BandPill({ score, bands, size = 'md' }: { score: number | null; bands: ScoreBands; size?: 'sm' | 'md' | 'lg' }) {
  const band = scoreBand(score, bands)
  const tone: ScoreTone = band === 'good' ? 'success' : band === 'mid' ? 'warning' : band === 'bad' ? 'danger' : 'muted'
  return <ScorePill score={score} tone={tone} size={size} />
}

const agreementTone: Record<Agreement, Tone> = {
  agree: 'success',
  partial: 'warning',
  conflict: 'danger',
  text_only: 'neutral',
  prosody_only: 'neutral',
  unknown: 'neutral',
}

export function AgreementBadge({ agreement }: { agreement: Agreement | null }) {
  const { t } = useTranslation('workbench')
  if (!agreement) return <span className="text-subtle">-</span>
  return (
    <Badge tone={agreementTone[agreement]} size="sm">
      {t(`agreement.${agreement}`)}
    </Badge>
  )
}
