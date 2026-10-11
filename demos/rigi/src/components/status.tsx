/**
 * Status chips with consistent tones and labels (common namespace).
 * Owner: design-system. Success is teal on purpose so it never reads as the
 * green "now serving" signal.
 */
import { CheckCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge, type Tone } from '@/components/ui/display'
import { cn } from '@/lib/cn'
import type { InvoiceDisplayStatus, InvoiceStatus, LogLevel, MailStatus, ProjectState, ServiceStatus, TaskState } from '@/types'

type ChipTone = Tone | 'outline'

const TASK_TONE: Record<TaskState, ChipTone> = {
  accepted: 'info',
  in_progress: 'primary',
  pending: 'warning',
  testing: 'accent',
  finished: 'success',
  verified: 'success',
  cancelled: 'neutral',
}

export function TaskStateChip({ state, realm = 'staff', className }: { state: TaskState; realm?: 'staff' | 'partner'; className?: string }) {
  const { t } = useTranslation('common')
  const label = realm === 'partner' ? t(`taskStatePartner.${state}`) : t(`taskState.${state}`)
  const tone: ChipTone = realm === 'partner' && state === 'finished' ? 'warning' : TASK_TONE[state]
  return (
    <Badge tone={tone} className={className} icon={state === 'verified' ? <CheckCheck aria-hidden /> : undefined}>
      {label}
    </Badge>
  )
}

const INVOICE_TONE: Record<InvoiceStatus, ChipTone> = { draft: 'info', issued: 'outline', paid: 'success', void: 'neutral' }

export function InvoiceStatusChip({ status, className }: { status: InvoiceStatus; className?: string }) {
  const { t } = useTranslation('common')
  return <Badge tone={INVOICE_TONE[status]} className={cn(status === 'void' && 'line-through', className)}>{t(`invoiceStatus.${status}`)}</Badge>
}

const DISPLAY_TONE: Record<InvoiceDisplayStatus, ChipTone> = { pending: 'warning', overdue: 'danger', paid: 'success', void: 'neutral', disputed: 'accent' }

export function InvoiceDisplayStatusChip({ status, className }: { status: InvoiceDisplayStatus; className?: string }) {
  const { t } = useTranslation('common')
  return <Badge tone={DISPLAY_TONE[status]} className={className}>{t(`invoiceDisplayStatus.${status}`)}</Badge>
}

const MAIL_TONE: Record<MailStatus, ChipTone> = { new: 'info', triaged: 'outline', task_created: 'success', followup: 'warning', ignored: 'neutral' }

export function MailStatusChip({ status, className }: { status: MailStatus; className?: string }) {
  const { t } = useTranslation('common')
  return <Badge tone={MAIL_TONE[status]} className={className}>{t(`mailStatus.${status}`)}</Badge>
}

const PROJECT_TONE: Record<ProjectState, ChipTone> = { open: 'outline', completed: 'success', cancelled: 'neutral' }

export function ProjectStateChip({ state, className }: { state: ProjectState; className?: string }) {
  const { t } = useTranslation('common')
  return <Badge tone={PROJECT_TONE[state]} className={className}>{t(`projectState.${state}`)}</Badge>
}

export function ActiveChip({ active, className }: { active: boolean; className?: string }) {
  const { t } = useTranslation('common')
  return <Badge tone={active ? 'success' : 'neutral'} className={className}>{t(`active.${active ? 'true' : 'false'}`)}</Badge>
}

const LOG_TONE: Record<LogLevel, ChipTone> = { debug: 'neutral', info: 'info', warn: 'warning', error: 'danger' }

export function LogLevelChip({ level, className }: { level: LogLevel; className?: string }) {
  const { t } = useTranslation('common')
  return <Badge tone={LOG_TONE[level]} className={cn('font-mono', className)}>{t(`logLevel.${level}`)}</Badge>
}

const SERVICE_COLOR: Record<ServiceStatus, string> = { ok: 'bg-success', degraded: 'bg-warning', down: 'bg-danger' }

/** Square status light + optional label. */
export function ServiceStatusDot({ status, withLabel = true, className }: { status: ServiceStatus; withLabel?: boolean; className?: string }) {
  const { t } = useTranslation('common')
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px]', className)} title={t(`serviceStatus.${status}`)}>
      <span className={cn('size-2 shrink-0', SERVICE_COLOR[status], status !== 'ok' && 'motion-safe:animate-pulse')} aria-hidden />
      {withLabel ? <span>{t(`serviceStatus.${status}`)}</span> : <span className="sr-only">{t(`serviceStatus.${status}`)}</span>}
    </span>
  )
}

export function OverdueChip({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  return <Badge tone="danger" className={className}>{t('overdue')}</Badge>
}
